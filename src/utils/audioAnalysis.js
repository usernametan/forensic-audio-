const fileCache = new WeakMap();
const urlCache = new Map();
const MAX_URL_CACHE = 6;

function getAudioContextClass() {
  return typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
}

async function decodeArrayBuffer(arrayBuffer) {
  const Ctx = getAudioContextClass();
  if (!Ctx) {
    throw new Error('This browser does not support the Web Audio API.');
  }
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    if (ctx.state !== 'closed') {
      ctx.close().catch(() => {});
    }
  }
}

export function decodeAudioFile(file) {
  if (!file) return Promise.reject(new Error('No audio file was provided.'));
  const cached = fileCache.get(file);
  if (cached) return cached;
  const promise = file.arrayBuffer().then((buffer) => decodeArrayBuffer(buffer));
  fileCache.set(file, promise);
  promise.catch(() => fileCache.delete(file));
  return promise;
}

export function decodeAudioUrl(url) {
  if (!url) return Promise.reject(new Error('No audio URL was provided.'));
  const cached = urlCache.get(url);
  if (cached) return cached;
  const promise = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Audio file could not be loaded (${response.status}).`);
      }
      return response.arrayBuffer();
    })
    .then((buffer) => decodeArrayBuffer(buffer));
  urlCache.set(url, promise);
  if (urlCache.size > MAX_URL_CACHE) {
    const oldest = urlCache.keys().next().value;
    if (oldest && oldest !== url) urlCache.delete(oldest);
  }
  promise.catch(() => urlCache.delete(url));
  return promise;
}

export function decodeAudioSource({ file, url } = {}) {
  if (file) return decodeAudioFile(file);
  if (url) return decodeAudioUrl(url);
  return Promise.reject(new Error('No audio source is available.'));
}

export function computePeaks(audioBuffer, buckets = 1200) {
  if (!audioBuffer || buckets <= 0) return new Float32Array(0);
  const channelCount = Math.max(1, audioBuffer.numberOfChannels);
  const length = audioBuffer.length;
  const samplesPerBucket = Math.max(1, Math.floor(length / buckets));
  const peaks = new Float32Array(buckets);
  const channels = [];
  for (let c = 0; c < Math.min(channelCount, 2); c += 1) {
    channels.push(audioBuffer.getChannelData(c));
  }
  for (let i = 0; i < buckets; i += 1) {
    const start = i * samplesPerBucket;
    const end = Math.min(length, start + samplesPerBucket);
    const stride = Math.max(1, Math.floor((end - start) / 80));
    let max = 0;
    for (let j = start; j < end; j += stride) {
      for (let c = 0; c < channels.length; c += 1) {
        const v = Math.abs(channels[c][j] || 0);
        if (v > max) max = v;
      }
    }
    peaks[i] = Math.min(1, Math.max(0.012, max));
  }
  return peaks;
}

function fftInPlace(real, imag) {
  const n = real.length;
  let j = 0;
  for (let i = 1; i < n; i += 1) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let curReal = 1;
      let curImag = 0;
      const half = size >> 1;
      for (let k = 0; k < half; k += 1) {
        const evenIndex = start + k;
        const oddIndex = evenIndex + half;
        const oddReal = real[oddIndex] * curReal - imag[oddIndex] * curImag;
        const oddImag = real[oddIndex] * curImag + imag[oddIndex] * curReal;
        real[oddIndex] = real[evenIndex] - oddReal;
        imag[oddIndex] = imag[evenIndex] - oddImag;
        real[evenIndex] += oddReal;
        imag[evenIndex] += oddImag;
        const nextReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = nextReal;
      }
    }
  }
}

function mixToMono(audioBuffer) {
  const channels = Math.max(1, audioBuffer.numberOfChannels);
  if (channels === 1) return audioBuffer.getChannelData(0);
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  const weight = 1 / channels;
  for (let c = 0; c < channels; c += 1) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) mono[i] += data[i] * weight;
  }
  return mono;
}

export function computeSpectrogram(audioBuffer, options = {}) {
  const { maxWidth = 720, height = 220, maxFrequency = 8000 } = options;
  if (!audioBuffer || audioBuffer.length === 0) return null;

  const mono = mixToMono(audioBuffer);
  const sampleRate = audioBuffer.sampleRate;
  const nyquist = sampleRate / 2;
  const fMax = Math.min(maxFrequency, nyquist);
  const width = Math.max(120, Math.min(maxWidth, Math.floor(mono.length / 8) || maxWidth));
  const windowSize = 1024;
  const hann = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i += 1) {
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (windowSize - 1));
  }

  const data = new Uint8Array(width * height);
  const real = new Float32Array(windowSize);
  const imag = new Float32Array(windowSize);
  const maxBin = Math.min(windowSize / 2, Math.floor((fMax / nyquist) * (windowSize / 2)));

  for (let x = 0; x < width; x += 1) {
    const center = Math.floor((x / Math.max(1, width - 1)) * (mono.length - 1));
    const start = Math.max(0, center - windowSize / 2);
    for (let i = 0; i < windowSize; i += 1) {
      real[i] = (mono[start + i] || 0) * hann[i];
      imag[i] = 0;
    }
    fftInPlace(real, imag);
    for (let y = 0; y < height; y += 1) {
      const slice = height - y;
      const bin = Math.floor((slice / height) * maxBin);
      const safeBin = Math.min(maxBin - 1, Math.max(0, bin));
      const magnitude = Math.hypot(real[safeBin], imag[safeBin]) / (windowSize * 0.5);
      const db = 20 * Math.log10(magnitude + 1e-9);
      const normalized = Math.max(0, Math.min(1, (db + 78) / 66));
      data[y * width + x] = Math.round(normalized * 255);
    }
  }

  return { width, height, data, maxFrequency: fMax, duration: audioBuffer.duration };
}

const SPECTROGRAM_STOPS = [
  [0, [32, 34, 30]],
  [0.2, [53, 65, 58]],
  [0.42, [100, 118, 106]],
  [0.62, [195, 163, 94]],
  [0.8, [183, 124, 98]],
  [1, [248, 245, 239]],
];

export function spectrogramColor(value) {
  const t = Math.max(0, Math.min(1, value / 255));
  for (let i = 1; i < SPECTROGRAM_STOPS.length; i += 1) {
    const [pos, color] = SPECTROGRAM_STOPS[i];
    const [prevPos, prevColor] = SPECTROGRAM_STOPS[i - 1];
    if (t <= pos) {
      const f = (t - prevPos) / (pos - prevPos || 1);
      return [
        Math.round(prevColor[0] + (color[0] - prevColor[0]) * f),
        Math.round(prevColor[1] + (color[1] - prevColor[1]) * f),
        Math.round(prevColor[2] + (color[2] - prevColor[2]) * f),
      ];
    }
  }
  return SPECTROGRAM_STOPS[SPECTROGRAM_STOPS.length - 1][1];
}
