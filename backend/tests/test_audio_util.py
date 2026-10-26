import json
import subprocess
import tempfile
from unittest.mock import patch, MagicMock
import numpy as np
import pytest
import soundfile as sf
from backend.pipeline.audio_util import load_mono, probe_audio, save_wav, snr_db, levels


def test_probe_and_load_wav_soundfile():
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name

    sr = 16000
    y_in = np.sin(2 * np.pi * 440 * np.linspace(0, 0.5, int(sr * 0.5))).astype(np.float32)
    save_wav(wav_path, y_in, sr)

    probe = probe_audio(wav_path)
    assert probe["backend"] == "soundfile"
    assert probe["sr"] == 16000
    assert probe["ch"] == 1
    assert 0.49 <= probe["dur"] <= 0.51

    y_out, sr_out = load_mono(wav_path, target_sr=16000)
    assert sr_out == 16000
    assert len(y_out) == len(y_in)
    assert np.allclose(y_out, y_in, atol=1e-3)


def test_probe_fallback_to_ffprobe():
    with patch("soundfile.info", side_effect=Exception("Unrecognized format")), \
         patch("shutil.which") as mock_which, \
         patch("subprocess.run") as mock_run:

        def fake_which(cmd):
            return "/usr/bin/ffprobe" if cmd == "ffprobe" else None

        mock_which.side_effect = fake_which

        fake_ffprobe_json = json.dumps({
            "streams": [{
                "codec_type": "audio",
                "codec_name": "aac",
                "sample_rate": "44100",
                "channels": 2,
                "duration": "12.34",
            }],
            "format": {
                "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
                "duration": "12.34",
            }
        })
        mock_run.return_value = MagicMock(returncode=0, stdout=fake_ffprobe_json)

        probe = probe_audio("/fake/path/audio.m4a")
        assert probe["backend"] == "ffprobe"
        assert probe["codec"] == "aac"
        assert probe["sr"] == 44100
        assert probe["ch"] == 2
        assert probe["dur"] == 12.34


def test_load_mono_fallback_to_ffmpeg():
    with patch("soundfile.read", side_effect=Exception("Unrecognized format")), \
         patch("backend.pipeline.audio_util._get_ffmpeg_bin", return_value="/usr/bin/ffmpeg"), \
         patch("subprocess.run") as mock_run:

        raw_pcm = np.array([0.1, 0.2, -0.3, 0.4], dtype=np.float32).tobytes()
        mock_run.return_value = MagicMock(returncode=0, stdout=raw_pcm)

        y, sr = load_mono("/fake/path/audio.m4a", target_sr=16000)
        assert sr == 16000
        assert len(y) == 4
        assert np.allclose(y, [0.1, 0.2, -0.3, 0.4])


def test_load_mono_missing_ffmpeg_raises_helpful_error():
    with patch("soundfile.read", side_effect=Exception("Format not recognized")), \
         patch("backend.pipeline.audio_util._get_ffmpeg_bin", return_value=None):

        with pytest.raises(RuntimeError) as exc_info:
            load_mono("/fake/path/unsupported.m4a")

        assert "FFmpeg is required to decode this format" in str(exc_info.value)


def test_get_ffmpeg_bin_finds_bundled_imageio_ffmpeg():
    from backend.pipeline.audio_util import _get_ffmpeg_bin
    exe = _get_ffmpeg_bin()
    assert exe is not None
    assert "ffmpeg" in exe.lower()

