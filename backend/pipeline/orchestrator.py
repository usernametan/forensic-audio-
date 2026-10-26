"""Pipeline orchestrator — fixed order, hashed intermediates, audit on each step."""
import json
from pathlib import Path
from ..app.db import SessionLocal
from ..app import models
from ..app.hashutil import sha256_file
from ..app.audit import audit
from ..app.storage import output_path
from . import denoise, diarize, compare, transcribe_translate, acoustic_integrity
from .audio_util import spectrogram_png, load_mono


def _save_stage(db, run_id, stage, out_path, metrics, model, version, params):
    h = sha256_file(out_path) if out_path and Path(out_path).exists() else ""
    db.add(models.StageOutput(run_id=run_id, stage=stage,
                              output_path=str(out_path or ""), sha256=h,
                              metrics=metrics, model_name=model,
                              model_version=version, params=params))
    db.commit()
    return h


def _set(db, run, **kw):
    for k, v in kw.items():
        setattr(run, k, v)
    db.commit()


def run_pipeline(run_id: str):
    db = SessionLocal()
    run = db.get(models.PipelineRun, run_id)
    try:
        ev = db.get(models.EvidenceFile, run.evidence_id)
        from ..app.storage import new_working_copy
        _set(db, run, status="running", current_stage="denoise", progress=5, error="")
        wc = new_working_copy(Path(ev.stored_path), run_id)
        wch = sha256_file(wc)
        db.add(models.WorkingCopy(evidence_id=ev.id, path=str(wc), sha256=wch, derived_from="original"))
        db.commit()
        audit(run_id, ev.id, action="working-copy-created", input_path=ev.stored_path,
              input_hash=ev.sha256, output_path=str(wc), output_hash=wch, tool="copy")

        # 1 denoise
        den_path = output_path(run_id, "denoised.wav")
        d = denoise.run(str(wc), str(den_path))
        h = _save_stage(db, run_id, "denoise", den_path, d, d["model"], d["version"], d["params"])
        audit(run_id, ev.id, action="denoise", input_path=str(wc), input_hash=wch,
              output_path=str(den_path), output_hash=h, tool=f"{d['model']} {d['version']}", params=d["params"])
        _set(db, run, current_stage="diarize", progress=25)

        # waveform/spectrogram of original vs processed
        y0, s0 = load_mono(str(wc))
        spec_orig = output_path(run_id, "spec_original.png")
        spectrogram_png(y0, s0, str(spec_orig), "original spectrogram")

        # 2 diarize
        dz = diarize.run(str(den_path))
        _save_stage(db, run_id, "diarize", den_path, dz, dz["model"], dz["version"], dz["params"])
        audit(run_id, ev.id, action="diarize", input_path=str(den_path), input_hash=h,
              tool=f"{dz['model']} {dz['engine']}", params={})
        _set(db, run, current_stage="compare", progress=40)

        # 3 compare vs each specimen
        spec_ids = json.loads(run.specimen_ids or "[]")
        comps = []
        for sid in spec_ids:
            sp = db.get(models.EvidenceFile, sid)
            if not sp:
                continue
            c = compare.compare(str(den_path), sp.stored_path)
            comps.append({"specimen_id": sid, "specimen_file": sp.original_filename, **c})
        _save_stage(db, run_id, "compare", den_path,
                    {"comparisons": comps}, compare.MODEL, compare.VERSION, {})
        _set(db, run, current_stage="transcribe", progress=55)

        # 4/5 transcribe + translate
        tr = transcribe_translate.transcribe(str(den_path), dz["segments"])
        db.add(models.Transcript(run_id=run_id, lang="auto", segments=tr["segments"], translated_segments=[]))
        db.commit()
        _save_stage(db, run_id, "transcribe", den_path, tr, tr["model"], tr["version"], {})
        tl = transcribe_translate.translate(tr["segments"], "en")
        trow = db.query(models.Transcript).filter_by(run_id=run_id).first()
        trow.translated_segments = tl["segments"]
        db.commit()
        _save_stage(db, run_id, "translate", den_path, tl, tl["model"], tl["version"], {})
        _set(db, run, current_stage="acoustic+integrity", progress=75)

        # 6/7 parallel branches
        spec_proc = output_path(run_id, "spec_processed.png")
        ac = acoustic_integrity.acoustic(str(den_path), str(spec_proc))
        _save_stage(db, run_id, "acoustic", spec_proc, ac, ac["model"], ac["version"], {})
        ig = acoustic_integrity.integrity(ev.stored_path, str(den_path))
        _save_stage(db, run_id, "integrity", den_path, ig, ig["model"], ig["version"], {})
        _set(db, run, current_stage="needs_review", progress=100, status="needs_review", error="")
        audit(run_id, ev.id, action="pipeline-complete-needs-review", tool="orchestrator")
    except Exception as e:
        run = db.get(models.PipelineRun, run_id)
        _set(db, run, status="failed", error=str(e)[:2000])
        audit(run_id, "", action=f"pipeline-failed: {e}", tool="orchestrator")
    finally:
        db.close()
