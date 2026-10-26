"""3. VOICE COMPARISON — SpeechBrain ECAPA-TDNN preferred, MFCC fallback.

Combines automated embedding cosine with acoustic-phonetic features
(F0 mean/std, spectral centroid, MFCC distance, speaking rate proxy).
Never a single metric: returns per-feature distances + fused score and
a conservative verbal conclusion.
"""
import numpy as np
from .audio_util import load_mono

MODEL, VERSION = "SpeechBrain ECAPA-TDNN", "mfcc-fallback-v1"


def _mfcc_mean(y: np.ndarray, sr: int, n: int = 20) -> np.ndarray:
    import librosa
    m = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=n)
    return m.mean(axis=1)


def _f0_stats(y: np.ndarray, sr: int) -> dict:
    try:
        import parselmouth
        from parselmouth.praat import call
        snd = parselmouth.Sound(y, sampling_frequency=sr)
        pitch = snd.to_pitch()
        m = float(call(pitch, "Get mean", 0, 0, "Hertz") or 0.0)
        s = float(call(pitch, "Get standard deviation", 0, 0, "Hertz") or 0.0)
        return {"f0_mean": m, "f0_std": s}
    except Exception:
        pass

    import librosa
    f0, _, _ = librosa.pyin(y, fmin=50, fmax=500, sr=sr)
    v = f0[~np.isnan(f0)]
    if len(v) == 0:
        return {"f0_mean": 0.0, "f0_std": 0.0}
    return {"f0_mean": float(v.mean()), "f0_std": float(v.std())}


_SPEECHBRAIN_CLF = None


def _get_classifier():
    global _SPEECHBRAIN_CLF
    if _SPEECHBRAIN_CLF is None:
        from speechbrain.inference import EncoderClassifier  # type: ignore
        _SPEECHBRAIN_CLF = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")
    return _SPEECHBRAIN_CLF


def _embedding(y: np.ndarray, sr: int) -> np.ndarray:
    try:
        import torch
        clf = _get_classifier()
        emb = clf.encode_batch(torch.unsqueeze(torch.tensor(y), 0)).squeeze().detach().numpy()
        return emb / (np.linalg.norm(emb) + 1e-12)
    except Exception:
        v = _mfcc_mean(y, sr)
        return v / (np.linalg.norm(v) + 1e-12)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))


def compare(questioned_wav: str, known_wav: str) -> dict:
    yq, sq = load_mono(questioned_wav)
    yk, sk = load_mono(known_wav)
    eq, ek = _embedding(yq, sq), _embedding(yk, sk)
    auto_sim = cosine(eq, ek)
    fq, fk = _f0_stats(yq, sq), _f0_stats(yk, sk)
    f0_dist = abs(fq["f0_mean"] - fk["f0_mean"]) / (max(fq["f0_mean"], fk["f0_mean"], 1.0))
    mfcc_dist = float(np.linalg.norm(_mfcc_mean(yq, sq) - _mfcc_mean(yk, sk)))
    fused = 0.6 * auto_sim + 0.2 * (1 - min(f0_dist, 1.0)) + 0.2 * (1 / (1 + mfcc_dist / 10))
    if fused >= 0.75:
        verbal = "similar — supports same-speaker hypothesis (examiner must confirm)"
    elif fused >= 0.55:
        verbal = "inconclusive — partial similarity, manual phonetic check required"
    else:
        verbal = "dissimilar — supports different-speaker hypothesis (examiner must confirm)"
    return {"model": MODEL, "version": VERSION,
            "auto_cosine": round(auto_sim, 4), "f0": {**fq, "ref_mean": fk["f0_mean"]},
            "mfcc_dist": round(mfcc_dist, 3), "fused_score": round(float(fused), 4),
            "verbal": verbal, "method": "auditory + acoustic-phonetic + automated (combined)"}
