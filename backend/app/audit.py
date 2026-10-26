from datetime import datetime
from .db import SessionLocal
from .models import AuditLog


def audit(run_id: str = "", evidence_id: str = "", actor: str = "system",
          action: str = "", input_path: str = "", input_hash: str = "",
          output_path: str = "", output_hash: str = "", tool: str = "",
          params: dict | None = None):
    db = SessionLocal()
    try:
        db.add(AuditLog(
            run_id=run_id, evidence_id=evidence_id, actor=actor, action=action,
            input_path=input_path, input_hash=input_hash,
            output_path=output_path, output_hash=output_hash,
            tool=tool, params=params or {},
        ))
        db.commit()
    finally:
        db.close()
