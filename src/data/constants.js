export const SCREENS = {
  DASHBOARD: 'dashboard',
  PREPROCESSING: 'preprocessing',
  COMPARISON: 'comparison',
  TRANSCRIPTION: 'transcription',
  REPORT: 'report',
};

export const EMPTY_CASE = {
  id: '',
  title: '',
  source: '',
  collector: '',
};

export const ACCEPTED_AUDIO_EXTENSIONS = ['.wav', '.mp3', '.flac', '.ogg', '.m4a'];
export const ACCEPTED_AUDIO_ACCEPT = ACCEPTED_AUDIO_EXTENSIONS.join(',');
export const MAX_UPLOAD_MB = 500;

export const PIPELINE_STAGE_DEFINITIONS = [
  {
    key: 'denoise',
    label: 'Denoising',
    description: 'Adaptive noise reduction with hum/hiss/clipping diagnosis and artifact checks.',
    modelHint: 'DeepFilterNet / spectral gate',
  },
  {
    key: 'diarize',
    label: 'Speaker diarization',
    description: 'Speaker turns and timestamps. Overlapping speech is expected to be imperfect.',
    modelHint: 'pyannote.audio / energy VAD',
  },
  {
    key: 'compare',
    label: 'Voice comparison',
    description: 'Embedding similarity combined with acoustic-phonetic measurements when a specimen exists.',
    modelHint: 'SpeechBrain ECAPA-TDNN / MFCC fallback',
  },
  {
    key: 'transcribe',
    label: 'Transcription',
    description: 'Timestamp-aligned automatic speech recognition in the source language.',
    modelHint: 'Whisper',
  },
  {
    key: 'translate',
    label: 'Translation',
    description: 'Machine translation output. Lightweight deployments may use an IndicTrans2 fallback stub.',
    modelHint: 'IndicTrans2',
  },
  {
    key: 'acoustic',
    label: 'Acoustic analysis',
    description: 'Pitch, spectral, energy and MFCC measurements plus a processed spectrogram.',
    modelHint: 'librosa / Praat',
  },
  {
    key: 'integrity',
    label: 'Integrity analysis',
    description: 'Metadata, clipping, splice heuristics, ENF and deepfake limitation flags.',
    modelHint: 'forensic heuristics',
  },
];

export const SPEAKER_COLORS = ['#D49A58', '#8EA6BB', '#CF8A5C', '#E7B778', '#B9A992', '#6FBF8A'];

export const REPORT_LIMITATIONS = [
  'Automated outputs in this report are decision support only and require review by a certified examiner before reliance.',
  'Speaker comparison results describe measured acoustic similarity, not a legal determination of identity.',
  'Overlapping speech, short utterances, low voice level, telephonic bandwidth, lossy transcoding and clipping can materially reduce analytical reliability.',
  'The integrity checks included are heuristic. ENF verification and deepfake assessment require dedicated reference material and expert interpretation.',
  'Machine transcription and translation can contain errors, especially for accented, noisy or multilingual speech. They must be verified against the audio.',
  'Any conclusion in this report should state only what the supported examination findings establish.',
];

export const PIPELINE_TERMINAL_STATUSES = new Set(['needs_review', 'approved', 'failed']);
