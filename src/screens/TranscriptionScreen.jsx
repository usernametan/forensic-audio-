import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Languages,
  Wand2,
  Loader2,
  ShieldQuestion,
  CheckCircle2,
  ChevronRight,
  FileText,
  Pencil,
  Save,
  Undo2,
  AlertTriangle,
  Clock3,
  Flag,
  Info,
  Mic2,
} from 'lucide-react';
import Panel from '../components/Panel.jsx';
import PageHeading from '../components/PageHeading.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import AudioPlayer from '../components/AudioPlayer.jsx';
import EmptyState from '../components/EmptyState.jsx';
import MetaList from '../components/MetaList.jsx';
import useObjectUrl from '../hooks/useObjectUrl';
import { useToast } from '../components/Toast.jsx';
import { speakerLabel } from '../components/SpeakerTimeline.jsx';
import { transcriptToPayload } from '../utils/review';
import { formatDuration, pluralize } from '../utils/format';
import { getOutputUrl } from '../services/api';

const TARGETS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
];

function statusTone(status) {
  if (status === 'reviewed') return 'success';
  if (status === 'uncertain') return 'warning';
  return 'neutral';
}

export default function TranscriptionScreen({
  transcript,
  runId,
  backendStatus,
  reviewData,
  language,
  setLanguage,
  onTranslate,
  onSaveTranscript,
  evidence,
  onContinue,
}) {
  const [segments, setSegments] = useState(transcript.original);
  const [activeTab, setActiveTab] = useState('original');
  const [editingId, setEditingId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedNote, setSavedNote] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const persistedTarget = reviewData?.stages?.translate?.metrics?.target || '';
  const [appliedTarget, setAppliedTarget] = useState(persistedTarget || (transcript.translated.length ? 'en' : ''));
  const [translationInfo, setTranslationInfo] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef(null);
  const notify = useToast();
  const originalUrl = useObjectUrl(evidence?.file);
  const denoiseStage = reviewData?.stages?.denoise;
  const processedUrl = runId && denoiseStage ? getOutputUrl(`${runId}_denoised.wav`) : '';
  const audioUrl = processedUrl || originalUrl;
  const transcriptAvailable = transcript.original.length > 0;
  const translateStage = reviewData?.stages?.translate;
  const activeEngine = translationInfo?.engine || translateStage?.metrics?.engine || '';

  useEffect(() => {
    setSegments(transcript.original);
    setDirty(false);
    setEditingId(null);
  }, [transcript.original]);

  useEffect(() => {
    if (persistedTarget && transcript.translated.length) {
      setAppliedTarget(persistedTarget);
      return;
    }
    if (transcript.translated.length && !appliedTarget) setAppliedTarget('en');
    if (!transcript.translated.length) {
      setAppliedTarget('');
      setTranslationInfo(null);
      setActiveTab((tab) => (tab === 'translation' ? 'original' : tab));
    }
  }, [transcript.translated.length, appliedTarget, persistedTarget]);

  useEffect(() => {
    if (translateStage?.metrics?.engine && !translationInfo) {
      setTranslationInfo({
        engine: translateStage.metrics.engine,
        model: translateStage.model,
        version: translateStage.version,
      });
    }
  }, [translateStage, translationInfo]);

  const originalById = useMemo(
    () => new Map(transcript.original.map((segment) => [segment.id, segment.text])),
    [transcript.original]
  );

  const activeSegmentId = useMemo(() => {
    const active = segments.find((segment) => currentTime >= segment.start && currentTime < segment.end);
    return active?.id || null;
  }, [segments, currentTime]);

  const reviewedCount = segments.filter((segment) => segment.reviewStatus === 'reviewed').length;
  const uncertainCount = segments.filter((segment) => segment.uncertain).length;
  const editedCount = segments.filter((segment) => originalById.get(segment.id) !== segment.text).length;

  const updateSegment = (id, patch) => {
    setSegments((current) => current.map((segment) => (segment.id === id ? { ...segment, ...patch } : segment)));
    setDirty(true);
    setSavedNote('');
    setSaveError('');
  };

  const seekTo = (time) => {
    if (!audioUrl) return;
    playerRef.current?.seek(time);
  };

  const saveChanges = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setSaveError('');
    try {
      await onSaveTranscript(transcriptToPayload(segments));
      setDirty(false);
      setSavedNote(`Saved to backend at ${new Date().toLocaleTimeString('en-IN')}`);
      notify('Transcript corrections saved to the analysis run.', 'success');
    } catch (error) {
      setSaveError(error.message);
      notify(`Transcript save failed: ${error.message}. Your edits remain in this browser.`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyTranslation = async () => {
    if (translating || !runId) return;
    setTranslating(true);
    setTranslationError('');
    try {
      const response = await onTranslate(language);
      setAppliedTarget(language);
      setTranslationInfo({ engine: response.engine, model: response.model, version: response.version });
      setActiveTab('translation');
      notify(`Backend translation stage completed for ${TARGETS.find((target) => target.value === language)?.label || language}.`, 'success');
    } catch (error) {
      setTranslationError(error.message);
      notify(`Translation failed: ${error.message}`, 'error');
    } finally {
      setTranslating(false);
    }
  };

  const translationLabel = TARGETS.find((target) => target.value === appliedTarget)?.label || 'Translation';
  const staleTranslation = language !== appliedTarget;

  if (!transcriptAvailable) {
    return (
      <div className="stack-xl">
        <PageHeading
          eyebrow="Step 04 · Linguistic review"
          title="Transcription & examiner review"
          description="Review the timestamp-aligned transcript, correct uncertain content, and verify any machine translation."
          actions={<StatusBadge tone="warning"><ShieldQuestion size={12} /> No transcript returned</StatusBadge>}
        />
        <Panel>
          <EmptyState icon={<FileText size={24} />} title="No transcript is available">
            <p>
              A transcript appears here only after the backend transcription stage returns segments. No sample transcript is substituted.
            </p>
            <p>
              {runId
                ? 'The active run has not returned transcript data yet. Check the audio analysis workspace for pipeline status.'
                : 'Upload and analyse a questioned exhibit first.'}
            </p>
            {audioUrl && (
              <div className="empty-audio">
                <AudioPlayer ref={playerRef} src={audioUrl} title="Analysis audio" onTimeUpdate={setCurrentTime} />
              </div>
            )}
          </EmptyState>
        </Panel>
        <div className="cta-row">
          <p className="cta-note muted">A report can still be opened; it will state that no transcript was available.</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={onContinue}>
            Open report <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-xl">
      <PageHeading
        eyebrow="Step 04 · Linguistic review"
        title="Transcription & examiner review"
        description="The transcript below is returned by the backend speech-recognition stage. Confidence values are shown only when the backend provides them; no transcript is generated in the browser."
        actions={
          <>
            <StatusBadge tone={dirty ? 'warning' : saveError ? 'danger' : 'success'}>
              {dirty ? 'Unsaved draft' : saveError ? 'Save failed' : 'Saved state'}
            </StatusBadge>
            {transcript.transcribeStage?.model && (
              <StatusBadge tone="neutral">{transcript.transcribeStage.model}</StatusBadge>
            )}
          </>
        }
      />

      {backendStatus !== 'online' && (
        <div className="inline-alert warning banner">
          <Info size={16} />
          <div>
            <strong>Analysis service offline</strong>
            <p>Existing transcript text remains readable, but edits and translation cannot be persisted without the backend.</p>
          </div>
        </div>
      )}

      {sendTranscriptWarning(transcript)}
      {sendTranscriptError(transcript, saveError, translationError)}

      <div className="transcript-layout">
        <div className="transcript-main">
          <Panel
            className="transcript-panel"
            icon={activeTab === 'original' ? <FileText size={17} /> : <Languages size={17} />}
            title={activeTab === 'original' ? 'Original language transcript' : `${translationLabel} translation`}
            subtitle={
              activeTab === 'original'
                ? `${pluralize(segments.length, 'segment')} · source language reported by the backend: ${reviewData?.stages?.transcribe?.metrics?.language || 'not specified'}`
                : `Backend translation target: ${translationLabel}${activeEngine ? ` · engine: ${activeEngine}` : ''}`
            }
            actions={
              <div className="source-tabs" role="tablist" aria-label="Transcript view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'original'}
                  className={activeTab === 'original' ? 'active' : ''}
                  onClick={() => setActiveTab('original')}
                >
                  Original
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'translation'}
                  className={activeTab === 'translation' ? 'active' : ''}
                  onClick={() => setActiveTab('translation')}
                  disabled={!transcript.translated.length}
                  title={!transcript.translated.length ? 'No backend translation has been generated yet' : 'Translation'}
                >
                  Translation
                </button>
              </div>
            }
          >
            {activeTab === 'original' ? (
              <>
                {staleTranslation && (
                  <p className="inline-alert warning">
                    <Info size={14} /> The selected translation target ({TARGETS.find((target) => target.value === language)?.label}) has not been applied. {transcript.translated.length ? 'The translation tab still shows the previous backend output.' : 'Run the backend translation to generate output for this target.'}
                  </p>
                )}
                <div className="transcript-list">
                  {segments.map((segment) => {
                    const isEditing = editingId === segment.id;
                    const isActive = activeSegmentId === segment.id;
                    const isEdited = originalById.get(segment.id) !== segment.text;
                    return (
                      <article
                        key={segment.id}
                        className={`transcript-segment ${isActive ? 'active' : ''} ${isEditing ? 'editing' : ''}`.trim()}
                      >
                        <div className="segment-gutter">
                          <button
                            type="button"
                            className="segment-time"
                            onClick={() => seekTo(segment.start)}
                            disabled={!audioUrl}
                            title={audioUrl ? `Seek to ${formatDuration(segment.start)}` : 'No playable audio source'}
                          >
                            <Clock3 size={12} />
                            <span className="mono">{formatDuration(segment.start, true)}</span>
                          </button>
                          <span className={`segment-speaker ${segment.speaker || 'unknown'}`}>
                            <Mic2 size={12} /> {speakerLabel(segment.speaker)}
                          </span>
                          <span className="mono segment-end">→ {formatDuration(segment.end, true)}</span>
                        </div>
                        <div className="segment-content">
                          {isEditing ? (
                            <textarea
                              className="input segment-textarea"
                              value={segment.text}
                              onChange={(event) => updateSegment(segment.id, { text: event.target.value })}
                              rows={Math.max(2, Math.ceil(segment.text.length / 72))}
                              aria-label={`Transcript text for ${formatDuration(segment.start)}`}
                              autoFocus
                            />
                          ) : (
                            <p className="segment-text">{segment.text || '—'}</p>
                          )}
                          <div className="segment-badges">
                            <StatusBadge tone={statusTone(segment.reviewStatus)} dot={false} className="badge-small">
                              {segment.reviewStatus === 'reviewed' ? 'Reviewed' : segment.reviewStatus === 'uncertain' ? 'Uncertain' : 'Unreviewed'}
                            </StatusBadge>
                            {segment.uncertain && (
                              <StatusBadge tone="warning" dot={false} className="badge-small">
                                <Flag size={10} /> Flagged
                              </StatusBadge>
                            )}
                            {isEdited && (
                              <StatusBadge tone="info" dot={false} className="badge-small">
                                <Pencil size={10} /> Edited
                              </StatusBadge>
                            )}
                          </div>
                          <div className="segment-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => setEditingId(isEditing ? null : segment.id)}
                            >
                              {isEditing ? <CheckCircle2 size={13} /> : <Pencil size={13} />}
                              {isEditing ? 'Finish editing' : 'Edit text'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() =>
                                updateSegment(segment.id, {
                                  reviewStatus: segment.reviewStatus === 'reviewed' ? 'unreviewed' : 'reviewed',
                                })
                              }
                            >
                              <CheckCircle2 size={13} />
                              {segment.reviewStatus === 'reviewed' ? 'Mark unreviewed' : 'Mark reviewed'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => updateSegment(segment.id, { uncertain: !segment.uncertain })}
                            >
                              <Flag size={13} />
                              {segment.uncertain ? 'Clear uncertainty flag' : 'Flag uncertain'}
                            </button>
                            {audioUrl && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => seekTo(segment.start)}
                              >
                                <Clock3 size={13} /> Seek audio
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="transcript-list translated">
                {transcript.translated.length ? (
                  transcript.translated.map((segment) => (
                    <article className="transcript-segment" key={segment.id}>
                      <div className="segment-gutter">
                        <button
                          type="button"
                          className="segment-time"
                          onClick={() => seekTo(segment.start)}
                          disabled={!audioUrl}
                        >
                          <Clock3 size={12} />
                          <span className="mono">{formatDuration(segment.start, true)}</span>
                        </button>
                        <span className={`segment-speaker ${segment.speaker || 'unknown'}`}>
                          <Mic2 size={12} /> {speakerLabel(segment.speaker)}
                        </span>
                      </div>
                      <div className="segment-content">
                        <p className="segment-text translated-text">{segment.text || '—'}</p>
                        <p className="field-help">
                          Machine translation output. Verify against the original audio and transcript; it is not a certified translation.
                        </p>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState compact icon={<Languages size={20} />} title="No translation returned">
                    <p>Choose a target language and run the backend translation stage.</p>
                  </EmptyState>
                )}
              </div>
            )}
          </Panel>
        </div>

        <aside className="transcript-side">
          <Panel icon={<Mic2 size={17} />} title="Review audio" subtitle="Click a timestamp to seek. The active segment is highlighted during playback.">
            {audioUrl ? (
              <AudioPlayer ref={playerRef} src={audioUrl} title="Transcript audio" onTimeUpdate={setCurrentTime} />
            ) : (
              <EmptyState compact icon={<Mic2 size={20} />} title="No playable audio">
                <p>The browser no longer holds the original file and processed audio is unavailable.</p>
              </EmptyState>
            )}
            <div className="audio-source-note">
              <span className="muted small">
                Source: {processedUrl ? 'processed denoised output' : originalUrl ? 'original exhibit' : 'unavailable'}
              </span>
              {activeSegmentId && (
                <span className="mono small">
                  active {formatDuration(currentTime, true)}
                </span>
              )}
            </div>
          </Panel>

          <Panel
            icon={<Languages size={17} />}
            title="Translation controls"
            subtitle="Uses the backend translation stage. The engine is shown so a documented fallback is never mistaken for a verified translation."
          >
            <label className="field">
              <span className="field-label"><Languages size={13} /> Target language</span>
              <select
                className="input select"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                disabled={!runId || backendStatus !== 'online' || translating}
              >
                {TARGETS.map((target) => (
                  <option value={target.value} key={target.value}>{target.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={applyTranslation}
              disabled={!runId || backendStatus !== 'online' || translating || !transcriptAvailable}
            >
              {translating ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />}
              {translating ? 'Running backend translation…' : 'Apply translation'}
            </button>
            {translationError && (
              <p className="inline-alert error" role="alert">
                <AlertTriangle size={14} /> {translationError}
              </p>
            )}
            <div className="translation-meta">
              <StatusBadge tone={activeEngine === 'stub' ? 'warning' : translationInfo ? 'success' : 'neutral'}>
                {activeEngine ? `Engine: ${activeEngine}` : 'No translation run yet'}
              </StatusBadge>
              {translationInfo?.model && (
                <span className="muted small">{translationInfo.model} {translationInfo.version}</span>
              )}
            </div>
            {activeEngine === 'stub' && (
              <p className="inline-alert warning">
                <AlertTriangle size={14} /> The backend reported that IndicTrans2 was not available and used its documented fallback. The output is not a validated translation and must not be represented as one.
              </p>
            )}
            {!runId && (
              <p className="field-help">Translation requires an active backend run and transcript.</p>
            )}
          </Panel>

          <Panel icon={<CheckCircle2 size={17} />} title="Review status" subtitle="Draft edits remain local until you save them to the run.">
            <div className="review-stat-grid">
              <div className="review-stat">
                <span className="review-stat-value mono">{segments.length}</span>
                <span className="review-stat-label">Segments</span>
              </div>
              <div className="review-stat">
                <span className="review-stat-value mono">{reviewedCount}</span>
                <span className="review-stat-label">Reviewed</span>
              </div>
              <div className="review-stat">
                <span className="review-stat-value mono">{uncertainCount}</span>
                <span className="review-stat-label">Flagged uncertain</span>
              </div>
              <div className="review-stat">
                <span className="review-stat-value mono">{editedCount}</span>
                <span className="review-stat-label">Edited</span>
              </div>
            </div>

            <div className="save-state">
              <div>
                <p className="label-strong small">{dirty ? 'Unsaved changes' : savedNote ? 'Saved to backend' : 'No local changes'}</p>
                <p className="muted small">
                  {dirty
                    ? 'Review the edits, then save. If the save fails, the edits remain here.'
                    : savedNote || 'Saving transcript corrections requires the backend review endpoint.'}
                </p>
              </div>
              {dirty && (
                <span className="unsaved-dot" aria-label="Unsaved changes" />
              )}
            </div>

            {saveError && (
              <p className="inline-alert error" role="alert">
                <AlertTriangle size={14} /> {saveError}
              </p>
            )}
            {savedNote && !dirty && (
              <p className="inline-alert success">
                <CheckCircle2 size={14} /> {savedNote}
              </p>
            )}

            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveChanges}
                disabled={!dirty || saving || !runId || backendStatus !== 'online'}
              >
                {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                {saving ? 'Saving…' : 'Save transcript'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSegments(transcript.original);
                  setDirty(false);
                  setEditingId(null);
                  setSaveError('');
                  setSavedNote('');
                }}
                disabled={!dirty || saving}
              >
                <Undo2 size={15} /> Discard changes
              </button>
            </div>
            <p className="field-help">
              Saving transcript changes resets any prior examiner approval so the report cannot be certified against outdated content.
            </p>
          </Panel>

          <Panel icon={<FileText size={17} />} title="Run information">
            <MetaList
              compact
              columns={1}
              items={[
                { label: 'Run ID', value: runId || 'Not started', mono: true },
                { label: 'ASR model', value: transcript.transcribeStage?.model || 'Not returned' },
                { label: 'ASR version', value: transcript.transcribeStage?.version || 'Not returned', mono: true },
                { label: 'Translation engine', value: activeEngine || 'Not run' },
                { label: 'Segments with timing', value: `${segments.filter((segment) => segment.end > segment.start).length} of ${segments.length}` },
              ]}
            />
          </Panel>
        </aside>
      </div>

      <div className="cta-row">
        <div className="cta-copy">
          <p className="cta-title">Attach transcript to the draft report</p>
          <p className="cta-note muted">
            {dirty ? 'You have unsaved transcript edits. They will not appear in the report until saved to the backend.' : 'The current saved transcript and translation are available to the report preview.'}
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={onContinue}>
          Review report <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function sendTranscriptWarning(transcript) {
  if (!transcript.transcribeStage) return null;
  if (transcript.transcribeStage.metrics?.engine === 'stub') {
    return (
      <div className="inline-alert warning banner">
        <AlertTriangle size={16} />
        <div>
          <strong>Transcription fallback reported</strong>
          <p>The backend did not run a full Whisper model and returned fallback placeholder segments. Treat this text as unavailable analysis, not as a transcript.</p>
        </div>
      </div>
    );
  }
  return null;
}

function sendTranscriptError(transcript, saveError, translationError) {
  if (!saveError && !translationError) return null;
  return (
    <div className="inline-alert error banner" role="alert">
      <AlertTriangle size={16} />
      <div>
        <strong>An operation did not complete</strong>
        {saveError && <p>Transcript save: {saveError}</p>}
        {translationError && <p>Translation: {translationError}</p>}
        <p>No success state is being shown for the failed operation.</p>
      </div>
    </div>
  );
}
