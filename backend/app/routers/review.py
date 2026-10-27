from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..audit import audit
from ...pipeline import transcribe_translate

router = APIRouter(tags=["review"])

ALLOWED_TARGETS = {"en", "hi", "mr"}


class ReviewIn(BaseModel):
    examiner: str = ""
    approved: bool = False
    conclusion: str = ""
    overrides: dict = {}


class TranscriptIn(BaseModel):
    segments: list[dict] = Field(default_factory=list, max_length=10000)


class TranslateIn(BaseModel):
    target: str = "en"


def _invalidate_approval(run: models.PipelineRun) -> None:
    """Any material change to analysis inputs/outputs invalidates prior approval."""
    if run.status == "approved":
        run.status = "needs_review"
        run.approved_by = ""


@router.get("/review/{run_id}")
def get_review(run_id: str, db: Session = Depends(get_db)):
    run = db.get(models.PipelineRun, run_id)
    if not run:
        raise HTTPException(404, "run not found")
    stages = {s.stage: {"metrics": s.metrics, "sha256": s.sha256, "model": s.model_name,
                        "version": s.model_version, "params": s.params, "output": s.output_path}
              for s in db.query(models.StageOutput).filter_by(run_id=run_id).all()}
    tr = db.query(models.Transcript).filter_by(run_id=run_id).first()
    wc = (db.query(models.WorkingCopy)
          .filter_by(evidence_id=run.evidence_id)
          .order_by(models.WorkingCopy.created_at.desc())
          .first())
    return {"run_id": run_id, "status": run.status, "approved_by": run.approved_by,
            "conclusion": getattr(run, "conclusion", ""), "stages": stages,
            "working_copy": ({"path": wc.path, "sha256": wc.sha256,
                              "derived_from": wc.derived_from} if wc else None),
            "transcript": tr.segments if tr else [],
            "translated": tr.translated_segments if tr else []}


@router.put("/review/{run_id}")
def put_review(run_id: str, body: ReviewIn, db: Session = Depends(get_db)):
    run = db.get(models.PipelineRun, run_id)
    if not run:
        raise HTTPException(404, "run not found")
    if run.status not in ("needs_review", "approved"):
        raise HTTPException(409, f"run not reviewable (status={run.status})")
    audit(run_id, run.evidence_id, actor=body.examiner or "examiner",
          action="review-override" if body.overrides else "review",
          params={"approved": body.approved, **body.overrides})
    if body.approved:
        run.status = "approved"
        run.approved_by = body.examiner
    if body.conclusion:
        run.conclusion = body.conclusion
    db.commit()
    return {"run_id": run_id, "status": run.status, "approved_by": run.approved_by, "conclusion": run.conclusion}


@router.put("/review/{run_id}/transcript")
def put_transcript(run_id: str, body: TranscriptIn, db: Session = Depends(get_db)):
    """Persist examiner corrections and review markers for transcript segments."""
    run = db.get(models.PipelineRun, run_id)
    if not run:
        raise HTTPException(404, "run not found")
    if run.status not in ("needs_review", "approved"):
        raise HTTPException(409, f"transcript not reviewable (status={run.status})")

    cleaned = []
    for index, segment in enumerate(body.segments):
        if not isinstance(segment, dict):
            raise HTTPException(400, f"segment {index} must be an object")
        try:
            start = float(segment.get("start", 0))
            end = float(segment.get("end", 0))
        except (TypeError, ValueError):
            raise HTTPException(400, f"segment {index} has invalid timestamps")
        if start < 0 or end < start:
            raise HTTPException(400, f"segment {index} has an invalid time range")
        text = str(segment.get("text", ""))[:4000]
        cleaned.append({
            "start": round(start, 2),
            "end": round(end, 2),
            "speaker": str(segment.get("speaker", "SPEAKER_00"))[:64],
            "text": text,
            "review_status": str(segment.get("review_status", "unreviewed"))[:32],
            "uncertain": bool(segment.get("uncertain", False)),
        })

    tr = db.query(models.Transcript).filter_by(run_id=run_id).first()
    if tr is None:
        tr = models.Transcript(run_id=run_id, lang="auto", segments=[], translated_segments=[])
        db.add(tr)
    tr.segments = cleaned
    # Any existing translation was produced from the pre-correction transcript.
    # Clearing it prevents an outdated translation from being attached to the report.
    tr.translated_segments = []
    translate_stage = db.query(models.StageOutput).filter_by(run_id=run_id, stage="translate").first()
    if translate_stage is not None:
        db.delete(translate_stage)
    _invalidate_approval(run)
    db.commit()
    db.refresh(tr)

    audit(run_id, run.evidence_id, actor="examiner", action="transcript-edited",
          params={"segment_count": len(cleaned), "status": run.status})
    return {"run_id": run_id, "segments": tr.segments, "status": run.status}


@router.post("/review/{run_id}/translate")
def translate(run_id: str, body: TranslateIn, db: Session = Depends(get_db)):
    """Run the configured translation stage for a target language.

    The response includes the engine field so the UI can distinguish a real
    IndicTrans2 model from the documented lightweight fallback stub.
    """
    run = db.get(models.PipelineRun, run_id)
    if not run:
        raise HTTPException(404, "run not found")
    if run.status not in ("needs_review", "approved"):
        raise HTTPException(409, f"translation not available (status={run.status})")
    target = body.target.lower()
    if target not in ALLOWED_TARGETS:
        raise HTTPException(400, f"unsupported translation target '{target}'")

    tr = db.query(models.Transcript).filter_by(run_id=run_id).first()
    if tr is None or not tr.segments:
        raise HTTPException(404, "no transcript segments available for translation")

    translated = transcribe_translate.translate(tr.segments, target)
    tr.translated_segments = translated["segments"]

    translate_stage = db.query(models.StageOutput).filter_by(run_id=run_id, stage="translate").first()
    if translate_stage is None:
        translate_stage = models.StageOutput(run_id=run_id, stage="translate")
        db.add(translate_stage)
    translate_stage.metrics = {
        "engine": translated["engine"],
        "model": translated["model"],
        "version": translated["version"],
        "target": target,
        "segment_count": len(translated["segments"]),
    }
    translate_stage.model_name = translated["model"]
    translate_stage.model_version = translated["version"]
    translate_stage.params = {"target": target, "engine": translated["engine"]}

    _invalidate_approval(run)
    db.commit()
    db.refresh(tr)

    audit(run_id, run.evidence_id, actor="examiner", action="translation-generated",
          tool=f"{translated['model']} {translated['version']}",
          params={"target": target, "engine": translated["engine"], "status": run.status})
    return {
        "run_id": run_id,
        "target": target,
        "engine": translated["engine"],
        "model": translated["model"],
        "version": translated["version"],
        "segments": tr.translated_segments,
        "status": run.status,
    }
