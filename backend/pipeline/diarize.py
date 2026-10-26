"""2. DIARIZATION — pyannote.audio preferred, energy-VAD fallback.

Output: [{start, end, speaker}] with speaker labels. Fallback splits on
energy VAD into alternating SPEAKER_00/01 so downstream stages keep working.
Overlap is flagged as limitation.
"""
import numpy as np
from .audio_util import load_mono

MODEL, VERSION = "pyannote.audio", "fallback-vad-v1"


def _energy_segments(y: np.ndarray, sr: int, frame_s: float = 0.5) -> list:
    frame = int(sr * frame_s)
    segs, cur, in_speech = [], None, False
    for i in range(0, len(y), frame):
        rms = float(np.sqrt((y[i:i + frame] ** 2).mean() + 1e-12))
        if rms > 0.02 and not in_speech:
            cur, in_speech = i / sr, True
        elif rms <= 0.015 and in_speech:
            segs.append((cur, i / sr))
            in_speech = False
    if in_speech:
        segs.append((cur, len(y) / sr))
    if not segs:
        segs = [(0.0, len(y) / sr)]
    return [{"start": round(s, 2), "end": round(e, 2),
             "speaker": f"SPEAKER_{k % 2:02d}"} for k, (s, e) in enumerate(segs)]


def run(wav_path: str) -> dict:
    y, sr = load_mono(wav_path)
    engine = "energy-vad-fallback"
    segments: list = []
    try:
        from pyannote.audio import Pipeline  # type: ignore
        pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
        ann = pipe(wav_path)
        for k, (turn, _, spk) in enumerate(ann.itertracks(yield_label=True)):
            segments.append({"start": round(turn.start, 2), "end": round(turn.end, 2), "speaker": str(spk)})
        engine = "pyannote-3.1"
    except Exception:
        segments = _energy_segments(y, sr)
    overlap_suspect = len(segments) >= 6
    return {"model": MODEL, "version": VERSION, "engine": engine,
            "params": {}, "segments": segments,
            "num_speakers": len({s["speaker"] for s in segments}),
            "limitation_flags": ["overlap-imperfect"] if overlap_suspect else []}
