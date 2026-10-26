import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models
from ..hashutil import sha256_file
from ...pipeline import report as rpt

router = APIRouter(tags=["export"])


@router.get("/export/{run_id}")
def export(run_id: str, examiner: str = "", conclusion: str = "",
           fmt: str = "html", db: Session = Depends(get_db)):
    run = db.get(models.PipelineRun, run_id)
    if not run:
        raise HTTPException(404, "run not found")
    if run.status != "approved":
        raise HTTPException(409, "examiner approval required before export")
    ev = db.get(models.EvidenceFile, run.evidence_id)
    stages = db.query(models.StageOutput).filter_by(run_id=run_id).all()
    tr = db.query(models.Transcript).filter_by(run_id=run_id).first()
    wc = db.query(models.WorkingCopy).filter_by(evidence_id=ev.id).first()
    sm = {s.stage: s.metrics for s in stages}
    examiner_name = examiner or run.approved_by or "Examiner"
    conclusion_text = conclusion or getattr(run, "conclusion", "") or "Forensic audio examination completed in ordinary course."
    html_p, pdf_p = rpt.build(
        run_id, ev.original_filename, ev.sha256, wc.sha256 if wc else "",
        json.loads(run.specimen_ids or "[]"),
        [{"stage": s.stage, "model": s.model_name, "version": s.model_version,
          "params": s.params, "sha256": s.sha256} for s in stages],
        sm.get("acoustic", {}), sm.get("compare", {}),
        tr.segments if tr else [], tr.translated_segments if tr else [],
        sm.get("integrity", {}), examiner_name, conclusion_text)
    rep = models.Report(run_id=run_id, html_path=html_p, pdf_path=pdf_p,
                        html_hash=sha256_file(html_p), pdf_hash=sha256_file(pdf_p),
                        examiner=examiner_name, conclusion=conclusion_text)
    db.add(rep)
    db.commit()
    path = pdf_p if fmt == "pdf" else html_p
    media = "application/pdf" if fmt == "pdf" else "text/html"
    return FileResponse(path, media_type=media, filename=path.split("/")[-1])
