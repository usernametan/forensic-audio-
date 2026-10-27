import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models
from ..audit import audit
from ..config import settings
from ..db import get_db
from ..hashutil import sha256_file
from ..storage import store_original
from ...pipeline import compare
from ...pipeline.audio_util import probe_audio

router = APIRouter(tags=["pipeline"])

ALLOWED = {".wav", ".mp3", ".flac", ".ogg", ".m4a"}


def _stage_map(run_id: str, db: Session) -> dict:
    return {s.stage: s for s in db.query(models.StageOutput).filter_by(run_id=run_id).all()}


@router.get("/pipeline/{run_id}/status")
def status(run_id: str, db: Session = Depends(get_db)):
    run = db.get(models.PipelineRun, run_id)
    if not run:
        raise HTTPException(404, "run not found")
    stages = db.query(models.StageOutput).filter_by(run_id=run_id).all()
    return {"run_id": run.id, "status": run.status, "stage": run.current_stage,
            "progress": run.progress, "error": run.error,
            "stages": [{"stage": s.stage, "model": s.model_name, "metrics_keys": list((s.metrics or {}).keys())} for s in stages]}


@router.post("/pipeline/{run_id}/compare")
def compare_specimen(run_id: str,
                     specimen: UploadFile | None = File(default=None),
                     specimen_id: str = Form(default=""),
                     db: Session = Depends(get_db)):
    """Attach or replace a reference specimen and re-run comparison for a completed run.

    Changing the reference or re-running comparison invalidates any prior examiner
    approval, because the certified report must reflect the latest analysis inputs.
    """
    run = db.get(models.PipelineRun, run_id)
    if not run:
        raise HTTPException(404, "run not found")
    if run.status not in ("needs_review", "approved"):
        raise HTTPException(409, f"comparison requires a completed run (status={run.status})")

    stages = _stage_map(run_id, db)
    denoise_stage = stages.get("denoise")
    if not denoise_stage or not denoise_stage.output_path or not Path(denoise_stage.output_path).exists():
        raise HTTPException(409, "denoised working audio is not available for comparison")

    sid = specimen_id.strip()
    specimen_payload = None

    if specimen is not None and specimen.filename:
        ext = Path(specimen.filename).suffix.lower()
        if ext not in ALLOWED:
            raise HTTPException(400, f"Unsupported specimen file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED))}")
        safe_name = Path(specimen.filename).name.replace(" ", "_")
        tmp = Path(f"/tmp/{uuid.uuid4().hex[:8]}_{safe_name}")
        try:
            limit = settings.max_upload_mb * 1024 * 1024
            total = 0
            with open(tmp, "wb") as handle:
                while True:
                    chunk = specimen.file.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > limit:
                        raise HTTPException(
                            status_code=413,
                            detail=f"File exceeds the {settings.max_upload_mb} MB upload limit.",
                        )
                    handle.write(chunk)
            digest = sha256_file(tmp)
            probe = probe_audio(str(tmp))
            dest = store_original(tmp, f"{digest[:12]}_{safe_name}")
        finally:
            tmp.unlink(missing_ok=True)

        row = models.EvidenceFile(
            kind="specimen",
            original_filename=specimen.filename,
            stored_path=str(dest),
            sha256=digest,
            bytes=dest.stat().st_size,
            codec=probe["codec"],
            sample_rate=probe["sr"],
            channels=probe["ch"],
            duration_s=probe["dur"],
            source="examiner-selected reference",
            soundproof_flag="unknown",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        sid = row.id
        specimen_payload = {
            "id": row.id,
            "filename": row.original_filename,
            "sha256": row.sha256,
            "bytes": row.bytes,
            "codec": row.codec,
            "sample_rate": row.sample_rate,
            "channels": row.channels,
            "duration_s": row.duration_s,
        }
        audit(run_id, run.evidence_id, action="specimen-upload-for-comparison",
              output_path=str(dest), output_hash=digest, tool="upload",
              params={"filename": row.original_filename})

    if not sid:
        raise HTTPException(400, "a specimen file or specimen_id is required")

    known = db.get(models.EvidenceFile, sid)
    if not known:
        raise HTTPException(404, "specimen not found")
    if known.kind != "specimen":
        raise HTTPException(400, "the selected record is not a reference specimen")

    result = compare.compare(denoise_stage.output_path, known.stored_path)
    comparison = {
        "specimen_id": known.id,
        "specimen_file": known.original_filename,
        **result,
    }

    compare_stage = stages.get("compare")
    if compare_stage is None:
        compare_stage = models.StageOutput(run_id=run_id, stage="compare")
        db.add(compare_stage)
    compare_stage.output_path = denoise_stage.output_path
    compare_stage.sha256 = denoise_stage.sha256
    compare_stage.metrics = {"comparisons": [comparison]}
    compare_stage.model_name = result["model"]
    compare_stage.model_version = result["version"]
    compare_stage.params = {"reference_specimen_id": known.id}

    run.specimen_ids = json.dumps([known.id])
    run.status = "needs_review"
    run.approved_by = ""
    run.current_stage = "needs_review"
    run.progress = 100
    db.commit()

    audit(run_id, run.evidence_id, action="comparison-rerun",
          output_path=denoise_stage.output_path, output_hash=denoise_stage.sha256,
          tool=f"{result['model']} {result['version']}",
          params={"specimen_id": known.id, "specimen_file": known.original_filename})

    if specimen_payload is None:
        specimen_payload = {
            "id": known.id,
            "filename": known.original_filename,
            "sha256": known.sha256,
            "bytes": known.bytes,
            "codec": known.codec,
            "sample_rate": known.sample_rate,
            "channels": known.channels,
            "duration_s": known.duration_s,
        }

    return {
        "run_id": run_id,
        "run_status": run.status,
        "comparison": comparison,
        "specimen": specimen_payload,
    }
