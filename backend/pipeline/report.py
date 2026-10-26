"""9. REPORT GENERATION — HTML via Jinja2 + PDF via fpdf2. Includes 65B/63 fields."""
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
    pdf.set_font("Helvetica", "B", 16)
    pdf.multi_cell(0, 10, "Forensic Audio Examination Report",
                   new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)

    def _wrap(tok: str, n: int = 60) -> str:
        # fpdf2 cannot break very long unspaced tokens; chunk them
        parts = []
        for w in str(tok).split(" "):
            while len(w) > n:
                parts.append(w[:n])
                w = w[n:]
            parts.append(w)
        return " ".join(parts)

    for line in [f"Run: {run_id}", f"Examiner: {examiner}", f"Evidence: {evidence}",
                 f"SHA-256: {ev_hash}", f"Conclusion: {conclusion}",
                 "Certificate u/s 65B IEA / 63 BSA: Part-A hashes above; Part-B certified.",
                 "NOTE: decision-support only; examiner approval required."]:
        pdf.multi_cell(0, 6, _wrap(line), new_x="LMARGIN", new_y="NEXT")
    pdf.output(str(pdf_p))
    return str(html_p), str(pdf_p)
