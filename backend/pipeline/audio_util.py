"""Lightweight audio helpers. No ffmpeg dependency (soundfile + numpy)."""
import numpy as np
import soundfile as sf


def load_mono(path: str, target_sr: int = 16000) -> tuple[np.ndarray, int]:
    y, sr = sf.read(path, always_2d=False)
    if y.ndim > 1:
        y = y.mean(axis=1)
    y = y.astype(np.float32)
    if sr != target_sr:
        import librosa
        y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
        sr = target_sr
    return y, sr


def save_wav(path: str, y: np.ndarray, sr: int):
    import soundfile as sf
    sf.write(path, y, sr)


def snr_db(clean_estimate: np.ndarray, residual: np.ndarray) -> float:
    sig = float((clean_estimate ** 2).mean() + 1e-12)
    noi = float((residual ** 2).mean() + 1e-12)
    return float(10 * np.log10(sig / noi))


def levels(y: np.ndarray) -> dict:
    peak = float(np.max(np.abs(y)) + 1e-12)
    rms = float(np.sqrt((y ** 2).mean() + 1e-12))
    clipped = float((np.abs(y) > 0.99).mean())
    return {"peak": peak, "rms": rms, "clipped_ratio": clipped}


def spectrogram_png(y: np.ndarray, sr: int, out_png: str, title: str = ""):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import librosa, librosa.display
    S = librosa.stft(y)
    S_db = librosa.amplitude_to_db(abs(S), ref=np.max)
    plt.figure(figsize=(8, 3))
    librosa.display.specshow(S_db, sr=sr, x_axis="time", y_axis="hz")
    plt.colorbar(format="%+2.0f dB")
    plt.title(title or "spectrogram")
    plt.tight_layout()
    plt.savefig(out_png, dpi=120)
    plt.close()
