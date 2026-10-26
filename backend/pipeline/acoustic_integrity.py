"""6. VOICE/ACOUSTIC ANALYSIS (Praat/librosa) + 7. INTEGRITY ANALYSIS."""
import numpy as np
from .audio_util import load_mono, levels, spectrogram_png, probe_audio

A_MODEL, A_VER = "librosa/praat-parselmouth", "librosa-v1"


def acoustic(wav_path: str, spec_png: str) -> dict:
    import librosa
    y, sr = load_mono(wav_path)
    model_name = "Praat-Parselmouth"
    model_ver = "parselmouth-v1"
    try:
        import parselmouth
        from parselmouth.praat import call
        snd = parselmouth.Sound(wav_path)
        pitch = snd.to_pitch()
        f0_mean = float(call(pitch, "Get mean", 0, 0, "Hertz") or 0.0)
        f0_std = float(call(pitch, "Get standard deviation", 0, 0, "Hertz") or 0.0)
    except Exception:
        f0, _, _ = librosa.pyin(y, fmin=50, fmax=500, sr=sr)
        v = f0[~np.isnan(f0)]
        f0_mean = float(v.mean()) if len(v) else 0.0
        f0_std = float(v.std()) if len(v) else 0.0
        model_name = "librosa/praat-fallback"
        model_ver = "librosa-v1"

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13).mean(axis=1).round(3).tolist()
    centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
    zcr = float(librosa.feature.zero_crossing_rate(y).mean())
    spectrogram_png(y, sr, spec_png, title="processed spectrogram")
    return {"model": model_name, "version": model_ver,
            "f0_mean": round(f0_mean, 2),
            "f0_std": round(f0_std, 2),
            "mfcc_mean13": mfcc, "spectral_centroid": round(centroid, 2),
            "zcr": round(zcr, 5), "levels": levels(y),
            "speaking_rate_proxy": round(float(zcr * 60), 2),
            "spectrogram": spec_png}


def integrity(original_path: str, processed_path: str) -> dict:
    flags: list = []
    meta = probe_audio(original_path)
    y, sr = load_mono(processed_path)
    lv = levels(y)
    if lv["clipped_ratio"] > 0.001:
        flags.append("clipping-detected")
    if lv["rms"] < 0.02:
        flags.append("low-level-speech")
    # naive splice heuristic: abrupt energy jumps
    frame = sr // 2
    rms = [float(np.sqrt((y[i:i + frame] ** 2).mean() + 1e-12)) for i in range(0, len(y), frame)]
    jumps = sum(1 for a, b in zip(rms, rms[1:]) if abs(a - b) > 0.25)
    if jumps >= 3:
        flags.append("possible-splice-or-edit — manual waveform check required")
    flags.append("ENF-check: inconclusive in stub — record mains reference if required")
    flags.append("deepfake-check: no standalone verdict — examiner review required")
    return {"model": "forensic-integrity", "version": "heuristics-v1",
            "metadata": meta, "levels": lv, "flags": flags}
