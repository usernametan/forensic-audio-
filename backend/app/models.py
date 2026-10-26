"""Relational schema. Every file row carries SHA-256 + parent linkage."""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Float, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base


def uid() -> str:
    return uuid.uuid4().hex[:12]


class EvidenceFile(Base):
    __tablename__ = "evidence_files"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    kind: Mapped[str] = mapped_column(String(16))  # evidence | specimen
    original_filename: Mapped[str] = mapped_column(String(512))
    stored_path: Mapped[str] = mapped_column(String(1024))
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    bytes: Mapped[int] = mapped_column(Integer)
    codec: Mapped[str] = mapped_column(String(64), default="")
    sample_rate: Mapped[int] = mapped_column(Integer, default=0)
    channels: Mapped[int] = mapped_column(Integer, default=0)
    duration_s: Mapped[float] = mapped_column(Float, default=0.0)
    # chain-of-custody / panch questionnaire
    source: Mapped[str] = mapped_column(Text, default="")
    collected_at: Mapped[str] = mapped_column(String(64), default="")
    collector: Mapped[str] = mapped_column(String(256), default="")
    panoch_notes: Mapped[str] = mapped_column(Text, default="")  # questionnaire/keywords JSON string
    soundproof_flag: Mapped[str] = mapped_column(String(16), default="unknown")  # for specimens
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WorkingCopy(Base):
    __tablename__ = "working_copies"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence_files.id"), index=True)
    path: Mapped[str] = mapped_column(String(1024))
    sha256: Mapped[str] = mapped_column(String(64))
    derived_from: Mapped[str] = mapped_column(String(1024), default="original")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SpeakerProfile(Base):
    __tablename__ = "speaker_profiles"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    run_id: Mapped[str] = mapped_column(String(32), index=True)
    label: Mapped[str] = mapped_column(String(64))  # SPEAKER_00 / suspect name
    kind: Mapped[str] = mapped_column(String(16))  # questioned | known
    embedding_path: Mapped[str] = mapped_column(String(1024), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence_files.id"), index=True)
    specimen_ids: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    status: Mapped[str] = mapped_column(String(32), default="queued")  # queued|running|needs_review|approved|failed
    current_stage: Mapped[str] = mapped_column(String(64), default="queued")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str] = mapped_column(Text, default="")
    approved_by: Mapped[str] = mapped_column(String(256), default="")
    conclusion: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StageOutput(Base):
    __tablename__ = "stage_outputs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    run_id: Mapped[str] = mapped_column(ForeignKey("pipeline_runs.id"), index=True)
    stage: Mapped[str] = mapped_column(String(64), index=True)  # denoise|diarize|compare|...
    output_path: Mapped[str] = mapped_column(String(1024), default="")
    sha256: Mapped[str] = mapped_column(String(64), default="")
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    model_name: Mapped[str] = mapped_column(String(256), default="")
    model_version: Mapped[str] = mapped_column(String(64), default="")
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    run_id: Mapped[str] = mapped_column(String(32), index=True, default="")
    evidence_id: Mapped[str] = mapped_column(String(32), index=True, default="")
    actor: Mapped[str] = mapped_column(String(128), default="system")
    action: Mapped[str] = mapped_column(String(256))
    input_path: Mapped[str] = mapped_column(String(1024), default="")
    input_hash: Mapped[str] = mapped_column(String(64), default="")
    output_path: Mapped[str] = mapped_column(String(1024), default="")
    output_hash: Mapped[str] = mapped_column(String(64), default="")
    tool: Mapped[str] = mapped_column(String(256), default="")
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Transcript(Base):
    __tablename__ = "transcripts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    run_id: Mapped[str] = mapped_column(ForeignKey("pipeline_runs.id"), index=True)
    lang: Mapped[str] = mapped_column(String(16), default="auto")
    segments: Mapped[list] = mapped_column(JSON, default=list)  # [{start,end,speaker,text}]
    translated_segments: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=uid)
    run_id: Mapped[str] = mapped_column(ForeignKey("pipeline_runs.id"), index=True)
    html_path: Mapped[str] = mapped_column(String(1024), default="")
    pdf_path: Mapped[str] = mapped_column(String(1024), default="")
    html_hash: Mapped[str] = mapped_column(String(64), default="")
    pdf_hash: Mapped[str] = mapped_column(String(64), default="")
    examiner: Mapped[str] = mapped_column(String(256), default="")
    conclusion: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
