"""4/5. TRANSCRIPTION (Whisper) + TRANSLATION (IndicTrans2), with stubs."""
from .audio_util import load_mono

T_MODEL, T_VER = "Whisper", "stub-v1"
L_MODEL, L_VER = "IndicTrans2", "stub-v1"


def transcribe(wav_path: str, segments: list | None = None) -> dict:
    engine = "stub"
    texts: list = []
    try:
        import whisper  # type: ignore
        m = whisper.load_model("small")
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
        raise RuntimeError("skip-heavy")  # use stub unless model cached
    except Exception:
        out = [{**s, "text_src": s["text"], "text": f"[{target}] {s['text']}"} for s in segments]
    return {"model": L_MODEL, "version": L_VER, "engine": engine, "target": target, "segments": out}
