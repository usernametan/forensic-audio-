"""1. DENOISING — DeepFilterNet preferred, spectral-gate fallback.

Tries `deepfilternet` CLI if installed; otherwise applies a conservative
spectral-gating denoise. Always logs which engine was used and flags
over-processing risk. Never modifies the input in place.
"""
import shutil
import subprocess
import numpy as np
from .audio_util import load_mono, save_wav, levels, snr_db

MODEL = "DeepFilterNet"
VERSION = "fallback-v1 (dfn-if-available)"


def _spectral_gate(y: np.ndarray, sr: int, thresh_db: float = -30.0) -> np.ndarray:
    import librosa
    S = librosa.stft(y)
    mag, phase = np.abs(S), np.angle(S)
    mag_db = 20 * np.log10(mag + 1e-10)
    noise_floor = np.median(mag_db)
    mask = mag_db > (noise_floor - thresh_db * 0.5)
    return librosa.istft(mag * mask * np.exp(1j * phase), length=len(y)).astype(np.float32)


def detect_problems(y: np.ndarray, sr: int) -> dict:
    lv = levels(y)
    hum = False
    try:
        import numpy as np
        spec = np.abs(np.fft.rfft(y[: sr * 4]))
        freqs = np.fft.rfftfreq(len(y[: sr * 4]), 1 / sr)
        band = spec[(freqs > 45) & (freqs < 65)]
        hum = bool(band.mean() > spec.mean() * 3) if len(band) else False
    except Exception:
        pass
    return {
        "clipping": lv["clipped_ratio"] > 0.001,
        "low_level": lv["rms"] < 0.02,
        "hum_50hz": hum,
        **lv,
    }


def run(input_wav: str, out_wav: str) -> dict:
    y, sr = load_mono(input_wav)
    diagnosis = detect_problems(y, sr)
    engine = "spectral-gate-fallback"
    if shutil.which("deepfilternet"):
        try:
            subprocess.run(["deepfilternet", input_wav, "-o", out_wav],
                           check=True, capture_output=True, timeout=300)
            engine = "deepfilternet-cli"
            y2, _ = load_mono(out_wav)
        except Exception:
            y2 = _spectral_gate(y, sr)
            save_wav(out_wav, y2, sr)
    else:
        y2 = _spectral_gate(y, sr)
        save_wav(out_wav, y2, sr)
    before, after = levels(y), levels(y2)
    n = min(len(y), len(y2))
    residual = y[:n] - y2[:n]
    return {
        "model": MODEL, "version": VERSION, "engine": engine,
        "params": {"target_sr": sr, "adaptive": True},
        "diagnosis": diagnosis, "before": before, "after": after,
        "snr_proxy_db": snr_db(y2[:n], residual),
        "artifact_warning": before["rms"] > 0 and (after["rms"] / (before["rms"] + 1e-9)) < 0.3,
    }
