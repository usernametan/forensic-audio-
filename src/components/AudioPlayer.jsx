import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Loader2, AlertTriangle } from 'lucide-react';
import { formatDuration } from '../utils/format';

const AudioPlayer = forwardRef(function AudioPlayer(
  { src, title = 'Audio playback', durationHint = 0, onTimeUpdate, disabled = false },
  ref
) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint || 0);
  const [volume, setVolume] = useState(1);
  const [rate, setRate] = useState(1);
  const [loading, setLoading] = useState(Boolean(src));
  const [error, setError] = useState('');

  useImperativeHandle(ref, () => ({
    seek(time) {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(time)) return;
      audio.currentTime = Math.max(0, Math.min(time, audio.duration || time));
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    },
    play() {
      audioRef.current?.play?.().catch(() => {});
    },
  }));

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(durationHint || 0);
    setLoading(Boolean(src));
    setError('');
  }, [src, durationHint]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = rate;
    }
  }, [volume, rate]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || disabled || !src) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch (playError) {
        setError(playError?.message || 'Playback was blocked by the browser.');
      }
    } else {
      audio.pause();
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    onTimeUpdate?.(audio.currentTime);
  };

  const handleSeek = (event) => {
    const next = Number(event.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = next;
    }
    setCurrentTime(next);
    onTimeUpdate?.(next);
  };

  const total = Number.isFinite(duration) && duration > 0 ? duration : durationHint;

  return (
    <div className={`audio-player ${disabled ? 'is-disabled' : ''}`.trim()}>
      <audio
        ref={audioRef}
        src={src || undefined}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          if (Number.isFinite(nextDuration)) setDuration(nextDuration);
          setLoading(false);
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setPlaying(false);
          setError('This audio source could not be played.');
        }}
      />

      <div className="audio-player-main">
        <button
          type="button"
          className="player-play"
          onClick={togglePlayback}
          disabled={disabled || !src}
          aria-label={playing ? 'Pause audio' : 'Play audio'}
          title={title}
        >
          {loading ? (
            <Loader2 size={17} className="spin" />
          ) : playing ? (
            <Pause size={17} />
          ) : (
            <Play size={17} fill="currentColor" />
          )}
        </button>

        <div className="player-timeline">
          <input
            className="player-range"
            type="range"
            min={0}
            max={Math.max(0.1, total)}
            step={0.01}
            value={Math.min(currentTime, total || 0)}
            onChange={handleSeek}
            disabled={disabled || !src || !total}
            aria-label="Seek audio"
          />
          <div className="player-time">
            <span className="mono">{formatDuration(currentTime)}</span>
            <span className="mono">{formatDuration(total)}</span>
          </div>
        </div>

        <div className="player-extras">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setVolume((value) => (value > 0 ? 0 : 1))}
            aria-label={volume > 0 ? 'Mute audio' : 'Unmute audio'}
          >
            {volume > 0 ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <input
            className="volume-range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
            disabled={disabled || !src}
          />
          <label className="rate-control">
            <span className="sr-only">Playback speed</span>
            <select
              value={rate}
              onChange={(event) => setRate(Number(event.target.value))}
              disabled={disabled || !src}
              aria-label="Playback speed"
            >
              <option value={0.75}>0.75×</option>
              <option value={1}>1×</option>
              <option value={1.25}>1.25×</option>
              <option value={1.5}>1.5×</option>
              <option value={2}>2×</option>
            </select>
          </label>
        </div>
      </div>

      {error && (
        <p className="player-error" role="alert">
          <AlertTriangle size={13} /> {error}
        </p>
      )}
    </div>
  );
});

export default AudioPlayer;
