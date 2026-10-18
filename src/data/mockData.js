export const SCREENS = {
  DASHBOARD: 'dashboard',
  PREPROCESSING: 'preprocessing',
  COMPARISON: 'comparison',
  TRANSCRIPTION: 'transcription',
  REPORT: 'report',
};

export const DEFAULT_CASE = {
  id: 'CEP-2026-AF-0147',
  title: 'Suspect Voice Verification — Telecom Intercept Exhibit',
};

export const EXAMPLE_EVIDENCE = {
  ref: 'EV-001',
  name: 'intercept_call_014.wav',
  sizeMB: 24.8,
  duration: '04:32',
  format: 'WAV · PCM 16-bit',
  sampleRate: '48 kHz',
  channels: 'Mono',
  bitrate: '768 kbps',
  hash: 'a3f9c2d8…4e9be71b',
  captured: '12 Oct 2026 · 22:41 IST',
  source: 'Telecom intercept (companion audio exhibit)',
};

export const EXAMPLE_REFERENCE = {
  ref: 'REF-001',
  name: 'ref_voice_sample_A.wav',
  sizeMB: 11.2,
  duration: '02:15',
  format: 'WAV · PCM 24-bit',
  sampleRate: '48 kHz',
  channels: 'Mono',
  bitrate: '1152 kbps',
  snr: '31.2 dB',
  quality: 'Good',
  origin: 'Authorized custodial interview (consented)',
  captured: '02 Sep 2026 · 11:05 IST',
  hash: '7c10ab54…d2f08aa9',
};

export const STAGE_META = {
  noise: {
    key: 'noise',
    label: 'Noise Reduction',
    detail: 'Spectral subtraction · Wiener noise gate at −38 dB floor',
    durationMs: 2100,
  },
  enhance: {
    key: 'enhance',
    label: 'Audio Enhancement',
    detail: 'Bandwidth extension 8→16 kHz · de-clipping · loudness −16 LUFS',
    durationMs: 1900,
  },
  separate: {
    key: 'separate',
    label: 'Speaker Separation',
    detail: 'VAD diarization · 2-speaker clustering · 47 speech segments',
    durationMs: 2600,
  },
};

export const STAGE_ORDER = ['noise', 'enhance', 'separate'];

export const SPEAKER_TRACKS = [
  {
    id: 'SPK-01',
    label: 'Speaker 01',
    color: '#22d3ee',
    talkTime: '58%',
    segments: 29,
    duration: '02:31',
    pitch: '112 – 148 Hz',
    seed: 11,
  },
  {
    id: 'SPK-02',
    label: 'Speaker 02',
    color: '#a78bfa',
    talkTime: '42%',
    segments: 18,
    duration: '01:48',
    pitch: '164 – 205 Hz',
    seed: 29,
  },
];

export const COMPARISON_RESULT = {
  generatedAt: '18 Oct 2026 · 10:42 IST',
  engineLabel: 'Illustrative feature engine (simulated)',
  featuresQuestioned: '1,842 MFCC vectors · 164 phonetic tokens',
  featuresReference: '3,120 MFCC vectors · 241 phonetic tokens',
  metrics: [
    { name: 'Spectral envelope correlation', value: 0.68 },
    { name: 'Pitch distribution overlap', value: 0.55 },
    { name: 'Rhythm & prosody match', value: 0.61 },
    { name: 'Phonotactic pattern index', value: 0.59 },
  ],
  composite: 0.61,
  verdictBand: 'Inconclusive band (0.55 – 0.70)',
  observations: [
    'Feature extraction completed on both samples with no fatal errors.',
    'Composite illustrative index falls inside the inconclusive band; the mock engine is deliberately configured so no same-speaker or different-speaker conclusion can be drawn.',
    'Questioned sample is narrowband (8 kHz) with residual noise, which in real casework would reduce the weight of any speaker comparison.',
    'Reference sample is high fidelity and suitable as a comparison reference in genuine forensic practice.',
    'A minimum of 30 seconds of clean questioned speech from a single speaker is normally required before any comparison is attempted.',
  ],
};

export const TRANSCRIPT = {
  originalLanguageLabel: 'Marathi (मराठी)',
  sourceFormat: 'Narrowband · 16 kHz · auto-segmented',
  confidence: 0.81,
  werEstimate: '12 – 18% (mock)',
  segments: [
    {
      time: '00:02',
      speaker: 'SPK-01',
      tokens: [
        { t: 'हा ' },
        { u: 'मेसेज', c: 0.74 },
        { t: ' ऐकला का? काल रात्री दहा वाजता स्टेशनजवळ भेटू.' },
      ],
    },
    {
      time: '00:09',
      speaker: 'SPK-02',
      tokens: [
        { t: 'हो, ऐकला. पण वेळ बदलून घे — जास्त लोक असतील तिथे.' },
      ],
    },
    {
      time: '00:18',
      speaker: 'SPK-01',
      tokens: [
        { t: 'ठीक आहे. एक वाजता ये आणि तो ' },
        { u: 'दस्तऐवज', c: 0.48 },
        { t: ' घेऊन यावा लागेल.' },
      ],
    },
    {
      time: '00:27',
      speaker: 'SPK-02',
      tokens: [
        { t: 'समजलं. मी पळून येईन, पण तोपर्यंत फोनवर बोलू नका.' },
      ],
    },
    {
      time: '00:36',
      speaker: 'SPK-01',
      tokens: [
        { t: 'बरं… ' },
        { u: 'लाईन कट', c: 0.63 },
        { t: ' झाली असं वाटतं.' },
      ],
    },
  ],
};

export const TRANSLATIONS = {
  english: {
    code: 'EN',
    label: 'English',
    note: null,
    segments: [
      {
        time: '00:02',
        speaker: 'SPK-01',
        tokens: [
          { t: 'Did you hear this ' },
          { u: 'message', c: 0.76 },
          { t: '? Meet near the station at ten last night.' },
        ],
      },
      { time: '00:09', speaker: 'SPK-02', tokens: [{ t: 'Yes, heard it. But change the time — too many people will be there.' }] },
      {
        time: '00:18',
        speaker: 'SPK-01',
        tokens: [
          { t: 'Alright. Come at one and you will have to bring those ' },
          { u: 'documents', c: 0.51 },
          { t: '.' },
        ],
      },
      { time: '00:27', speaker: 'SPK-02', tokens: [{ t: 'Understood. I will run over, but do not speak on the phone until then.' }] },
      {
        time: '00:36',
        speaker: 'SPK-01',
        tokens: [
          { t: 'Fine… I think the ' },
          { u: 'line dropped', c: 0.65 },
          { t: '.' },
        ],
      },
    ],
  },
  hindi: {
    code: 'HI',
    label: 'Hindi',
    note: null,
    segments: [
      {
        time: '00:02',
        speaker: 'SPK-01',
        tokens: [
          { t: 'यह ' },
          { u: 'मैसेज', c: 0.74 },
          { t: ' सुना? कल रात दस बजे स्टेशन के पास मिलो।' },
        ],
      },
      { time: '00:09', speaker: 'SPK-02', tokens: [{ t: 'हाँ, सुना। पर वक्त बदल लो — वहाँ बहुत लोग होंगे।' }] },
      {
        time: '00:18',
        speaker: 'SPK-01',
        tokens: [
          { t: 'ठीक है। एक बजे आओ और वह ' },
          { u: 'कागज़ात', c: 0.48 },
          { t: ' लेकर आना होगा।' },
        ],
      },
      { time: '00:27', speaker: 'SPK-02', tokens: [{ t: 'समझ गया। मैं दौड़कर आता हूँ, पर तब तक फ़ोन पर बात मत करो।' }] },
      {
        time: '00:36',
        speaker: 'SPK-01',
        tokens: [
          { t: 'अच्छा… ' },
          { u: 'लाइन कट', c: 0.63 },
          { t: ' लगती है।' },
        ],
      },
    ],
  },
  marathi: {
    code: 'MR',
    label: 'Marathi',
    note: 'Target language matches the source language — a romanized transliteration is shown for cross-checking.',
    segments: [
      {
        time: '00:02',
        speaker: 'SPK-01',
        tokens: [
          { t: 'Ha ' },
          { u: 'message', c: 0.74 },
          { t: ' aakla ka? Kal ratri daha vajta stationjavél bhetu.' },
        ],
      },
      { time: '00:09', speaker: 'SPK-02', tokens: [{ t: 'Ho, aakla. Pan vel badlun ghe — jast lok astil tithe.' }] },
      {
        time: '00:18',
        speaker: 'SPK-01',
        tokens: [
          { t: 'Theek aahe. Ek vajta ye aani to ' },
          { u: 'dastavez', c: 0.48 },
          { t: ' gheun yava lagel.' },
        ],
      },
      { time: '00:27', speaker: 'SPK-02', tokens: [{ t: 'Samajla. Mi palaun yein, pan toiparyant phonevar bolu naka.' }] },
      {
        time: '00:36',
        speaker: 'SPK-01',
        tokens: [
          { t: 'Bara… ' },
          { u: 'line cut', c: 0.63 },
          { t: ' zala asa vatata.' },
        ],
      },
    ],
  },
};

export const REPORT_META = {
  id: 'RPT-CEP-0147-01',
  generated: '18 Oct 2026 · 10:55 IST',
  examiner: 'Trainee Examiner (Demo Profile)',
  lab: 'Digital Forensics Laboratory — Academic Demo Cell',
  reviewStatus: 'Pending examiner sign-off',
  limitations: [
    'This document is produced by a frontend prototype built for an academic experiment (Experiment No. 5). All analysis outputs are simulated mock data.',
    'No validated forensic audio engine, machine-learning model or database was used. Similarity indices shown are illustrative numbers only.',
    'Speaker comparison results in genuine casework must be performed by a certified forensic audio examiner using validated tooling.',
    'Chain of custody has not been established within this prototype; exhibit integrity statements below are sample placeholders.',
    'This report must NOT be used as evidence, identification or expert opinion in any legal proceeding.',
  ],
};
