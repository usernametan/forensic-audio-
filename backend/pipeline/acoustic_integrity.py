"""6. VOICE/ACOUSTIC ANALYSIS (Praat/librosa) + 7. INTEGRITY ANALYSIS."""
import numpy as np
from .audio_util import load_mono, levels, spectrogram_png, probe_audio

A_MODEL, A_VER = "librosa/praat-parselmouth", "librosa-v1"


def acoustic(wav_path: str, spec_png: str) -> dict:
    import librosa
    y, sr = load_mono(wav_path)
    f0, _, _ = librosa.pyin(y, fmin=50, fmax=500, sr=sr)
    v = f0[~np.isnan(f0)]
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13).mean(axis=1).round(3).tolist()
    centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
    zcr = float(librosa.feature.zero_crossing_rate(y).mean())
    spectrogram_png(y, sr, spec_png, title="processed spectrogram")
    return {"model": A_MODEL, "version": A_VER,
            "f0_mean": round(float(v.mean()) if len(v) else 0.0, 2),
            "f0_std": round(float(v.std()) if len(v) else 0.0, 2),
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
