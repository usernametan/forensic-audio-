/**
 * Forensic Audio API client.
 * Connects the React/Vite frontend to the FastAPI audio forensics pipeline.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Compute SHA-256 hash of a browser File object using Web Crypto API.
 * Ensures immediate cryptographic fingerprinting upon exhibit ingest.
 */
export async function computeSHA256(file) {
  if (!file) return '';
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload evidence audio + optional reference specimens + custody questionnaire.
 */
export async function uploadEvidence({
  evidenceFile,
  specimenFiles = [],
  source = '',
  collector = '',
  questionnaire = '{}',
}) {
  const fd = new FormData();
  fd.append('evidence', evidenceFile, evidenceFile.name);
  for (const spec of specimenFiles) {
    if (spec) fd.append('specimens', spec, spec.name);
  }
  fd.append('source', source || '');
  fd.append('collector', collector || '');
  fd.append('questionnaire', typeof questionnaire === 'string' ? questionnaire : JSON.stringify(questionnaire));

  const res = await fetch(`${API_BASE}/evidence/upload`, {
    method: 'POST',
    body: fd,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload failed (${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * Fetch backend-verified metadata for an evidence or specimen record.
 */
export async function getEvidence(evidenceId) {
  const res = await fetch(`${API_BASE}/evidence/${evidenceId}`);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Evidence metadata failed (${res.status}): ${errText}`);
  }
  return await res.json();
}

/**
 * Poll pipeline run progress and stages.
 */
export async function getPipelineStatus(runId) {
  const res = await fetch(`${API_BASE}/pipeline/${runId}/status`);
  if (!res.ok) {
    throw new Error(`Failed to fetch pipeline status for run ${runId}`);
  }
  return await res.json();
}

/**
 * Fetch full review package: acoustic metrics, spectrograms, comparison, transcripts, integrity flags.
 */
export async function getReview(runId) {
  const res = await fetch(`${API_BASE}/review/${runId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch review data for run ${runId}`);
  }
  return await res.json();
}

/**
 * Examiner review gate: approve or override run and commit findings.
 */
export async function submitReview(runId, { examiner, approved = true, conclusion = '', overrides = {} }) {
  const res = await fetch(`${API_BASE}/review/${runId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      examiner,
      approved,
      conclusion,
      overrides,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Review submission failed (${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * Attach or replace a reference specimen for an existing run and re-run comparison.
 * Any prior examiner approval is intentionally invalidated by the backend.
 */
export async function compareSpecimen(runId, { file, specimenId = '' } = {}) {
  const fd = new FormData();
  if (file) fd.append('specimen', file, file.name);
  if (specimenId) fd.append('specimen_id', specimenId);

  if (!file && !specimenId) {
    throw new Error('Select a reference specimen before running the comparison.');
  }

  const res = await fetch(`${API_BASE}/pipeline/${runId}/compare`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Comparison failed (${res.status}): ${errText}`);
  }
  return await res.json();
}

/**
 * Persist examiner transcript corrections. Transcript edits invalidate prior approval.
 */
export async function saveTranscript(runId, segments) {
  const res = await fetch(`${API_BASE}/review/${runId}/transcript`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segments }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Transcript save failed (${res.status}): ${errText}`);
  }
  return await res.json();
}

/**
 * Run the backend translation stage for a requested target language.
 */
export async function translateReview(runId, target) {
  const res = await fetch(`${API_BASE}/review/${runId}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Translation failed (${res.status}): ${errText}`);
  }
  return await res.json();
}

/**
 * Get export URL for backend-generated court report (HTML or PDF).
 */
export function getExportUrl(runId, fmt = 'pdf') {
  return `${API_BASE}/export/${runId}?fmt=${fmt}`;
}

/**
 * Static outputs URL (spectrograms, denoised WAV, etc.)
 */
export function getOutputUrl(filename) {
  return `${API_BASE}/outputs/${filename}`;
}
