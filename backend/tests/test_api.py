import io
import time
import wave
import numpy as np
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def _wav(freq=440.0, dur=2.0, sr=16000):
    t = np.linspace(0, dur, int(sr * dur), False)
    y = (0.3 * np.sin(2 * np.pi * freq * t)).astype(np.float32)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((y * 32767).astype(np.int16).tobytes())
    buf.seek(0)
    return buf


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_upload_runs_pipeline_and_gates_export():
    r = client.post("/evidence/upload", files={"evidence": ("ev.wav", _wav(440.0), "audio/wav")},
                    data={"questionnaire": '{"q": ["did suspect say hello?"]}',
                          "source": "PS Crime Branch", "collector": "Inspector Roy"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "run_id" in data
    assert "evidence_id" in data
    assert len(data["sha256"]) == 64
    run_id = data["run_id"]
    evidence_id = data["evidence_id"]

    # Verify evidence metadata endpoint
    ev_res = client.get(f"/evidence/{evidence_id}")
    assert ev_res.status_code == 200
    ev_data = ev_res.json()
    assert ev_data["filename"] == "ev.wav"
    assert ev_data["source"] == "PS Crime Branch"

    # Poll status until pipeline completes or fails
    for _ in range(60):
        s = client.get(f"/pipeline/{run_id}/status").json()
        if s["status"] in ("needs_review", "failed"):
            break
        time.sleep(1)
    assert s["status"] == "needs_review", s
    assert s["progress"] == 100

    # Verify review data
    rev = client.get(f"/review/{run_id}")
    assert rev.status_code == 200
    rev_data = rev.json()
    assert rev_data["status"] == "needs_review"
    assert "denoise" in rev_data["stages"]
    assert "diarize" in rev_data["stages"]
    assert "acoustic" in rev_data["stages"]
    assert "integrity" in rev_data["stages"]
    assert len(rev_data["working_copy"]["sha256"]) == 64

    # Export must be gated before approval
    e = client.get(f"/export/{run_id}?fmt=html")
    assert e.status_code == 409

    # Approve with examiner and conclusion
    a = client.put(f"/review/{run_id}", json={
        "examiner": "Dr. V. Sharma, Forensic Audio Examiner",
        "approved": True,
        "conclusion": "Specimen verified. Integrity preserved under audit."
    })
    assert a.status_code == 200
    assert a.json()["status"] == "approved"
    assert a.json()["approved_by"] == "Dr. V. Sharma, Forensic Audio Examiner"

    # Export HTML report
    e_html = client.get(f"/export/{run_id}?fmt=html")
    assert e_html.status_code == 200
    assert "65B" in e_html.text
    assert "Dr. V. Sharma" in e_html.text

    # Export PDF report
    e_pdf = client.get(f"/export/{run_id}?fmt=pdf")
    assert e_pdf.status_code == 200
    assert e_pdf.headers["content-type"] == "application/pdf"
    assert len(e_pdf.content) > 100


def test_upload_with_specimen_voice_comparison():
    r = client.post("/evidence/upload",
                    files=[
                        ("evidence", ("questioned.wav", _wav(300.0, dur=1.5), "audio/wav")),
                        ("specimens", ("reference.wav", _wav(320.0, dur=1.5), "audio/wav")),
                    ],
                    data={"source": "Court Exhibit Ex-4A", "collector": "IO Kumar"})
    assert r.status_code == 200
    run_id = r.json()["run_id"]
    assert len(r.json()["specimen_ids"]) == 1

    for _ in range(60):
        s = client.get(f"/pipeline/{run_id}/status").json()
        if s["status"] in ("needs_review", "failed"):
            break
        time.sleep(1)
    assert s["status"] == "needs_review", s

    rev = client.get(f"/review/{run_id}").json()
    compare_metrics = rev["stages"]["compare"]["metrics"]
    assert "comparisons" in compare_metrics
    assert len(compare_metrics["comparisons"]) == 1
    cmp0 = compare_metrics["comparisons"][0]
    assert "auto_cosine" in cmp0
    assert "fused_score" in cmp0
    assert "verbal" in cmp0


def test_upload_invalid_file_extension():
    r = client.post("/evidence/upload",
                    files={"evidence": ("malicious.exe", b"not audio data", "application/octet-stream")})
    assert r.status_code == 400
    assert "Unsupported file format" in r.json()["detail"]


def test_upload_invalid_specimen_extension():
    r = client.post("/evidence/upload",
                    files=[
                        ("evidence", ("questioned.wav", _wav(300.0, dur=1.0), "audio/wav")),
                        ("specimens", ("bad_specimen.txt", b"plain text", "text/plain")),
                    ])
    assert r.status_code == 400
    assert "Unsupported specimen file format" in r.json()["detail"]


def test_denoise_snr_handles_mismatched_lengths():
    from backend.pipeline.denoise import run as run_denoise
    import tempfile, soundfile as sf
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f_in, \
         tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f_out:
        in_path, out_path = f_in.name, f_out.name
    y = np.sin(2 * np.pi * 440 * np.linspace(0, 1, 16000)).astype(np.float32)
    sf.write(in_path, y, 16000)
    res = run_denoise(in_path, out_path)
    assert "snr_proxy_db" in res
    assert res["snr_proxy_db"] != float("inf")



def test_reference_recomparison_transcript_and_translation_invalidate_approval():
    r = client.post("/evidence/upload",
                    files={"evidence": ("recompare.wav", _wav(360.0, dur=1.5), "audio/wav")},
                    data={"source": "Court Exhibit", "collector": "IO Sen"})
    assert r.status_code == 200, r.text
    run_id = r.json()["run_id"]

    for _ in range(60):
        s = client.get(f"/pipeline/{run_id}/status").json()
        if s["status"] in ("needs_review", "failed"):
            break
        time.sleep(1)
    assert s["status"] == "needs_review", s

    # Attach a reference later and re-run comparison.
    c = client.post(
        f"/pipeline/{run_id}/compare",
        files={"specimen": ("late-reference.wav", _wav(380.0, dur=1.2), "audio/wav")},
    )
    assert c.status_code == 200, c.text
    compare_body = c.json()
    assert compare_body["run_status"] == "needs_review"
    assert compare_body["comparison"]["specimen_file"] == "late-reference.wav"
    assert compare_body["specimen"]["filename"] == "late-reference.wav"
    assert len(compare_body["specimen"]["sha256"]) == 64

    review = client.get(f"/review/{run_id}").json()
    assert review["stages"]["compare"]["metrics"]["comparisons"][0]["specimen_file"] == "late-reference.wav"

    # Approve, then edit transcript: approval must be invalidated.
    approved = client.put(f"/review/{run_id}", json={
        "examiner": "Examiner A",
        "approved": True,
        "conclusion": "Draft approval for regression test.",
    })
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    tr = review["transcript"]
    assert tr, review
    edited = [{**tr[0], "text": "corrected text", "review_status": "reviewed"}]
    saved = client.put(f"/review/{run_id}/transcript", json={"segments": edited})
    assert saved.status_code == 200, saved.text
    assert saved.json()["status"] == "needs_review"
    after_edit = client.get(f"/review/{run_id}").json()
    assert after_edit["translated"] == []
    assert "translate" not in after_edit["stages"]

    translated = client.post(f"/review/{run_id}/translate", json={"target": "hi"})
    assert translated.status_code == 200, translated.text
    body = translated.json()
    assert body["target"] == "hi"
    assert body["segments"]
    assert body["status"] == "needs_review"
    after_translation = client.get(f"/review/{run_id}").json()
    assert after_translation["stages"]["translate"]["metrics"]["target"] == "hi"
    assert after_translation["stages"]["translate"]["metrics"]["engine"] == body["engine"]

    bad_target = client.post(f"/review/{run_id}/translate", json={"target": "fr"})
    assert bad_target.status_code == 400

    bad_time = client.put(f"/review/{run_id}/transcript", json={
        "segments": [{"start": 5, "end": 1, "speaker": "SPEAKER_00", "text": "bad"}]
    })
    assert bad_time.status_code == 400
