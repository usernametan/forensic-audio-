from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models
from ..audit import audit

router = APIRouter(tags=["review"])


class ReviewIn(BaseModel):
    examiner: str = ""
    approved: bool = False
    conclusion: str = ""
    overrides: dict = {}


@router.get("/review/{run_id}")
def get_review(run_id: str, db: Session = Depends(get_db)):
    run = db.get(models.PipelineRun, run_id)
    if not run:
        raise HTTPException(404, "run not found")
    stages = {s.stage: {"metrics": s.metrics, "sha256": s.sha256, "model": s.model_name,
                        "version": s.model_version, "output": s.output_path}
              for s in db.query(models.StageOutput).filter_by(run_id=run_id).all()}
    tr = db.query(models.Transcript).filter_by(run_id=run_id).first()
    return {"run_id": run_id, "status": run.status, "approved_by": run.approved_by,
            "conclusion": getattr(run, "conclusion", ""), "stages": stages,
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
