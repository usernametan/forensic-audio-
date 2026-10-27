import { PIPELINE_STAGE_DEFINITIONS } from '../data/constants';

export function getStage(reviewData, key) {
  return reviewData?.stages?.[key] || null;
}

export function normalizeComparison(reviewData) {
  const comparison = getStage(reviewData, 'compare');
  const first = comparison?.metrics?.comparisons?.[0];
  if (!comparison || !first) return null;
  return {
    source: 'backend',
    model: first.model || comparison.model || 'Unknown model',
    version: first.version || comparison.version || '',
    method: first.method || '',
    specimenFile: first.specimen_file || '',
    specimenId: first.specimen_id || '',
    autoCosine: Number(first.auto_cosine),
    fusedScore: Number(first.fused_score),
    mfccDistance: Number(first.mfcc_dist),
    f0Questioned: Number(first.f0?.f0_mean),
    f0QuestionedStd: Number(first.f0?.f0_std),
    f0Reference: Number(first.f0?.ref_mean),
    verbal: first.verbal || '',
    stageHash: comparison.sha256 || '',
  };
}

export function normalizeTranscript(reviewData) {
  const transcript = Array.isArray(reviewData?.transcript) ? reviewData.transcript : [];
  const translated = Array.isArray(reviewData?.translated) ? reviewData.translated : [];
  const transcribeStage = getStage(reviewData, 'transcribe');
  const translateStage = getStage(reviewData, 'translate');
  return {
    original: transcript.map((segment, index) => ({
      id: `segment-${index}`,
      start: Number(segment.start) || 0,
      end: Number(segment.end) || 0,
      speaker: segment.speaker || 'SPEAKER_00',
      text: segment.text || segment.text_src || '',
      reviewStatus: segment.review_status || 'unreviewed',
      uncertain: Boolean(segment.uncertain),
    })),
    translated: translated.map((segment, index) => ({
      id: `translated-${index}`,
      start: Number(segment.start) || 0,
      end: Number(segment.end) || 0,
      speaker: segment.speaker || 'SPEAKER_00',
      text: segment.text || '',
      sourceText: segment.text_src || '',
    })),
    transcribeStage,
    translateStage,
  };
}

export function buildComparisonMetrics(comparison) {
  if (!comparison) return [];
  return [
    {
      key: 'embedding',
      label: 'Embedding cosine similarity',
      value: comparison.autoCosine,
      display: Number.isFinite(comparison.autoCosine) ? comparison.autoCosine.toFixed(4) : '—',
      scale: '0 to 1',
      description: 'Cosine similarity between speaker embeddings. It is a measured similarity, not a probability of identity.',
      tone: 'accent',
    },
    {
      key: 'fused',
      label: 'Fused comparison score',
      value: comparison.fusedScore,
      display: Number.isFinite(comparison.fusedScore) ? comparison.fusedScore.toFixed(4) : '—',
      scale: '0 to 1',
      description: 'Weighted combination of embedding similarity, pitch distance and MFCC distance produced by the pipeline.',
      tone: 'accent',
    },
    {
      key: 'mfcc',
      label: 'MFCC spectral distance',
      value: comparison.mfccDistance,
      display: Number.isFinite(comparison.mfccDistance) ? comparison.mfccDistance.toFixed(3) : '—',
      scale: 'Lower is closer',
      description: 'Euclidean distance between mean MFCC vectors from the two recordings.',
      tone: 'reference',
    },
    {
      key: 'f0',
      label: 'Mean F0 (questioned / reference)',
      value: null,
      display:
        Number.isFinite(comparison.f0Questioned) || Number.isFinite(comparison.f0Reference)
          ? `${Number.isFinite(comparison.f0Questioned) ? comparison.f0Questioned.toFixed(1) : '—'} / ${Number.isFinite(comparison.f0Reference) ? comparison.f0Reference.toFixed(1) : '—'}`
          : '—',
      scale: 'Hz',
      description: 'Mean fundamental frequency measured independently on each sample. Pitch varies with speech content and recording conditions.',
      tone: 'reference',
    },
  ];
}

export function pipelineStageStates(pipeline) {
  const completed = new Set((pipeline?.stages || []).map((stage) => stage.stage));
  const current = String(pipeline?.currentStage || '').toLowerCase();
  return PIPELINE_STAGE_DEFINITIONS.map((definition) => {
    let status = 'pending';
    if (completed.has(definition.key)) status = 'complete';
    else if (pipeline?.status === 'failed' && current.includes(definition.key)) status = 'failed';
    else if (current.includes(definition.key) || (current === 'acoustic+integrity' && ['acoustic', 'integrity'].includes(definition.key))) status = 'running';
    else if (pipeline?.status === 'needs_review' || pipeline?.status === 'approved') status = 'complete';
    const stageResult = (pipeline?.stages || []).find((stage) => stage.stage === definition.key);
    return {
      ...definition,
      status,
      model: stageResult?.model || '',
      metricsKeys: stageResult?.metrics_keys || [],
    };
  });
}

export function transcriptToPayload(segments) {
  return segments.map((segment) => ({
    start: segment.start,
    end: segment.end,
    speaker: segment.speaker,
    text: segment.text,
    review_status: segment.reviewStatus,
    uncertain: segment.uncertain,
  }));
}
