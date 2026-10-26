"""Lightweight audio helpers: soundfile with FFmpeg/FFprobe fallback for extended codec support (.m4a, exotic mp3)."""
import json
import os
import re
import shutil
import subprocess
import numpy as np
import soundfile as sf


def _get_ffmpeg_bin() -> str | None:
    """Find ffmpeg binary from system PATH or bundled imageio_ffmpeg."""
    bin_path = shutil.which("ffmpeg")
    if bin_path:
        return bin_path
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def probe_audio(path: str) -> dict:
    """
    Probe audio file metadata (codec, sample rate, channels, duration).
    Tries soundfile first; falls back to ffprobe / ffmpeg if soundfile fails.
    """
    path_str = str(path)
    # 1. Try soundfile
    try:
        io = sf.info(path_str)
        return {
            "codec": f"{io.format}/{io.subtype}",
            "sr": int(io.samplerate),
            "ch": int(io.channels),
            "dur": float(io.frames / float(io.samplerate or 1)),
            "backend": "soundfile",
        }
    except Exception:
        pass

    # 2. Fallback to ffprobe if available
    ffprobe_bin = shutil.which("ffprobe")
    if ffprobe_bin:
        try:
            cmd = [
                ffprobe_bin,
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                path_str,
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            meta = json.loads(res.stdout)
            audio_stream = next(
                (s for s in meta.get("streams", []) if s.get("codec_type") == "audio"),
                None
            )
            codec = (
                audio_stream.get("codec_name")
                if audio_stream and audio_stream.get("codec_name")
                else meta.get("format", {}).get("format_name", "unknown")
            )
            sr = int(audio_stream.get("sample_rate", 0)) if audio_stream else 0
            ch = int(audio_stream.get("channels", 0)) if audio_stream else 0
            dur = float(meta.get("format", {}).get("duration", 0.0))
            if dur == 0.0 and audio_stream and audio_stream.get("duration"):
                dur = float(audio_stream.get("duration", 0.0))
            return {
                "codec": str(codec),
                "sr": sr,
                "ch": ch,
                "dur": dur,
                "backend": "ffprobe",
            }
        except Exception:
            pass

    # 3. Fallback to ffmpeg -i info if ffprobe is not available
    ffmpeg_bin = _get_ffmpeg_bin()
    if ffmpeg_bin:
        try:
            cmd = [ffmpeg_bin, "-i", path_str]
            res = subprocess.run(cmd, capture_output=True, text=True)
            stderr = res.stderr or ""
            dur = 0.0
            dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", stderr)
            if dur_match:
                h, m, s = dur_match.groups()
                dur = int(h) * 3600 + int(m) * 60 + float(s)

            sr = 0
            sr_match = re.search(r"(\d+)\s*Hz", stderr)
            if sr_match:
                sr = int(sr_match.group(1))

            ch = 0
            if "stereo" in stderr:
                ch = 2
            elif "mono" in stderr:
                ch = 1

            codec_match = re.search(r"Audio:\s*([^,\s]+)", stderr)
            codec = codec_match.group(1) if codec_match else "ffmpeg"

            return {
                "codec": codec,
                "sr": sr,
                "ch": ch,
                "dur": dur,
                "backend": "ffmpeg",
            }
        except Exception:
            pass

    return {"codec": "unknown", "sr": 0, "ch": 0, "dur": 0.0, "backend": "unknown"}


def load_mono(path: str, target_sr: int = 16000) -> tuple[np.ndarray, int]:
    """
    Load an audio file as a mono float32 numpy array resampled to target_sr.
    Fast path: soundfile (WAV, FLAC, standard OGG/MP3).
    Fallback: FFmpeg CLI (system or bundled imageio_ffmpeg) for .m4a, exotic containers, or AAC encodings.
    """
    try:
        y, sr = sf.read(path, always_2d=False)
        if y.ndim > 1:
            y = y.mean(axis=1)
        y = y.astype(np.float32)
        if sr != target_sr:
            import librosa
            y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
            sr = target_sr
        return y, sr
    except Exception as sf_err:
        ffmpeg_bin = _get_ffmpeg_bin()
        if not ffmpeg_bin:
            raise RuntimeError(
                f"Failed to read audio file '{path}' via soundfile ({sf_err}). "
                "FFmpeg is required to decode this format (.m4a, AAC, or exotic codec). "
                "Please install system ffmpeg (e.g. `sudo apt-get install ffmpeg`) or install `imageio-ffmpeg`."
            ) from sf_err

        # Decode directly to mono 32-bit float PCM at target_sr via FFmpeg pipe
        cmd = [
            ffmpeg_bin,
            "-nostdin",
            "-threads", "1",
            "-i", str(path),
            "-f", "f32le",
            "-ac", "1",
            "-ar", str(target_sr),
            "pipe:1",
            "-loglevel", "error",
        ]
        proc = subprocess.run(cmd, capture_output=True)
        if proc.returncode != 0:
            err_msg = proc.stderr.decode("utf-8", errors="ignore").strip()
            raise RuntimeError(f"FFmpeg decoding failed for '{path}': {err_msg}")

        y = np.frombuffer(proc.stdout, dtype=np.float32)
        if len(y) == 0:
            raise RuntimeError(f"Decoded audio buffer for '{path}' is empty.")
        return y, target_sr


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
    from matplotlib.figure import Figure
    from matplotlib.backends.backend_agg import FigureCanvasAgg
    import librosa, librosa.display

    S = librosa.stft(y)
    S_db = librosa.amplitude_to_db(abs(S), ref=np.max)
    fig = Figure(figsize=(8, 3))
    FigureCanvasAgg(fig)
    ax = fig.add_subplot(111)
    img = librosa.display.specshow(S_db, sr=sr, x_axis="time", y_axis="hz", ax=ax)
    fig.colorbar(img, ax=ax, format="%+2.0f dB")
    ax.set_title(title or "spectrogram")
    fig.tight_layout()
    fig.savefig(out_png, dpi=120)
