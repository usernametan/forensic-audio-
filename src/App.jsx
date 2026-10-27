import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import FlowStepper from './components/FlowStepper.jsx';
import { useToast } from './components/Toast.jsx';
import DashboardScreen from './screens/DashboardScreen.jsx';
import PreprocessingScreen from './screens/PreprocessingScreen.jsx';
import ComparisonScreen from './screens/ComparisonScreen.jsx';
import TranscriptionScreen from './screens/TranscriptionScreen.jsx';
import ReportScreen from './screens/ReportScreen.jsx';
import { EMPTY_CASE, SCREENS } from './data/constants';
import {
  checkBackendHealth,
  compareSpecimen,
  getEvidence,
  getPipelineStatus,
  getReview,
  saveTranscript,
  submitReview,
  translateReview,
  uploadEvidence,
} from './services/api';
import { normalizeComparison, normalizeTranscript } from './utils/review';
import { formatChannels, formatCodec, formatDuration, formatSampleRate } from './utils/format';

const initialPipeline = {
  status: 'idle',
  currentStage: '',
  progress: 0,
  stages: [],
  error: '',
};

function metadataFromUpload(upload) {
  return {
    backendId: upload.evidence_id,
    backendMeta: upload,
    hash: upload.sha256,
    backendVerified: true,
    duration: formatDuration(upload.duration_s),
    durationSeconds: upload.duration_s,
    format: formatCodec(upload.codec),
    sampleRate: formatSampleRate(upload.sample_rate),
    sampleRateHz: upload.sample_rate,
    channels: formatChannels(upload.channels),
    channelCount: upload.channels,
    sizeMB: upload.bytes / (1024 * 1024),
    bytes: upload.bytes,
  };
}

function specimenMetadata(specimen) {
  return {
    backendId: specimen.id,
    backendMeta: specimen,
    hash: specimen.sha256,
    backendVerified: true,
    name: specimen.filename,
    duration: formatDuration(specimen.duration_s),
    durationSeconds: specimen.duration_s,
    format: formatCodec(specimen.codec),
    sampleRate: formatSampleRate(specimen.sample_rate),
    sampleRateHz: specimen.sample_rate,
    channels: formatChannels(specimen.channels),
    channelCount: specimen.channels,
    sizeMB: specimen.bytes / (1024 * 1024),
    bytes: specimen.bytes,
  };
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.DASHBOARD);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [caseInfo, setCaseInfo] = useState({ ...EMPTY_CASE });
  const [evidence, setEvidence] = useState(null);
  const [reference, setReference] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [backendCheckedAt, setBackendCheckedAt] = useState('');
  const [pipeline, setPipeline] = useState(initialPipeline);
  const [runId, setRunId] = useState('');
  const [reviewData, setReviewData] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [comparisonStatus, setComparisonStatus] = useState('idle');
  const [comparisonError, setComparisonError] = useState('');
  const [language, setLanguage] = useState('en');
  const [sessionStartedAt] = useState(() => new Date());
  const [liveTranslations, setLiveTranslations] = useState(TRANSLATIONS);

  const notify = useToast();
  const contentRef = useRef(null);
  const pollRef = useRef(null);
  const backendWasOnline = useRef(false);

  const comparisonResult = useMemo(() => normalizeComparison(reviewData), [reviewData]);
  const transcript = useMemo(() => normalizeTranscript(reviewData), [reviewData]);
  const approved = isApproved || reviewData?.status === 'approved';

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshReview = useCallback(async (activeRunId) => {
    const review = await getReview(activeRunId);
    setReviewData(review);
    setIsApproved(review.status === 'approved');
    return review;
  }, []);

  const startPipelinePolling = useCallback(
    (activeRunId) => {
      stopPolling();
      setPipeline({ ...initialPipeline, status: 'queued', currentStage: 'queued' });

      const tick = async () => {
        try {
          const status = await getPipelineStatus(activeRunId);
          setPipeline({
            status: status.status || 'running',
            currentStage: status.stage || '',
            progress: Number(status.progress) || 0,
            stages: Array.isArray(status.stages) ? status.stages : [],
            error: status.error || '',
          });

          if (status.status === 'needs_review' || status.status === 'approved') {
            stopPolling();
            try {
              await refreshReview(activeRunId);
              notify(
                status.status === 'approved'
                  ? 'Pipeline run is already examiner-approved.'
                  : 'Analysis complete — review the returned outputs before approval.',
                'success'
              );
            } catch (reviewError) {
              notify(`Analysis finished but review data could not be loaded: ${reviewError.message}`, 'error');
            }
          } else if (status.status === 'failed') {
            stopPolling();
            notify(`Analysis failed: ${status.error || 'Unknown pipeline error'}`, 'error');
          }
        } catch (pollError) {
          stopPolling();
          setPipeline((previous) => ({
            ...previous,
            status: 'failed',
            error: pollError.message || 'Pipeline status could not be retrieved.',
          }));
          notify(`Pipeline status unavailable: ${pollError.message}`, 'error');
        }
      };

      tick();
      pollRef.current = window.setInterval(tick, 1800);
    },
    [notify, refreshReview, stopPolling]
  );

  useEffect(() => {
    let mounted = true;
    let probeBusy = false;
    const probe = async () => {
      if (probeBusy) return;
      probeBusy = true;
      const ok = await checkBackendHealth();
      probeBusy = false;
      if (!mounted) return;
      setBackendStatus(ok ? 'online' : 'offline');
      setBackendCheckedAt(
        new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())
      );
      if (!backendWasOnline.current && ok) {
        backendWasOnline.current = true;
        notify('Analysis service connected.', 'success');
      } else if (backendWasOnline.current && !ok) {
        backendWasOnline.current = false;
        notify('Analysis service connection lost.', 'warning');
      }
    };
    probe();
    const interval = window.setInterval(probe, 7000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [notify]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [screen]);

  useEffect(
    () => () => {
      stopPolling();
    },
    [stopPolling]
  );

  const navigate = useCallback((next) => setScreen(next), []);

  // Poll real pipeline progress from backend
  const startPipelinePolling = useCallback(
    (activeRunId) => {
      notify(`Pipeline launched for Run ID ${activeRunId}`, 'info');
      setStages({
        noise: { status: 'running', progress: 10 },
        enhance: { status: 'idle', progress: 0 },
        separate: { status: 'idle', progress: 0 },
      });

      const pollTimer = window.setInterval(async () => {
        try {
          const status = await getPipelineStatus(activeRunId);
          const prog = status.progress || 0;

          if (prog < 25) {
            setStages({
              noise: { status: 'running', progress: Math.min(90, prog * 4) },
              enhance: { status: 'idle', progress: 0 },
              separate: { status: 'idle', progress: 0 },
            });
          } else if (prog < 55) {
            setStages({
              noise: { status: 'complete', progress: 100 },
              enhance: { status: 'complete', progress: 100 },
              separate: { status: 'running', progress: Math.min(90, (prog - 25) * 3) },
            });
          } else {
            setStages({
              noise: { status: 'complete', progress: 100 },
              enhance: { status: 'complete', progress: 100 },
              separate: { status: 'complete', progress: 100 },
            });
          }

          if (status.status === 'needs_review' || status.status === 'approved' || prog >= 100) {
            window.clearInterval(pollTimer);
            delete timersRef.current.pipeline;
            notify('Pipeline stages complete — loading acoustic & integrity analysis', 'success');

            // Load full review metrics from backend
            try {
              const rev = await getReview(activeRunId);
              setReviewData(rev);
              if (rev.status === 'approved') setIsApproved(true);

              // Update comparison metrics if reference specimen was compared
              const cmpList = rev.stages?.compare?.metrics?.comparisons;
              if (cmpList && cmpList.length > 0) {
                const c0 = cmpList[0];
                setComparison({
                  status: 'done',
                  result: {
                    generatedAt: new Date().toLocaleTimeString(),
                    engineLabel: `${c0.model} (${c0.version})`,
                    featuresQuestioned: `Embedding cosine: ${c0.auto_cosine.toFixed(4)} · F0: ${c0.f0?.f0_mean?.toFixed(1) || '—'} Hz`,
                    featuresReference: `Known specimen · Ref F0: ${c0.f0?.ref_mean?.toFixed(1) || '—'} Hz`,
                    metrics: [
                      { name: 'ECAPA-TDNN Embedding Cosine', value: c0.auto_cosine },
                      { name: 'Pitch (F0) Contour Match', value: Math.max(0.1, 1 - Math.abs((c0.f0?.f0_mean || 0) - (c0.f0?.ref_mean || 0)) / 100) },
                      { name: 'MFCC Acoustic Correlation', value: 1 / (1 + (c0.mfcc_dist || 2) / 10) },
                      { name: 'Fused Multi-Metric Match', value: c0.fused_score },
                    ],
                    composite: c0.fused_score,
                    verdictBand: c0.verbal,
                    observations: [
                      `Automated embedding cosine similarity: ${c0.auto_cosine.toFixed(4)}.`,
                      `Questioned speech F0 pitch: ${c0.f0?.f0_mean?.toFixed(1) || '—'} Hz vs Specimen: ${c0.f0?.ref_mean?.toFixed(1) || '—'} Hz.`,
                      `Acoustic-phonetic MFCC distance: ${c0.mfcc_dist?.toFixed(3) || '—'}.`,
                      `Combined fused score: ${c0.fused_score.toFixed(4)}.`,
                      `Hypothesis assessment: ${c0.verbal}.`,
                      'Per Section 65B/63 BSA guidelines: Decision support only. Certified examiner review is mandatory.',
                    ],
                  },
                });
              }

              // Update live transcript segments from Whisper
              if (rev.transcript && rev.transcript.length > 0) {
                setLiveTranscript((prev) => ({
                  ...prev,
                  sourceFormat: 'Whisper Automatic Speech Recognition (Aligned)',
                  confidence: 0.88,
                  segments: rev.transcript.map((s, idx) => ({
                    time: `${String(Math.floor(s.start / 60)).padStart(2, '0')}:${String(Math.floor(s.start % 60)).padStart(2, '0')}`,
                    speaker: s.speaker || 'SPEAKER_00',
                    tokens: [{ t: s.text }],
                    raw: s,
                  })),
                }));
              }

              // Update live translation segments
              if (rev.translated && rev.translated.length > 0) {
                setLiveTranslations((prev) => ({
                  ...prev,
                  english: {
                    ...prev.english,
                    segments: rev.translated.map((s) => ({
                      time: `${String(Math.floor(s.start / 60)).padStart(2, '0')}:${String(Math.floor(s.start % 60)).padStart(2, '0')}`,
                      speaker: s.speaker || 'SPEAKER_00',
                      tokens: [{ t: s.text }],
                      raw: s,
                    })),
                  },
                }));
              }
            } catch (revErr) {
              console.error('Error fetching review data', revErr);
            }
          } else if (status.status === 'failed') {
            window.clearInterval(pollTimer);
            delete timersRef.current.pipeline;
            notify(`Pipeline execution failed: ${status.error || 'Unknown error'}`, 'warn');
          }
        } catch (err) {
          console.error('Polling error', err);
        }
      }, 1500);

      timersRef.current.pipeline = pollTimer;
    },
    [notify]
  );

  // Fallback demo stage sequence (used when running standalone without backend)
  const runStageSequence = useCallback(
    (keys) => {
      const queue = [...keys];
      const runNext = () => {
        const key = queue.shift();
        if (!key) return;
        const meta = STAGE_META[key];
        setStages((prev) => ({ ...prev, [key]: { status: 'running', progress: 0 } }));
        const started = Date.now();
        const timer = window.setInterval(() => {
          const p = Math.min(100, Math.round(((Date.now() - started) / meta.durationMs) * 100));
          setStages((prev) => ({
            ...prev,
            [key]: { status: p >= 100 ? 'complete' : 'running', progress: p },
          }));
          if (p >= 100) {
            window.clearInterval(timer);
            delete timersRef.current[key];
            notify(`${meta.label} — stage completed`, 'success');
            runNext();
          }
        }, 60);
        timersRef.current[key] = timer;
      };
      runNext();
    },
    [notify]
  );

  const handleRunComparison = useCallback(async () => {
    if (backendStatus !== 'online') {
      const message = 'The comparison pipeline requires the analysis service.';
      setComparisonStatus('error');
      setComparisonError(message);
      notify(message, 'error');
      return;
    }
    if (!runId) {
      const message = 'Run the evidence analysis pipeline before comparing a reference specimen.';
      setComparisonStatus('error');
      setComparisonError(message);
      notify(message, 'error');
      return;
    }
    if (!reference?.file && !reference?.backendId) {
      const message = 'Select a reference voice specimen before running the comparison.';
      setComparisonStatus('error');
      setComparisonError(message);
      notify(message, 'error');
      return;
    }
    notify('Speaker diarization started — clustering 2 voices', 'info');
    runStageSequence(['separate']);
  }, [stages, notify, runStageSequence]);

  const handleRunComparison = useCallback(() => {
    if (comparison.status === 'running') return;
    setComparison({ status: 'running', result: null });
    notify('Running speaker comparison pipeline…', 'info');
    const timer = window.setTimeout(() => {
      setComparison({ status: 'done', result: COMPARISON_RESULT });
      notify('Comparison complete — feature scores generated', 'success');
    }, 2200);
    timersRef.current.comparison = timer;
  }, [comparison.status, notify]);

  const handleApplyTranslation = useCallback(() => {
    setTranslationStatus('translating');
    const timer = window.setTimeout(() => {
      setAppliedLanguage(language);
      setTranslationStatus('ready');
      notify(`Translation applied — ${TRANSLATIONS[language]?.label || language}`, 'success');
    }, 600);
    timersRef.current.translation = timer;
  }, [language, notify]);

  const handleBeginAnalysis = useCallback(async () => {
    const stagedEvidence = evidence || EXAMPLE_EVIDENCE;
    if (!evidence) {
      setEvidence(EXAMPLE_EVIDENCE);
      notify('No file uploaded — example exhibit EV-001 loaded for demonstration', 'info');
    } else {
      notify(`Exhibit ${evidence.ref || 'staged'} locked — opening preprocessing lab`, 'success');
    }

    // If connected to FastAPI backend and a real file is staged, upload and start real pipeline
    if (backendConnected && stagedEvidence?.file) {
      try {
        notify('Uploading exhibit & registering custody record with backend…', 'info');
        const uploadRes = await uploadEvidence({
          evidenceFile: stagedEvidence.file,
          specimenFiles: reference?.file ? [reference.file] : [],
          source: caseInfo.source || stagedEvidence.source || '',
          collector: caseInfo.collector || '',
          questionnaire: JSON.stringify({ caseId: caseInfo.id, title: caseInfo.title }),
        });

        const activeRun = uploadRes.run_id;
        setRunId(activeRun);
        const m = Math.floor((uploadRes.duration_s || 0) / 60);
        const s = Math.round((uploadRes.duration_s || 0) % 60);
        const realDur = uploadRes.duration_s ? `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : undefined;
        setEvidence((prev) => ({
          ...(prev || stagedEvidence),
          hash: uploadRes.sha256 || prev?.hash,
          duration: realDur || prev?.duration,
          sampleRate: uploadRes.sample_rate ? `${Math.round(uploadRes.sample_rate / 1000)} kHz (${uploadRes.sample_rate} Hz)` : prev?.sampleRate,
          channels: uploadRes.channels ? (uploadRes.channels === 1 ? '1 (Mono)' : '2 (Stereo)') : prev?.channels,
          format: uploadRes.codec || prev?.format,
        }));
        startPipelinePolling(activeRun);
      } catch (err) {
        console.error('Backend upload failed, continuing in demo mode', err);
        notify(`Backend upload error: ${err.message}. Continuing in standalone demo mode.`, 'warn');
      }
    }

    navigate(SCREENS.PREPROCESSING);
  }, [evidence, backendConnected, reference, caseInfo, navigate, notify, startPipelinePolling]);

  const handleApproveRun = useCallback(
    async ({ examiner, conclusion }) => {
      if (!runId || backendStatus !== 'online') {
        throw new Error('Examiner certification requires an active backend pipeline run.');
      }
      await submitReview(runId, { examiner, approved: true, conclusion });
      const review = await refreshReview(runId);
      setReviewData(review);
      setIsApproved(review.status === 'approved');
      return review;
    },
    [backendStatus, refreshReview, runId]
  );

  const handleSaveTranscript = useCallback(
    async (segments) => {
      if (!runId || backendStatus !== 'online') {
        throw new Error('Transcript persistence requires the analysis service.');
      }
      const response = await saveTranscript(runId, segments);
      setReviewData((previous) => {
        if (!previous) return previous;
        const stages = { ...(previous.stages || {}) };
        delete stages.translate;
        return {
          ...previous,
          transcript: response.segments,
          translated: [],
          stages,
          status: response.status,
          approved_by: response.status === 'approved' ? previous.approved_by : '',
        };
      });
      setIsApproved(response.status === 'approved');
      return response;
    },
    [backendStatus, runId]
  );

  const handleTranslate = useCallback(
    async (target) => {
      if (!runId || backendStatus !== 'online') {
        throw new Error('Translation requires the analysis service.');
      }
      const response = await translateReview(runId, target);
      setReviewData((previous) => {
        if (!previous) return previous;
        const stages = {
          ...(previous.stages || {}),
          translate: {
            ...(previous.stages?.translate || {}),
            metrics: {
              engine: response.engine,
              model: response.model,
              version: response.version,
              target: response.target,
              segment_count: response.segments?.length || 0,
            },
            model: response.model,
            version: response.version,
          },
        };
        return {
          ...previous,
          translated: response.segments,
          stages,
          status: response.status,
          approved_by: response.status === 'approved' ? previous.approved_by : '',
        };
      });
      setIsApproved(response.status === 'approved');
      return response;
    },
    [backendStatus, runId]
  );

  const allStagesComplete =
    pipeline.status === 'needs_review' || pipeline.status === 'approved' || pipeline.progress >= 100;

  const handleContinueToComparison = useCallback(() => {
    if (!allStagesComplete) {
      notify('Analysis is not complete. Later screens may not have processed results yet.', 'warning');
    }
    navigate(SCREENS.COMPARISON);
  }, [allStagesComplete, navigate, notify]);

  const handleReturnToDashboard = useCallback(() => {
    navigate(SCREENS.DASHBOARD);
  }, [navigate]);

  let activeScreen = null;
  if (screen === SCREENS.DASHBOARD) {
    activeScreen = (
      <DashboardScreen
        caseInfo={caseInfo}
        setCaseInfo={setCaseInfo}
        evidence={evidence}
        setEvidence={handleEvidenceChange}
        reference={reference}
        setReference={handleReferenceChange}
        onBegin={handleBeginAnalysis}
        backendStatus={backendStatus}
        sessionStartedAt={sessionStartedAt}
        runId={runId}
      />
    );
  } else if (screen === SCREENS.PREPROCESSING) {
    activeScreen = (
      <PreprocessingScreen
        evidence={evidence}
        pipeline={pipeline}
        onContinue={handleContinueToComparison}
        onBack={handleReturnToDashboard}
        runId={runId}
        reviewData={reviewData}
        backendStatus={backendStatus}
      />
    );
  } else if (screen === SCREENS.COMPARISON) {
    activeScreen = (
      <ComparisonScreen
        evidence={evidence}
        reference={reference}
        setReference={handleReferenceChange}
        comparisonStatus={comparisonStatus}
        comparisonError={comparisonError}
        result={comparisonResult}
        onRunComparison={handleRunComparison}
        onContinue={() => {
          if (!comparisonResult && !comparisonError) {
            notify('No comparison result is available yet. The report will state that comparison was not performed.', 'warning');
          }
          navigate(SCREENS.TRANSCRIPTION);
        }}
        backendStatus={backendStatus}
        runId={runId}
        reviewData={reviewData}
      />
    );
  } else if (screen === SCREENS.TRANSCRIPTION) {
    activeScreen = (
      <TranscriptionScreen
        transcript={liveTranscript}
        translations={liveTranslations}
        language={language}
        setLanguage={setLanguage}
        onTranslate={handleTranslate}
        onSaveTranscript={handleSaveTranscript}
        evidence={evidence}
        onContinue={() => navigate(SCREENS.REPORT)}
      />
    );
  } else {
    activeScreen = (
      <ReportScreen
        caseInfo={caseInfo}
        evidence={evidence}
        reference={reference}
        stages={stages}
        comparison={comparison}
        transcript={liveTranscript}
        translations={liveTranslations}
        appliedLanguage={appliedLanguage}
        onReturn={handleReturnToDashboard}
        runId={runId}
        backendStatus={backendStatus}
        onApproveRun={handleApproveRun}
        isApproved={approved}
        language={language}
        sessionStartedAt={sessionStartedAt}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        screen={screen}
        onNavigate={navigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        backendStatus={backendStatus}
        runId={runId}
      />
      <div className="main-col">
        <Header
          screen={screen}
          caseInfo={caseInfo}
          onMenu={() => setSidebarOpen(true)}
          backendStatus={backendStatus}
          backendCheckedAt={backendCheckedAt}
          runId={runId}
          evidence={evidence}
        />
        <main className="content" ref={contentRef}>
          <FlowStepper screen={screen} onNavigate={navigate} />
          <div className="screen" key={screen}>
            {activeScreen}
          </div>
          <footer className="app-footer no-print">
            Decision-support workstation · Section 65B Indian Evidence Act / Section 63 BSA 2023 workflow · Automated outputs require examiner review
          </footer>
        </main>
      </div>
    </div>
  );
}
