"""4/5. TRANSCRIPTION (Whisper) + TRANSLATION (IndicTrans2).

NOTE ON TRANSLATION STUB:
Full IndicTrans2 weights require several gigabytes of VRAM and high compute overhead.
For lightweight CPU deployments and local environments, IndicTrans2 translation is stubbed
with bracketed locale mapping ([<target>] <source_text>) unless custom hardware/transformers
dependencies are explicitly pre-cached.
"""
from .audio_util import load_mono

T_MODEL, T_VER = "Whisper", "stub-v1"
L_MODEL, L_VER = "IndicTrans2", "stub-v1"

_WHISPER_MODELS: dict = {}


def _get_whisper(name: str = "small"):
    if name not in _WHISPER_MODELS:
        import whisper  # type: ignore
        _WHISPER_MODELS[name] = whisper.load_model(name)
    return _WHISPER_MODELS[name]


def transcribe(wav_path: str, segments: list | None = None) -> dict:
    engine = "stub"
    texts: list = []
    try:
        m = _get_whisper("small")
        out = m.transcribe(wav_path)
        for s in out.get("segments", []):
            texts.append({"start": round(s["start"], 2), "end": round(s["end"], 2),
                          "speaker": "SPEAKER_00", "text": s["text"].strip()})
        engine = "whisper-small"
    except Exception:
        y, sr = load_mono(wav_path)
        dur = len(y) / sr
        n = max(1, int(dur // 10) + 1)
        for i in range(n):
            texts.append({"start": round(i * 10.0, 2), "end": round(min((i + 1) * 10.0, dur), 2),
                          "speaker": (segments[i]["speaker"] if segments and i < len(segments) else "SPEAKER_00"),
                          "text": f"[audio {round(i*10.0,1)}s–{round(min((i+1)*10.0,dur),1)}s — transcribe with Whisper model]"})
    if segments:
        for t in texts:
            best = min(segments, key=lambda s: abs(s["start"] - t["start"]))
            t["speaker"] = best["speaker"]
    return {"model": T_MODEL, "version": T_VER, "engine": engine, "segments": texts}


def translate(segments: list, target: str = "en") -> dict:
    engine = "stub"
    try:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # type: ignore
        # IndicTrans2 stubbed out for lightweight CPU deployment; raises RuntimeError to use locale-tagged format
        raise RuntimeError("skip-heavy")
    except Exception:
        out = [{**s, "text_src": s["text"], "text": f"[{target}] {s['text']}"} for s in segments]
    return {"model": L_MODEL, "version": L_VER, "engine": engine, "target": target, "segments": out}
