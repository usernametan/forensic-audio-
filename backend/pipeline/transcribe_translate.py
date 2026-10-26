"""4/5. TRANSCRIPTION (Whisper) + TRANSLATION (IndicTrans2).

NOTE ON TRANSLATION STUB:
Full IndicTrans2 weights require several gigabytes of VRAM and high compute overhead.
For lightweight CPU deployments and local environments, IndicTrans2 translation is stubbed
with bracketed locale mapping ([<target>] <source_text>) unless custom hardware/transformers
dependencies are explicitly pre-cached.
"""
import os
from .audio_util import load_mono

T_MODEL, T_VER = "Whisper", "v3"
L_MODEL, L_VER = "IndicTrans2", "v2"

_WHISPER_MODELS: dict = {}


def _get_whisper(name: str = "small"):
    if name not in _WHISPER_MODELS:
        import whisper  # type: ignore
        _WHISPER_MODELS[name] = whisper.load_model(name)
    return _WHISPER_MODELS[name]


def _transcribe_via_api(wav_path: str) -> list | None:
    """Optional cloud API transcription fallback if API key is configured."""
    groq_key = os.environ.get("GROQ_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not (groq_key or openai_key):
        return None

    try:
        import httpx
        url = "https://api.groq.com/openai/v1/audio/transcriptions" if groq_key else "https://api.openai.com/v1/audio/transcriptions"
        token = groq_key or openai_key
        model_name = "whisper-large-v3-turbo" if groq_key else "whisper-1"

        with open(wav_path, "rb") as f:
            files = {"file": (os.path.basename(wav_path), f, "audio/wav")}
            data = {"model": model_name, "response_format": "verbose_json"}
            headers = {"Authorization": f"Bearer {token}"}
            res = httpx.post(url, files=files, data=data, headers=headers, timeout=120)
            if res.status_code == 200:
                payload = res.json()
                segments = []
                for s in payload.get("segments", []):
                    segments.append({
                        "start": round(float(s.get("start", 0.0)), 2),
                        "end": round(float(s.get("end", 0.0)), 2),
                        "speaker": "SPEAKER_00",
                        "text": s.get("text", "").strip(),
                    })
                return segments
    except Exception:
        pass
    return None


def transcribe(wav_path: str, segments: list | None = None) -> dict:
    engine = "stub"
    texts: list = []

    # 1. Try local open-source Whisper first
    try:
        m = _get_whisper("small")
        out = m.transcribe(wav_path)
        for s in out.get("segments", []):
            texts.append({"start": round(s["start"], 2), "end": round(s["end"], 2),
                          "speaker": "SPEAKER_00", "text": s["text"].strip()})
        engine = "whisper-small-local"
    except Exception:
        # 2. Try API key (Groq / OpenAI) if configured
        api_segs = _transcribe_via_api(wav_path)
        if api_segs:
            texts = api_segs
            engine = "whisper-cloud-api"
        else:
            # 3. Fallback time-aligned windowing
            y, sr = load_mono(wav_path)
            dur = len(y) / sr
            n = max(1, int(dur // 10) + 1)
            for i in range(n):
                texts.append({
                    "start": round(i * 10.0, 2),
                    "end": round(min((i + 1) * 10.0, dur), 2),
                    "speaker": (segments[i]["speaker"] if segments and i < len(segments) else "SPEAKER_00"),
                    "text": f"[audio {round(i*10.0,1)}s–{round(min((i+1)*10.0,dur),1)}s — transcribe with Whisper model]"
                })

    if segments:
        for t in texts:
            best = min(segments, key=lambda s: abs(s["start"] - t["start"]))
            t["speaker"] = best["speaker"]

    return {"model": T_MODEL, "version": T_VER, "engine": engine, "segments": texts}


_INDIC_MODELS: dict = {}


def _get_indictrans(model_name: str = "ai4bharat/indictrans2-indic-en-1B"):
    if model_name not in _INDIC_MODELS:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # type: ignore
        tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name, trust_remote_code=True)
        _INDIC_MODELS[model_name] = (tokenizer, model)
    return _INDIC_MODELS[model_name]


def _translate_via_api(segments: list, target: str = "en") -> list | None:
    """Optional cloud API translation if API key is provided."""
    groq_key = os.environ.get("GROQ_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not (groq_key or openai_key):
        return None

    try:
        import httpx
        url = "https://api.groq.com/openai/v1/chat/completions" if groq_key else "https://api.openai.com/v1/chat/completions"
        token = groq_key or openai_key
        model_name = "llama-3.3-70b-versatile" if groq_key else "gpt-4o-mini"

        texts = [s["text"] for s in segments]
        prompt = f"Translate the following forensic audio transcript segments into {target}. Return ONLY a JSON list of translated strings matching input length:\n{texts}"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1
        }
        res = httpx.post(url, json=payload, headers=headers, timeout=60)
        if res.status_code == 200:
            import json
            raw_reply = res.json()["choices"][0]["message"]["content"]
            # Extract JSON list from reply
            start_idx = raw_reply.find("[")
            end_idx = raw_reply.rfind("]")
            if start_idx != -1 and end_idx != -1:
                translated_texts = json.loads(raw_reply[start_idx:end_idx+1])
                if isinstance(translated_texts, list):
                    # Defensively map by index: missing translated entries retain source text to avoid silent dropping
                    return [
                        {
                            **s,
                            "text_src": s.get("text", ""),
                            "text": str(translated_texts[i]).strip() if i < len(translated_texts) and str(translated_texts[i]).strip() else s.get("text", "")
                        }
                        for i, s in enumerate(segments)
                    ]
    except Exception:
        pass
    return None


def translate(segments: list, target: str = "en") -> dict:
    engine = "stub"
    out = []

    # 1. Try local IndicTrans2 if transformers is installed (cached module-level)
    try:
        model_name = "ai4bharat/indictrans2-indic-en-1B"
        tokenizer, model = _get_indictrans(model_name)
        prefix = f"<2{target}> " if target else "<2en> "
        formatted_inputs = [prefix + s["text"] for s in segments]
        inputs = tokenizer(formatted_inputs, return_tensors="pt", padding=True, truncation=True)
        gen = model.generate(**inputs, max_length=256)
        translated = tokenizer.batch_decode(gen, skip_special_tokens=True)
        out = [
            {
                **s,
                "text_src": s["text"],
                "text": str(translated[i]).strip() if i < len(translated) and str(translated[i]).strip() else s["text"]
            }
            for i, s in enumerate(segments)
        ]
        engine = "indictrans2-local"
    except Exception:
        # 2. Try API key (Groq / OpenAI) if configured
        api_out = _translate_via_api(segments, target)
        if api_out:
            out = api_out
            engine = "api-translation"
        else:
            # 3. Fallback bracketed tagging
            out = [{**s, "text_src": s["text"], "text": f"[{target}] {s['text']}"} for s in segments]

    return {"model": L_MODEL, "version": L_VER, "engine": engine, "target": target, "segments": out}
