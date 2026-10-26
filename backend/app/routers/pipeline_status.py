from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models

router = APIRouter(tags=["pipeline"])


@router.get("/pipeline/{run_id}/status")
def status(run_id: str, db: Session = Depends(get_db)):
    run = db.get(models.PipelineRun, run_id)
    if not run:
        raise HTTPException(404, "run not found")
    stages = db.query(models.StageOutput).filter_by(run_id=run_id).all()
    return {"run_id": run.id, "status": run.status, "stage": run.current_stage,
            "progress": run.progress, "error": run.error,
            "stages": [{"stage": s.stage, "model": s.model_name, "metrics_keys": list((s.metrics or {}).keys())} for s in stages]}
