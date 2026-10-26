import json
import shutil
import threading
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models
from ..hashutil import sha256_file
from ..storage import store_original
from ..audit import audit
from ...pipeline.orchestrator import run_pipeline
import soundfile as sf

router = APIRouter(prefix="/evidence", tags=["evidence"])
ALLOWED = {".wav", ".mp3", ".flac", ".ogg", ".m4a"}


def _probe(path: Path) -> dict:
    try:
        io = sf.info(str(path))
        return {"codec": f"{io.format}/{io.subtype}", "sr": io.samplerate,
                "ch": io.channels, "dur": io.frames / float(io.samplerate or 1)}
    except Exception:
        return {"codec": "unknown", "sr": 0, "ch": 0, "dur": 0.0}


@router.post("/upload")
def upload(evidence: UploadFile = File(...),
           specimens: list[UploadFile] = File(default=[]),
           source: str = Form(default=""), collector: str = Form(default=""),
           questionnaire: str = Form(default="{}"),
           background_tasks: BackgroundTasks = None,
           db: Session = Depends(get_db)):
    safe_name = Path(evidence.filename).name.replace(" ", "_")
    tmp = Path(f"/tmp/{uuid.uuid4().hex[:8]}_{safe_name}")
    with open(tmp, "wb") as f:
        shutil.copyfileobj(evidence.file, f)
    h = sha256_file(tmp)
    probe = _probe(tmp)
    dest = store_original(tmp, f"{h[:12]}_{safe_name}")
    ev = models.EvidenceFile(kind="evidence", original_filename=evidence.filename,
                             stored_path=str(dest), sha256=h, bytes=dest.stat().st_size,
                             codec=probe["codec"], sample_rate=probe["sr"],
                             channels=probe["ch"], duration_s=probe["dur"],
                             source=source, collector=collector, panoch_notes=questionnaire)
    db.add(ev)
    db.commit()
    db.refresh(ev)
    audit("", ev.id, action="evidence-upload", output_path=str(dest), output_hash=h,
          tool="upload", params={"questionnaire": questionnaire[:2000]})
    spec_ids = []
    for s in specimens or []:
        s_safe = Path(s.filename).name.replace(" ", "_")
        t = Path(f"/tmp/{uuid.uuid4().hex[:8]}_{s_safe}")
        with open(t, "wb") as f:
            shutil.copyfileobj(s.file, f)
        sh = sha256_file(t)
        pr = _probe(t)
        d = store_original(t, f"{sh[:12]}_{s_safe}")
        row = models.EvidenceFile(kind="specimen", original_filename=s.filename,
                                  stored_path=str(d), sha256=sh, bytes=d.stat().st_size,
                                  codec=pr["codec"], sample_rate=pr["sr"], channels=pr["ch"],
                                  duration_s=pr["dur"], soundproof_flag="unknown")
        db.add(row)
        db.commit()
        spec_ids.append(row.id)
    run = models.PipelineRun(evidence_id=ev.id, specimen_ids=json.dumps(spec_ids))
    db.add(run)
    db.commit()
    db.refresh(run)
    threading.Thread(target=run_pipeline, args=(run.id,), daemon=True).start()
    return {"evidence_id": ev.id, "sha256": h, "run_id": run.id, "specimen_ids": spec_ids,
            "filename": ev.original_filename, "duration_s": ev.duration_s, "codec": ev.codec,
            "sample_rate": ev.sample_rate, "channels": ev.channels, "bytes": ev.bytes}


@router.get("/{evidence_id}")
def get_evidence(evidence_id: str, db: Session = Depends(get_db)):
    ev = db.get(models.EvidenceFile, evidence_id)
    if not ev:
        raise HTTPException(404, "Evidence file not found")
    return {"id": ev.id, "kind": ev.kind, "filename": ev.original_filename,
            "sha256": ev.sha256, "bytes": ev.bytes, "codec": ev.codec,
            "sample_rate": ev.sample_rate, "channels": ev.channels,
            "duration_s": ev.duration_s, "source": ev.source, "collector": ev.collector}
