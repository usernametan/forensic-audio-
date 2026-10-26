# Forensic Audio Evidence Analysis Platform

Automated, court-ready audio forensic examination and speaker verification suite compliant with **Section 65B of the Indian Evidence Act** and **Section 63 of the Bharatiya Sakshya Adhiniyam (BSA) 2023**.

The platform provides an end-to-end laboratory workflow: exhibit intake, cryptographic SHA-256 hashing, adaptive noise reduction, speech enhancement, speaker separation (diarization), acoustic-phonetic & embedding voice comparison, multilingual transcription/translation, examiner review gating, and court certificate generation.

---

## Key Features

- **Chain of Custody & Immutability:**
  - Original evidence files are preserved read-only and never modified in place.
  - Cryptographic SHA-256 fingerprinting calculated immediately upon upload (both in-browser via Web Crypto and server-side).
  - Every derived intermediate (working copy, denoised extract, spectrograms, report) is hashed and linked.
  - Immutable audit trail recording actor, action, file hashes, tool versions, and timestamps.
- **Signal Processing & Pluggable AI Pipeline:**
  - **Denoising:** DeepFilterNet with adaptive spectral-subtraction fallback, hum/hiss detection, and artifact warnings.
  - **Diarization:** pyannote.audio with energy-VAD fallback providing speaker segmentation and talk-time clustering.
  - **Speaker Comparison:** SpeechBrain ECAPA-TDNN deep embedding cosine similarity fused with acoustic-phonetic pitch (F0 mean/std) and MFCC spectral distance.
  - **Transcription & Translation:** OpenAI Whisper ASR aligned to speaker turns; IndicTrans2 translation for English, Hindi, and Marathi.
  - **Acoustic & Integrity Diagnostics:** Praat/librosa pitch contours, formants, spectral centroid, zero-crossing rate, clipping detection, splice jump heuristics, and ENF/deepfake warning flags.
- **Human-in-the-Loop (HITL) Decision Support:**
  - Automated outputs are strictly advisory; automated segregation or identification is never claimed without certified examiner confirmation.
  - Export of court-ready reports is cryptographically locked (HTTP 409 Conflict) until an examiner explicitly reviews and approves the findings.
- **Admissible Court Documentation:**
  - Generates Section 65B IEA / Section 63 BSA Part-A (hash verification) and Part-B (examiner ordinary course certificate) reports.
  - Dual export formats: Official server-side PDF / HTML reports + interactive client-side PDF export via jsPDF.

---

## Technology Stack

- **Frontend:**
  - React 18 (SPA)
  - Vite 5 (Bundler & dev server with reverse proxy)
  - Lucide React (Forensic & laboratory iconography)
  - jsPDF (Client-side report assembly)
  - Custom Vanilla CSS Design System (Dark glassmorphism, responsive waveforms, interactive spectrogram viewers)
- **Backend:**
  - Python 3.11+
  - FastAPI (REST API with async pipeline orchestration)
  - SQLAlchemy 2.0 (Relational ORM for evidence, runs, audit logs, and reports)
  - SQLite (Default zero-config database) / PostgreSQL (Supported via `FAA_DATABASE_URL`)
- **Audio Processing & Machine Learning:**
  - `soundfile`, `scipy`, `numpy` (Core audio I/O and numerical processing)
  - `librosa` (STFT, spectrograms, MFCCs, pitch tracking via pyin)
  - `matplotlib` (Headless Agg rendering of high-resolution spectrogram PNGs)
  - `jinja2` & `fpdf2` (Official court report HTML & PDF generation)
  - Optional heavy models: `deepfilternet`, `pyannote.audio`, `speechbrain`, `whisper`, `transformers`
- **Testing & Verification:**
  - `pytest` & `pytest-asyncio`
  - `fastapi.testclient` / `httpx`

---

## Directory Structure

```
forensic-audio/
├── backend/
│   ├── app/
│   │   ├── audit.py           # Immutable forensic audit logging
│   │   ├── config.py          # Settings and paths
│   │   ├── db.py              # SQLAlchemy database engine & session
│   │   ├── hashutil.py        # SHA-256 file hashing
│   │   ├── main.py            # FastAPI application entrypoint
│   │   ├── models.py          # Database schema (Evidence, Runs, Logs, Reports)
│   │   ├── storage.py         # Original, working, and output storage management
│   │   └── routers/
│   │       ├── evidence.py    # POST /evidence/upload, GET /evidence/{id}
│   │       ├── pipeline_status.py # GET /pipeline/{run_id}/status
│   │       ├── review.py      # GET/PUT /review/{run_id}
│   │       └── export.py      # GET /export/{run_id} (HTML/PDF)
│   ├── pipeline/
│   │   ├── acoustic_integrity.py  # Acoustic metrics & splice/tamper checks
│   │   ├── audio_util.py          # Resampling, SNR, levels, spectrogram PNG
│   │   ├── compare.py             # ECAPA-TDNN & acoustic-phonetic comparison
│   │   ├── denoise.py             # DeepFilterNet & spectral gating
│   │   ├── diarize.py             # pyannote & energy VAD diarization
│   │   ├── orchestrator.py        # Pipeline orchestrator
│   │   ├── report.py              # Jinja2 & fpdf2 court report builder
│   │   └── transcribe_translate.py# Whisper ASR & Indic translation
│   ├── storage/                   # originals, working copies, and outputs
│   ├── tests/
│   │   └── test_api.py        # End-to-end integration tests
│   ├── Dockerfile
│   └── requirements.txt
├── src/
│   ├── components/            # Header, Sidebar, FlowStepper, Waveform, GlassPanel
│   ├── data/
│   │   └── mockData.js        # Baseline forensic schemas & fallback data
│   ├── screens/
│   │   ├── DashboardScreen.jsx     # Case intake & evidence registration
│   │   ├── PreprocessingScreen.jsx # Denoising, spectrograms, audio player, tracks
│   │   ├── ComparisonScreen.jsx    # Speaker comparison & feature indices
│   │   ├── TranscriptionScreen.jsx # Whisper transcript & multi-language translation
│   │   └── ReportScreen.jsx        # Court report & Section 65B/63 certification
│   ├── services/
│   │   └── api.js             # API client & browser SHA-256 hashing
│   ├── styles/
│   │   └── global.css         # Complete UI design system
│   ├── utils/
│   │   └── pdfExport.js       # Client jsPDF report builder
│   ├── App.jsx                # Application root with live API integration
│   └── main.jsx
├── Dockerfile                 # Multi-stage frontend container
├── docker-compose.yml         # Full-stack composition (API, Web, PostgreSQL)
├── package.json
└── vite.config.js             # Vite configuration with backend proxy
```

---

## How to Run the Project

### Prerequisites

- **Python:** Version 3.11+
- **Node.js:** Version 18+ (tested on Node 20 / 24)
- **Virtual Environment tool:** `python3 -m venv`
- **Package Managers:** `pip` and `npm`

---

### Step 1: Install Dependencies

#### Backend Dependencies (from project root):
```bash
python3 -m pip install -r backend/requirements.txt
```

#### Frontend Dependencies (from project root):
```bash
npm install
```

---

### Step 2: Start the Development Services

Run the services in two separate terminals (or as background services).

#### Terminal 1 — Start the FastAPI Backend:
```bash
# Run from repository root
uvicorn backend.app.main:app --reload --port 8000
```
*The backend API will be available at `http://localhost:8000`. Automatic OpenAPI documentation is available at `http://localhost:8000/docs`.*

#### Terminal 2 — Start the Vite Frontend:
```bash
# Run from repository root
npm run dev
```
*The frontend user interface will be available at `http://localhost:5173`.*

The Vite dev server automatically proxies API requests (`/evidence`, `/pipeline`, `/review`, `/export`, `/outputs`, `/health`) to port 8000.

---

### Step 3: Run the Verification Tests

Execute the automated test suite to verify all backend endpoints, async pipeline execution, review gating, and Section 65B/63 report exports:

```bash
# Run pytest from repository root
python3 -m pytest backend/tests -v
```

Build and validate the production frontend bundle:
```bash
npm run build
```

---

### Running via Docker (Optional)

To start the full stack including PostgreSQL:

```bash
docker compose up --build
```
- Frontend (SPA via Nginx): `http://localhost:5173`
- Backend API (FastAPI): `http://localhost:8000`
- PostgreSQL: `localhost:5432`

#### Reverse Proxy Architecture:
Both the Vite development server (`vite.config.js`) and production Docker container (`nginx.conf`) configure a reverse proxy to route frontend calls to the FastAPI backend without CORS friction:
- `/evidence/` — Exhibit uploads and metadata retrieval
- `/pipeline/` — Pipeline execution polling and status checks
- `/review/` — Examiner review gate (approval/rejection)
- `/export/` — Section 65B/63 BSA certified HTML and PDF court report generation
- `/outputs/` — Processed audio extracts and spectrogram visualization PNGs
- `/health` — Backend health check

If deploying to custom reverse proxies (e.g. Traefik, AWS ALB, Cloudflare), replicate these upstream routes targeting the backend on port 8000 with a `client_max_body_size` of at least `100M` for high-resolution forensic audio exhibits.

## Laboratory Workflow & Usage Guide

1. **Screen 01 — Case Registration & Intake:**
   - Enter Case ID (e.g. `CEP-2026-AF-0147`), Case Title, Custody Source, and Seizing Officer.
   - Drag and drop or browse to select the questioned audio file (`.wav`, `.mp3`, `.flac`, `.ogg`, `.m4a`).
   - The browser immediately computes the SHA-256 hash.
   - Click **Begin Analysis**. The exhibit is uploaded to `/evidence/upload`, stored read-only, and the background pipeline is launched.
2. **Screen 02 — Preprocessing & Laboratory:**
   - Watch the pipeline stages complete: Denoising, Diarization, Acoustic Analysis.
   - Inspect the dual spectrogram viewer (Raw Original vs Processed Denoised).
   - Listen to the cleaned audio extract using the integrated audio player.
   - Inspect the diarized speaker tracks with talk times and pitch bands.
3. **Screen 03 — Speaker Comparison:**
   - Stage an authorized reference voice sample (specimen).
   - Review multi-metric feature indices: ECAPA-TDNN deep embedding cosine similarity, F0 pitch contour similarity, and MFCC acoustic distance.
   - View the conservative verbal hypothesis.
4. **Screen 04 — Transcription & Translation:**
   - Review the Whisper ASR transcript aligned to speaker turns.
   - Select target language (English, Hindi, Marathi) and apply translation.
5. **Screen 05 — Forensic Report & Section 65B / 63 BSA Certification:**
   - Review consolidated evidence data, before/after SNR, diarization, and comparison metrics.
   - Fill in the **Examiner Full Name** and **Conservative Conclusion**.
   - Click **Approve & Certify Report**.
   - The official **Section 65B Indian Evidence Act / Section 63 BSA 2023 Certificate** unlocks.
   - Download the official backend-certified PDF or HTML report.

---

## Legal & Compliance Notes

1. **Section 65B / Section 63 BSA Admissibility:** Automated algorithms are decision-support tools only. Under Indian law, an electronic record requires certification by a person occupying a responsible official position in relation to the operation of the relevant device.
2. **Deterministic Fallbacks & Heavy Models:** The pipeline utilizes real models when dependencies are present and deterministic acoustic fallbacks (librosa spectral gating, energy VAD, MFCC cosine) when heavy model weights are uninstalled. Fallbacks are explicitly logged in the audit trail and report.
3. **Translation Stub (IndicTrans2):** Full IndicTrans2 model checkpoints require multi-gigabyte neural weights and dedicated GPU memory. In lightweight CPU deployments and default containers, translation is stubbed with a structured locale mapping prefix (`[<target>] <source_text>`) while maintaining full schema compatibility for court reporting.
