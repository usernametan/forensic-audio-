import { jsPDF } from 'jspdf';
import { PIPELINE_STAGE_DEFINITIONS } from '../data/constants';
import { buildComparisonMetrics } from './review';
import { getOutputUrl } from '../services/api';
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  formatNumber,
  sanitizeFilename,
} from './format';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 273;

const INK = [41, 43, 39];
const SIDEBAR = [62, 64, 57];
const MUTED = [113, 110, 101];
const BORDER = [199, 189, 174];
const PANEL = [233, 224, 210];
const PANEL_SOFT = [242, 236, 226];
const IVORY = [248, 245, 239];
const EUCALYPTUS = [100, 118, 106];
const TERRACOTTA = [183, 124, 98];
const OCHRE = [195, 163, 94];
const DUSTY_BLUE = [113, 138, 160];
const FONT_STACK = '"Noto Sans", "Noto Sans Devanagari", "Nirmala UI", "Mangal", "Segoe UI", sans-serif';

let measureCanvas = null;

function isNonLatin(value) {
  return /[^\u0000-\u024F\u2000-\u206F\u20A0-\u20CF\u2100-\u214F\u2190-\u21FF]/u.test(String(value ?? ''));
}

function valueOr(value, fallback = 'Not returned') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

async function loadImageDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Image request failed (${response.status})`);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

function getMeasurementContext(size, style) {
  if (typeof document === 'undefined') return null;
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const context = measureCanvas.getContext('2d');
  const px = size * 0.352778 * 6;
  context.font = `${style === 'bold' ? '600' : '400'} ${px}px ${FONT_STACK}`;
  return { context, px };
}

function wrapCanvasText(text, maxWidthMm, size, style) {
  const measured = getMeasurementContext(size, style);
  if (!measured) return [String(text)];
  const { context, px } = measured;
  const maxPx = maxWidthMm * 6;
  const output = [];
  for (const rawLine of String(text).split('\n')) {
    const words = rawLine.split(/(\s+)/);
    let current = '';
    for (const word of words) {
      const candidate = current + word;
      if (!current || context.measureText(candidate).width <= maxPx) {
        current = candidate;
      } else {
        output.push(current.trimEnd());
        current = word.trimStart();
      }
      while (current && context.measureText(current).width > maxPx) {
        let cut = current.length;
        while (cut > 1 && context.measureText(current.slice(0, cut)).width > maxPx) cut -= 1;
        output.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
    output.push(current.trimEnd());
  }
  return output.filter((line, index) => line !== '' || index === 0);
}

function makeTextImage(text, { size, style, color, maxWidthMm }) {
  const scale = 6;
  const fontPx = size * 0.352778 * scale;
  const maxPx = maxWidthMm * scale;
  const measurement = getMeasurementContext(size, style);
  const rawWidth = measurement ? measurement.context.measureText(String(text)).width : maxPx;
  const widthPx = Math.max(8, Math.min(maxPx, Math.ceil(rawWidth) + 6));
  const heightPx = Math.ceil(fontPx * 1.65);
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, widthPx, heightPx);
  context.font = `${style === 'bold' ? '600' : '400'} ${fontPx}px ${FONT_STACK}`;
  context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.fillText(String(text), 3, heightPx / 2);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthMm: widthPx / scale,
    heightMm: heightPx / scale,
  };
}

export async function exportReportPdf(data) {
  if (!data?.meta) throw new Error('Report data is unavailable.');
  if (typeof document === 'undefined') throw new Error('PDF export is only available in the browser.');

  try {
    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => window.setTimeout(resolve, 1500)),
      ]);
    }
  } catch {
    // Font readiness is an enhancement; text rendering still proceeds below.
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = 0;

  const stageRows = PIPELINE_STAGE_DEFINITIONS.map((definition) => {
    const stage = data.reviewData?.stages?.[definition.key];
    let status = 'Not returned';
    if (stage) status = 'Completed';
    else if (data.pipeline?.currentStage?.toLowerCase().includes(definition.key)) status = 'Running';
    else if (data.pipeline?.status === 'failed') status = 'Failed / unavailable';
    return { ...definition, stage, status };
  });

  const diarizeSegments = data.reviewData?.stages?.diarize?.metrics?.segments || [];
  const speakerMap = new Map();
  for (const segment of diarizeSegments) {
    const speaker = segment.speaker || 'Unlabelled';
    const row = speakerMap.get(speaker) || { speaker, turns: 0, talk: 0 };
    row.turns += 1;
    row.talk += Math.max(0, Number(segment.end) - Number(segment.start));
    speakerMap.set(speaker, row);
  }
  const speakerRows = Array.from(speakerMap.values()).map((row) => ({
    ...row,
    share: diarizeSegments.length
      ? `${Math.round((Math.max(...diarizeSegments.map((segment) => Number(segment.end) || 0), 1) > 0
        ? row.talk / Math.max(...diarizeSegments.map((segment) => Number(segment.end) || 0), 1)
        : 0) * 100)}%`
      : '—',
  }));

  const comparisonMetrics = buildComparisonMetrics(data.comparison);
  const translationEngine = data.translationEngine || data.reviewData?.stages?.translate?.metrics?.engine || '';
  const languageLabel = { en: 'English', hi: 'Hindi', mr: 'Marathi' }[data.language] || 'Translation';

  const drawPageFrame = () => {
    doc.setFillColor(...IVORY);
    doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
    doc.setFillColor(...SIDEBAR);
    doc.rect(0, 0, PAGE_W, 11, 'F');
    doc.setFillColor(...TERRACOTTA);
    doc.rect(0, 11, PAGE_W, 0.7, 'F');
    doc.setTextColor(248, 245, 239);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('AUDIO FORENSICS', MARGIN, 5.4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.text('DIGITAL FORENSICS LABORATORY · FORENSIC AUDIO DIVISION', MARGIN, 8.8);
    doc.setFontSize(6.3);
    doc.text('EXAMINATION REPORT', PAGE_W - MARGIN, 8.8, { align: 'right' });

    doc.setTextColor(225, 217, 204);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(34);
    doc.text(data.meta.approved ? 'EXAMINER APPROVED' : 'DRAFT', 105, 150, { align: 'center', angle: 32 });

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 279, PAGE_W - MARGIN, 279);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(...MUTED);
    doc.text('Decision-support system · examiner approval required before reliance · admissibility remains a matter for the court', MARGIN, 284);
    doc.text(`${data.meta.reportId} · ${data.meta.approved ? 'APPROVED' : 'DRAFT'}`, PAGE_W - MARGIN, 284, { align: 'right' });
  };

  const newPage = () => {
    doc.addPage();
    drawPageFrame();
    y = 19;
  };

  const ensure = (height) => {
    if (y + height > BOTTOM) newPage();
  };

  drawPageFrame();
  y = 22;

  const setFont = (size, style = 'normal', color = INK) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const wrap = (text, width, size = 9, style = 'normal') => {
    if (isNonLatin(text)) return wrapCanvasText(text, width, size, style);
    setFont(size, style);
    return doc.splitTextToSize(String(text ?? ''), width);
  };

  const drawLine = (text, x, maxWidth, options = {}) => {
    const { size = 8.8, style = 'normal', color = INK, align = 'left' } = options;
    if (isNonLatin(text)) {
      const image = makeTextImage(text, { size, style, color, maxWidthMm: maxWidth });
      const drawX = align === 'right' ? x + maxWidth - image.widthMm : x;
      const imageY = y - image.heightMm * 0.76;
      doc.addImage(image.dataUrl, 'PNG', drawX, imageY, image.widthMm, image.heightMm);
      return image.widthMm;
    }
    setFont(size, style, color);
    doc.text(String(text ?? ''), x, y, { align, maxWidth });
    return Math.min(maxWidth, doc.getTextWidth(String(text ?? '')));
  };

  const paragraph = (text, options = {}) => {
    const {
      x = MARGIN,
      width = CONTENT_W,
      size = 9,
      style = 'normal',
      color = INK,
      lineHeight = 4.6,
      spacingAfter = 2,
    } = options;
    const lines = wrap(text, width, size, style);
    lines.forEach((line) => {
      ensure(lineHeight);
      drawLine(line, x, width, { size, style, color });
      y += lineHeight;
    });
    y += spacingAfter;
  };

  const heading = (num, title) => {
    ensure(16);
    doc.setFillColor(...TERRACOTTA);
    doc.roundedRect(MARGIN, y - 3.2, 5.7, 5.7, 1.2, 1.2, 'F');
    setFont(8, 'bold', [248, 245, 239]);
    doc.text(String(num), MARGIN + 2.85, y + 0.2, { align: 'center' });
    drawLine(title, MARGIN + 8.5, CONTENT_W - 8.5, { size: 11, style: 'bold', color: INK });
    y += 5;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  };

  const subheading = (text) => {
    ensure(9);
    drawLine(text, MARGIN, CONTENT_W, { size: 8.5, style: 'bold', color: SIDEBAR });
    y += 5;
  };

  const bullet = (text) => {
    const lines = wrap(text, CONTENT_W - 6, 8.7);
    lines.forEach((line, index) => {
      ensure(4.4);
      if (index === 0) {
        setFont(8.7, 'bold', TERRACOTTA);
        doc.text('•', MARGIN, y);
      }
      drawLine(line, MARGIN + 5, CONTENT_W - 5, { size: 8.7, color: INK });
      y += 4.4;
    });
    y += 0.8;
  };

  const kvRow = (label, value, { labelWidth = 48, mono = false } = {}) => {
    ensure(7);
    const valueText = valueOr(value, 'Not returned');
    const valueWidth = CONTENT_W - labelWidth;
    drawLine(label, MARGIN, labelWidth - 5, { size: 7.6, style: 'bold', color: MUTED });
    const before = y;
    const lines = wrap(valueText, valueWidth, 8.2, 'normal');
    lines.forEach((line, index) => {
      if (index > 0) ensure(4);
      drawLine(line, MARGIN + labelWidth, valueWidth, { size: 8.2, color: INK });
      y += 4.05;
    });
    if (y - before < 5) y = before + 5;
    y += 1.1;
  };

  const table = (headers, rows, widths) => {
    const drawRow = (cells, header = false) => {
      const wrapped = cells.map((cell, index) => ({
        lines: wrap(String(cell ?? ''), widths[index] - 4, 7.6, header ? 'bold' : 'normal'),
        width: widths[index],
      }));
      const rowHeight = Math.max(...wrapped.map((cell) => cell.lines.length)) * 3.7 + 3.6;
      ensure(rowHeight);
      if (header) {
        doc.setFillColor(...SIDEBAR);
        doc.rect(MARGIN, y - 0.5, CONTENT_W, rowHeight, 'F');
      } else if (rows.indexOf(cells) % 2 === 1) {
        doc.setFillColor(...PANEL_SOFT);
        doc.rect(MARGIN, y - 0.5, CONTENT_W, rowHeight, 'F');
      }
      let x = MARGIN;
      wrapped.forEach((cell, index) => {
        cell.lines.forEach((line, lineIndex) => {
          drawLine(line, x + 2, cell.width - 4, {
            size: 7.6,
            style: header ? 'bold' : 'normal',
            color: header ? [248, 245, 239] : INK,
          });
          y += 3.7;
        });
        const drawnLines = cell.lines.length;
        y -= drawnLines * 3.7;
        x += cell.width;
      });
      y += rowHeight;
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.18);
      doc.line(MARGIN, y - 0.5, PAGE_W - MARGIN, y - 0.5);
    };

    drawRow(headers, true);
    rows.forEach((row) => drawRow(row, false));
    y += 2;
  };

  const notice = (text, tone = 'info') => {
    const lines = wrap(text, CONTENT_W - 10, 8.2);
    const height = lines.length * 4 + 6;
    ensure(height);
    const color = tone === 'warning' ? [249, 238, 218] : PANEL_SOFT;
    const border = tone === 'warning' ? OCHRE : BORDER;
    doc.setFillColor(...color);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y - 1, CONTENT_W, height, 1.5, 1.5, 'FD');
    y += 4;
    lines.forEach((line) => {
      drawLine(line, MARGIN + 4, CONTENT_W - 8, { size: 8.2, color: INK });
      y += 4;
    });
    y += 3;
  };

  // ---- Title block ----
  ensure(56);
  const titleTop = y;
  doc.setFillColor(...PANEL);
  doc.roundedRect(MARGIN, titleTop, CONTENT_W, 33, 2.5, 2.5, 'F');
  doc.setFillColor(...TERRACOTTA);
  doc.roundedRect(MARGIN, titleTop, 3, 33, 1.2, 1.2, 'F');
  y = titleTop + 10;
  drawLine('FORENSIC AUDIO EXAMINATION REPORT', MARGIN + 7, 112, { size: 16, style: 'bold', color: SIDEBAR });
  y = titleTop + 16;
  drawLine('Evidence integrity · preprocessing · diarization · comparison · transcript · translation · limitations', MARGIN + 7, 112, { size: 7.4, color: MUTED });
  y = titleTop + 23;
  drawLine(`Case ${valueOr(data.caseInfo?.id, 'Not provided')}  ·  Report ${data.meta.reportId}`, MARGIN + 7, 132, { size: 8.3, style: 'bold', color: INK });
  y = titleTop + 28;
  drawLine(`Generated ${data.meta.generatedAt}`, MARGIN + 7, 90, { size: 7.4, color: MUTED });

  y = titleTop + 37;
  doc.setFillColor(...(data.meta.approved ? [229, 236, 229] : [248, 238, 222]));
  doc.setDrawColor(...(data.meta.approved ? EUCALYPTUS : OCHRE));
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, CONTENT_W, 16, 1.5, 1.5, 'FD');
  const banner = data.meta.approved
    ? 'EXAMINER APPROVED — REPORT READY FOR EXPORT'
    : 'DRAFT — EXAMINER REVIEW AND SIGN-OFF REQUIRED';
  drawLine(banner, MARGIN + 4, CONTENT_W - 8, { size: 8.6, style: 'bold', color: data.meta.approved ? EUCALYPTUS : [145, 96, 48] });
  y += 5;
  drawLine(
    data.meta.approved
      ? 'The backend recorded examiner approval. This system does not itself determine legal admissibility.'
      : 'Automated outputs are decision support only. The certificate remains incomplete until examiner approval.',
    MARGIN + 4,
    CONTENT_W - 8,
    { size: 7.2, color: MUTED },
  );
  y += 17;

  // ---- 1. Case ----
  heading('1', 'Case reference & chain of custody');
  kvRow('Case ID', data.caseInfo?.id, { labelWidth: 46 });
  kvRow('Case title', data.caseInfo?.title, { labelWidth: 46 });
  kvRow('Custody source', data.caseInfo?.source, { labelWidth: 46 });
  kvRow('Seizing / examining officer', data.caseInfo?.collector, { labelWidth: 46 });
  kvRow('Pipeline run', data.meta.reportId === 'RPT-DRAFT' ? 'Not started' : data.meta.reportId.replace(/^RPT-/, ''), { labelWidth: 46 });
  kvRow('Session opened', formatDateTime(data.sessionStartedAt), { labelWidth: 46 });
  kvRow('Review status', data.meta.status, { labelWidth: 46 });
  kvRow('Signed examiner', data.meta.approved ? data.reviewData?.approved_by || data.examinerName || 'Not signed' : 'Pending sign-off', { labelWidth: 46 });
  y += 2;

  heading('2. Evidence File Details');
  body('Questioned exhibit', { style: 'bold', size: 9.5 });
  kv([
    ['Reference', data.evidence.ref],
    ['File name', data.evidence.name],
    ['Duration', data.evidence.duration],
    ['Format', data.evidence.format],
    ['Sample rate', data.evidence.sampleRate],
    ['Channels', data.evidence.channels],
    ['SHA-256 (truncated)', data.evidence.hash],
    ['Captured', data.evidence.captured],
  ]);
  y += 1;
  body('Reference voice sample', { style: 'bold', size: 9.5 });
  kv([
    ['Reference', data.reference.ref],
    ['File name', data.reference.name],
    ['Duration', data.reference.duration],
    ['Format', data.reference.format],
    ['Origin', data.reference.origin],
    ['Quality / SNR', `${data.reference.quality} / ${data.reference.snr}`],
  ]);
  y += 2;

  heading('3. Audio Preprocessing Steps');
  ['noise', 'enhance', 'separate'].forEach((key) => {
    const stage = data.stages[key];
    const label = { noise: 'Noise Reduction', enhance: 'Audio Enhancement', separate: 'Speaker Separation' }[key];
    bullet(`${label} — ${stage.status.toUpperCase()} (${stage.progress}%)`);
  });
  y += 2;

  heading('4. Speaker Separation Summary');
  bullet('Diarization returned 2 speaker tracks across 47 speech segments.');
  bullet('Speaker 01 — 02:31 active, 58% talk time, 29 segments, pitch band 112–148 Hz.');
  bullet('Speaker 02 — 01:48 active, 42% talk time, 18 segments, pitch band 164–205 Hz.');
  y += 2;

  heading('5. Comparison Methodology & Illustrative Observations');
  body(
    'Methodology: both samples were passed through a simulated feature pipeline (VAD segmentation, MFCC extraction, pitch/prosody statistics). The indices below are deterministic mock values produced by the prototype — no validated forensic audio engine or trained speaker-recognition model was involved.'
  );
  y += 1;
  if (data.comparison.status === 'done' && data.comparison.result) {
    const r = data.comparison.result;
    r.metrics.forEach((m) => {
      bullet(`${m.name}: ${m.value.toFixed(2)} (illustrative)`);
    });
    bullet(`Composite illustrative index: ${r.composite.toFixed(2)} — ${r.verdictBand}.`);
    body(
      'IMPORTANT: These figures do NOT establish that the questioned and reference samples were produced by the same person or by different persons. No identification conclusion is claimed or implied.',
      { style: 'bold', color: [150, 60, 20] }
    );
  } else {
    body('Comparison pipeline was not executed for this session; see live application for demo run.', {
      color: [150, 60, 20],
    });
  }

  // ---- 7. Transcript ----
  const transcriptSegments = data.transcript?.original || [];
  heading('7', 'Original transcript');
  paragraph(
    `Engine: ${valueOr(data.transcript?.transcribeStage?.metrics?.engine)} · Model: ${valueOr(data.transcript?.transcribeStage?.model)} ${valueOr(data.transcript?.transcribeStage?.version, '')}`.trim(),
    { size: 7.4, color: MUTED, spacingAfter: 2 },
  );
  if (transcriptSegments.length) {
    transcriptSegments.forEach((segment) => {
      bullet(`[${formatDuration(segment.start, true)}–${formatDuration(segment.end, true)}] ${segment.speaker}: ${segment.text || '—'}`);
    });
  } else {
    paragraph('No transcript segments were returned for this run.', { color: MUTED, style: 'italic' });
  }

  // ---- 8. Translation ----
  const translatedSegments = data.transcript?.translated || [];
  heading('8', `Translation — ${languageLabel}`);
  paragraph(
    `Engine: ${translationEngine || 'Not run'}. Machine translation is not a certified translation and must be verified against the source audio.${translationEngine === 'stub' ? ' The backend reported a documented fallback stub; the output is not a validated translation.' : ''}`,
    { size: 7.4, color: MUTED, spacingAfter: 2 },
  );
  if (translatedSegments.length) {
    translatedSegments.forEach((segment) => {
      bullet(`[${formatDuration(segment.start, true)}–${formatDuration(segment.end, true)}] ${segment.speaker}: ${segment.text || '—'}`);
    });
  } else {
    paragraph('No translated segments are available.', { color: MUTED, style: 'italic' });
  }

  // ---- 9. Limitations ----
  heading('9', 'Limitations & technical notes');
  (data.limitations || []).forEach((limitation) => bullet(limitation));

  // ---- 10. Conclusion ----
  heading('10', 'Examiner review & conclusion');
  if (data.meta.approved) {
    kvRow('Examiner', data.reviewData?.approved_by || data.examinerName, { labelWidth: 44 });
    kvRow('Status', 'Approved by backend review gate', { labelWidth: 44 });
    kvRow('Conclusion', data.reviewData?.conclusion || data.conclusion || 'Not recorded', { labelWidth: 44 });
  } else {
    notice('This report has not been approved. The examiner conclusion and certification fields below are incomplete.', 'warning');
    kvRow('Examiner', data.examinerName || 'Pending approval', { labelWidth: 44 });
    kvRow('Conclusion', data.conclusion || 'Not recorded', { labelWidth: 44 });
  }

  // ---- 11. Certificate ----
  heading('11', 'Certificate under Section 65B Indian Evidence Act / Section 63 BSA 2023');
  ensure(86);
  const certTop = y - 2;
  doc.setFillColor(...PANEL_SOFT);
  doc.setDrawColor(...(data.meta.approved ? EUCALYPTUS : OCHRE));
  doc.setLineWidth(0.45);
  doc.roundedRect(MARGIN, certTop, CONTENT_W, 83, 2, 2, 'FD');
  y = certTop + 6;
  drawLine('CERTIFICATE OF ELECTRONIC RECORD — TEMPLATE & CERTIFICATION FIELDS', MARGIN + 4, CONTENT_W - 8, {
    size: 8.2,
    style: 'bold',
    color: data.meta.approved ? EUCALYPTUS : [145, 96, 48],
  });
  y += 6;
  const certWidth = CONTENT_W - 8;
  const certLines = wrap(
    `Part-A (hash & integrity verification): The electronic record marked Exhibit ${valueOr(data.evidence?.ref, 'Not assigned')}${data.evidence?.name ? ` (${data.evidence.name})` : ''} was hashed by the backend on receipt with SHA-256 value ${valueOr(data.evidence?.hash, 'not available')}. The working-copy SHA-256 is ${valueOr(data.reviewData?.working_copy?.sha256, 'not available')}. The original was preserved read-only and processing was performed on working copies.`,
    certWidth,
    7.2,
  );
  certLines.slice(0, 9).forEach((line) => {
    drawLine(line, MARGIN + 4, certWidth, { size: 7.2, color: INK });
    y += 3.5;
  });
  y += 1;
  const partB = wrap(
    `Part-B (system & ordinary course certification): I, ${data.meta.approved ? valueOr(data.reviewData?.approved_by || data.examinerName) : 'Examiner not yet signed'}, certify that this electronic output was produced by the forensic audio system in the ordinary course, that the system was operating properly, and that an immutable audit log was maintained for the operations recorded by the backend.`,
    certWidth,
    7.2,
  );
  partB.slice(0, 6).forEach((line) => {
    drawLine(line, MARGIN + 4, certWidth, { size: 7.2, style: 'bold', color: INK });
    y += 3.5;
  });
  y += 2;
  drawLine(`Certifying examiner: ${data.meta.approved ? valueOr(data.reviewData?.approved_by || data.examinerName) : 'Pending approval'}`, MARGIN + 4, certWidth, { size: 7.4, color: INK });
  y += 4;
  drawLine(`Certificate status: ${data.meta.approved ? 'Examiner approved — certificate fields recorded' : 'Draft — not certified'}`, MARGIN + 4, certWidth, { size: 7.4, color: INK });
  y += 4;
  drawLine(`Date: ${data.meta.generatedAt}   ·   Signature: ______________________________`, MARGIN + 4, certWidth, { size: 7.4, color: INK });
  y += 4;
  drawLine('This system records certificate fields and examiner actions; it does not itself establish legal admissibility.', MARGIN + 4, certWidth, { size: 6.6, color: MUTED });
  y = certTop + 86;

  // ---- Page numbers ----
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    setFont(6.5, 'normal', MUTED);
    doc.text(`Page ${page} of ${pages}`, PAGE_W - MARGIN, 290, { align: 'right' });
  }

  const casePart = sanitizeFilename(data.caseInfo?.id || 'case');
  const reportPart = sanitizeFilename(data.meta.reportId || 'report');
  const draftPart = data.meta.approved ? '' : '_DRAFT';
  doc.save(`${casePart}_${reportPart}${draftPart}.pdf`);
}
