import { useEffect, useState } from 'react';
import { computePeaks, decodeAudioSource } from '../utils/audioAnalysis';

export default function useDecodedAudio({ file, url } = {}, options = {}) {
  const { buckets = 1200 } = options;
  const [state, setState] = useState({
    status: 'idle',
    buffer: null,
    peaks: null,
    duration: 0,
    sampleRate: 0,
    channels: 0,
    error: '',
  });

  useEffect(() => {
    if (!file && !url) {
      setState({
        status: 'idle',
        buffer: null,
        peaks: null,
        duration: 0,
        sampleRate: 0,
        channels: 0,
        error: '',
      });
      return undefined;
    }

    let cancelled = false;
    setState({ status: 'loading', buffer: null, peaks: null, duration: 0, sampleRate: 0, channels: 0, error: '' });

    decodeAudioSource({ file, url })
      .then((buffer) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          buffer,
          peaks: computePeaks(buffer, buckets),
          duration: buffer.duration,
          sampleRate: buffer.sampleRate,
          channels: buffer.numberOfChannels,
          error: '',
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: 'error',
          buffer: null,
          peaks: null,
          duration: 0,
          sampleRate: 0,
          channels: 0,
          error: error?.message || 'The audio could not be decoded in this browser.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [file, url, buckets]);

  return state;
}
