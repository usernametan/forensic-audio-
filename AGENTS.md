# AGENTS.md — Automated Court-Ready Audio Forensics & Speaker ID (India)

Greenfield repo. Target: upload evidence + optional suspect specimens → auto pipeline → expert review → court-ready PDF/HTML report admissible under Section 65B Indian Evidence Act / Section 63 BSA 2023.

## Non-negotiable forensic rules (never shortcut)

- Original evidence is read-only, never processed in place. On upload: store original, compute SHA-256 immediately, create separate working copy; process only the copy. Preserve original → working copies → intermediates → final outputs linkage.
- Hash SHA-256 at upload, each significant intermediate, and export. Report must carry hashes for Part-A / Part-B 65B/63 certificate.
- Immutable audit log on every operation: evidence ID, input/output file + hash, software/model name+version, params, timestamp, examiner action. No silent defaults.
- System is decision-support only. Automated outputs (similarity scores, integrity flags, transcripts) require certified examiner review + explicit approval before report sign-off. Interpret conservatively; state only what examination supports.
- Never claim 100% auto segregation on overlapping / telephonic / low-voice / tampered / deepfake audio — flag limitations and require manual check.

## Mandatory pipeline order + pinned models

Follow `audio_forensics.drawio.png` exactly:

1. Denoising — DeepFilterNet (adaptive; detect hum/hiss/clipping first, avoid over-processing/artifacts)
2. Diarization — pyannote.audio (speaker labels + timestamps; overlapping speakers expected to be imperfect)
3. Voice comparison — SpeechBrain ECAPA-TDNN embeddings + acoustic-phonetic (F0/pitch, formants, vowels, MFCCs, speaking rate). Combine auditory + acoustic + automated; never single-metric.
4. Transcription — Whisper, timestamp- + speaker-aligned, original language
5. Translation — IndicTrans2, contextual, preserve speaker/timestamp refs
6. Voice/Acoustic analysis (Praat/librosa: pitch, formants, MFCCs, spectra) AND 7. Integrity analysis (metadata/codec, ENF, splice/edit, anomaly, deepfake flags) — parallel branches
7. Expert Review (human validation) → 9. Report generation (PDF/HTML)

Plan processing sequence from diagnosed problem (ROI → noise classification → filter recommendation → param optimization → SNR/artifact validation → repeat), not blind filtering. Warn when processing may remove speech info.

## Intended stack & layout (do not drift without reason)

- Frontend: React/Next.js — Upload Ingest, Pipeline Dashboard, Review Station, Report Previewer.
- Backend: Python FastAPI for ML/audio; PostgreSQL + object storage (audio/logs). Heavy models async (background jobs + progress polling), never block upload request.
- Suggested paths: `frontend/`, `backend/api/`, `backend/pipeline/{denoise,diarize,compare,transcribe,translate,acoustic,integrity,report}/`, `backend/storage/`, `tests/`.

## API + DB essentials

- APIs: `POST /evidence/upload` (evidence + specimen + panch questionnaire/keywords), `GET /pipeline/:runId/status`, `GET/PUT /review/:runId` (ROI, overrides, approval), `GET /export/:runId` (PDF/HTML + hashes).
- Core tables: EvidenceFiles, WorkingCopies, SpeakerProfiles (questioned vs known/specimen, soundproof flag), PipelineRuns + stage outputs, AuditLogs, Transcripts/Translations, Reports/Certificates. Every file row carries SHA-256 + parent linkage.

## Review Station + Report must-haves

- Review: synchronized dual waveform + spectrogram (original vs processed), ROI selection, keyword/vowel extraction vs questionnaire, A/B playback, param sliders producing new logged versions, model confidence/uncertainty display, approve/reject gate.
- Report: evidence details, chain of custody, methodology + tool/param versions, SHA-256 verification, SNR/RMS/peak/clipping before-after, diarization + similarity metrics, transcript + translation, spectrogram plots, integrity findings, limitations, examiner conclusion + signature block, 65B/63 certificate fields.

## Validation & difficult conditions

- Expect: background noise/hum, overlap, short/low-level speech, clipping, lossy transcode, device/channel mismatch, multilingual/accent. Detect/flag them; don't assume denoise fixes all.
- Validate on independent labelled data (clean/noisy, overlap, codecs, reverb, clipping, positive+negative cases). Metrics: accuracy/precision/recall/F1 per detection task; SNR + intelligibility + artifact + expert listening for enhancement. Must be repeatable (same input+settings → same result) and reproducible from logs.
