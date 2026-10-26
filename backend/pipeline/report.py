"""9. REPORT GENERATION — HTML via Jinja2 + PDF via fpdf2. Includes 65B/63 fields."""
import json
from pathlib import Path
from datetime import datetime
from jinja2 import Template
from fpdf import FPDF
from ..app.hashutil import sha256_file
from ..app.storage import output_path

HTML_TMPL = """<html><head><meta charset="utf-8"><title>Forensic Audio Report {{run_id}}</title></head>
<body style="font-family:sans-serif;max-width:900px;margin:auto">
<h1>Forensic Audio Examination Report</h1>
<p><b>Run:</b> {{run_id}} | <b>Date:</b> {{date}} | <b>Examiner:</b> {{examiner}}</p>
<h2>1. Evidence details & chain of custody</h2>
<p>Evidence: {{evidence}} (SHA-256: {{ev_hash}})<br>Working copy SHA-256: {{wc_hash}}<br>
Specimens: {{specimens}}</p>
<h2>2. Methodology & tools</h2><ul>{% for s in stages %}<li>{{s.stage}} — {{s.model}} {{s.version}} params={{s.params}}</li>{% endfor %}</ul>
<h2>3. SHA-256 verification</h2><ul>{% for s in stages %}<li>{{s.stage}}: {{s.sha256}}</li>{% endfor %}</ul>
<h2>4. Acoustic findings</h2><pre>{{acoustic}}</pre>
<h2>5. Diarization & similarity</h2><pre>{{compare}}</pre>
<h2>6. Transcript (original)</h2>{% for s in transcript %}<p>[{{s.start}}–{{s.end}} {{s.speaker}}] {{s.text}}</p>{% endfor %}
<h2>7. Translation (en)</h2>{% for s in translated %}<p>[{{s.start}}–{{s.end}} {{s.speaker}}] {{s.text}}</p>{% endfor %}
<h2>8. Integrity findings</h2><pre>{{integrity}}</pre>
<h2>9. Limitations</h2><p>Automated outputs are decision-support only. Overlap/telephonic/low-voice/tampered/deepfake
segments require manual verification. State only what examination supports.</p>
<h2>10. Examiner conclusion & signature</h2><p>{{conclusion}}</p><p>Signature: ______________ ({{examiner}})</p>
<h2>11. Certificate u/s 65B Indian Evidence Act / 63 BSA 2023</h2>
<p>Part-A: hash of electronic record stated above. Part-B: I, {{examiner}}, certify the output is produced
by the system in ordinary course, with integrity preserved per audit log. Date: {{date}}</p>
</body></html>"""


def build(run_id, evidence, ev_hash, wc_hash, specimens, stages, acoustic,
          compare_, transcript, translated, integrity, examiner, conclusion) -> tuple[str, str]:
    html_p = output_path(run_id, "report.html")
    pdf_p = output_path(run_id, "report.pdf")
    html = Template(HTML_TMPL).render(
        run_id=run_id, date=datetime.utcnow().isoformat(), examiner=examiner,
        evidence=evidence, ev_hash=ev_hash, wc_hash=wc_hash, specimens=specimens,
        stages=stages, acoustic=acoustic, compare=compare_, transcript=transcript,
        translated=translated, integrity=integrity, conclusion=conclusion)
    Path(html_p).write_text(html, encoding="utf-8")
    pdf = FPDF()
    pdf.set_auto_page_break(True, 20)
    pdf.set_margins(15, 15, 15)
    pdf.add_page()

    def _clean(tok: str) -> str:
        if not tok:
            return ""
        return (str(tok)
                .replace("—", " - ")
                .replace("–", "-")
                .replace("•", "*")
                .replace("’", "'")
                .replace("‘", "'")
                .replace("“", '"')
                .replace("”", '"')
                .encode("latin-1", "replace")
                .decode("latin-1"))

    def _wrap(tok: str, n: int = 70) -> str:
        parts = []
        for w in _clean(tok).split(" "):
            while len(w) > n:
                parts.append(w[:n])
                w = w[n:]
            parts.append(w)
        return " ".join(parts)

    def heading(text: str):
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(15, 35, 60)
        pdf.ln(3)
        pdf.multi_cell(0, 7, _clean(text), new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(34, 211, 238)
        pdf.line(15, pdf.get_y(), 60, pdf.get_y())
        pdf.ln(2)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(40, 45, 55)

    def kv(k: str, v: str):
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(80, 90, 105)
        pdf.cell(50, 5, _wrap(k, 30))
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(25, 30, 40)
        pdf.multi_cell(0, 5, _wrap(str(v), 80), new_x="LMARGIN", new_y="NEXT")

    # Letterhead
    pdf.set_font("Helvetica", "B", 15)
    pdf.set_text_color(10, 25, 45)
    pdf.cell(0, 8, "FORENSIC AUDIO EXAMINATION REPORT", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(100, 110, 125)
    pdf.cell(0, 5, "Digital Forensics Division - Admissible u/s 65B Indian Evidence Act / Section 63 BSA 2023", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    # 1. Chain of custody
    heading("1. Evidence Details & Chain of Custody")
    kv("Run ID", run_id)
    kv("Evidence Exhibit", evidence)
    kv("Evidence SHA-256", ev_hash)
    kv("Working Copy SHA-256", wc_hash)
    kv("Reference Specimens", json.dumps(specimens) if isinstance(specimens, (list, dict)) else str(specimens))
    kv("Certifying Examiner", examiner)

    # 2. Methodology & Hashed Intermediates
    heading("2. Methodology & Cryptographic Hashes")
    for s in stages:
        stg = s.get("stage", "stage")
        hsh = s.get("sha256", "n/a")
        mod = f"{s.get('model', '')} ({s.get('version', '')})"
        kv(f"Stage: {stg}", f"{mod} | SHA-256: {hsh[:24]}...")

    # 3. Acoustic Analysis
    heading("3. Acoustic-Phonetic Findings")
    if acoustic:
        kv("Pitch (F0 Mean)", f"{acoustic.get('f0_mean', '-')} Hz (Std: {acoustic.get('f0_std', '-')} Hz)")
        kv("Spectral Centroid", f"{acoustic.get('spectral_centroid', '-')} Hz")
        kv("Speaking Rate Proxy", f"{acoustic.get('speaking_rate_proxy', '-')} syl/s")
        lv = acoustic.get("levels", {})
        kv("Levels (Peak / RMS)", f"Peak: {lv.get('peak', 0):.3f} / RMS: {lv.get('rms', 0):.4f}")

    # 4. Voice Comparison
    heading("4. Voice Comparison & Speaker ID")
    if compare_:
        cmps = compare_.get("comparisons", [])
        if cmps:
            for c in cmps:
                kv("Specimen", c.get("specimen_file", c.get("specimen_id", "specimen")))
                kv("Similarity Metric", f"Cosine: {c.get('auto_cosine', 0):.4f} | Fused: {c.get('fused_score', 0):.4f}")
                kv("Assessment", c.get("verbal", "inconclusive"))
        else:
            kv("Automated Score", f"{compare_.get('auto_cosine', '-')}")
            kv("Hypothesis Assessment", compare_.get("verbal", "No specimen compared"))

    # 5. Transcript & Translation
    heading("5. Transcribed Speech (Whisper / Aligned)")
    for s in (transcript or [])[:10]:
        t_line = f"[{s.get('start', 0.0)}s - {s.get('end', 0.0)}s | {s.get('speaker', 'SPK')}]: {s.get('text', '')}"
        pdf.multi_cell(0, 4.5, _wrap(t_line, 95), new_x="LMARGIN", new_y="NEXT")

    if len(transcript or []) > 10:
        pdf.cell(0, 4.5, f"... and {len(transcript) - 10} additional speech segments recorded.", new_x="LMARGIN", new_y="NEXT")

    # 6. Integrity & Limitations
    heading("6. Integrity & Limitations")
    for flg in (integrity.get("flags", []) if integrity else []):
        pdf.multi_cell(0, 4.5, _wrap(f"* {flg}", 90), new_x="LMARGIN", new_y="NEXT")
    pdf.multi_cell(0, 4.5, _wrap("* Limitation Notice: Automated AI outputs are decision-support only. Certified examiner review is required before court presentation.", 90), new_x="LMARGIN", new_y="NEXT")

    # 7. Conclusion & Certificate
    heading("7. Examiner Conclusion & Certificate u/s 65B IEA / 63 BSA 2023")
    pdf.multi_cell(0, 4.5, _wrap(conclusion or "Forensic audio examination completed in ordinary course. Admissible electronic record.", 90), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    cert_text = (
        f"CERTIFICATE: I, {examiner}, hereby certify under Section 65B of the Indian Evidence Act, 1872 / "
        f"Section 63 of the Bharatiya Sakshya Adhiniyam, 2023, that Exhibit {evidence} was received, cryptographically "
        f"fingerprinted (SHA-256: {ev_hash}), and processed in the regular course of computer operations with integrity intact."
    )
    pdf.set_font("Helvetica", "I", 8)
    pdf.multi_cell(0, 4.2, _wrap(cert_text, 95), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(0, 5, f"Examiner Signature: _______________________ ({examiner})", new_x="LMARGIN", new_y="NEXT")

    pdf.output(str(pdf_p))
    return str(html_p), str(pdf_p)
