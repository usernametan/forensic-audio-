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

  const resetAnalysis = useCallback(() => {
    stopPolling();
    setPipeline(initialPipeline);
    setRunId('');
    setReviewData(null);
    setIsApproved(false);
    setComparisonStatus('idle');
    setComparisonError('');
    setLanguage('en');
  }, [stopPolling]);

  const handleEvidenceChange = useCallback(
    (nextEvidence) => {
      resetAnalysis();
      setEvidence(nextEvidence);
    },
    [resetAnalysis]
  );

  const handleReferenceChange = useCallback((nextReference) => {
    setReference((previous) => {
      const resolved = typeof nextReference === 'function' ? nextReference(previous) : nextReference;
      if (!resolved) return resolved;
      if (runId) return { ...resolved, needsComparison: true };
      return resolved;
    });
  }, [runId]);

  const handleBeginAnalysis = useCallback(async () => {
    if (runId && evidence) {
      navigate(SCREENS.PREPROCESSING);
      notify('Returning to the existing analysis run.', 'info');
      return true;
    }
    if (!evidence?.file) {
      notify('Select an evidence audio file before starting analysis.', 'error');
      return false;
    }
    if (backendStatus !== 'online') {
      notify('The analysis service is offline. Start the FastAPI backend before beginning analysis.', 'error');
      return false;
    }

    resetAnalysis();
    try {
      const upload = await uploadEvidence({
        evidenceFile: evidence.file,
        specimenFiles: reference?.file ? [reference.file] : [],
        source: caseInfo.source || '',
        collector: caseInfo.collector || '',
        questionnaire: JSON.stringify({
          caseId: caseInfo.id || '',
          title: caseInfo.title || '',
          submittedAt: new Date().toISOString(),
        }),
      });

      setRunId(upload.run_id);
      setEvidence((previous) => ({
        ...previous,
        ...metadataFromUpload(upload),
        ref: `EV-${String(upload.evidence_id).slice(0, 6).toUpperCase()}`,
        uploadStatus: 'uploaded',
      }));

      if (upload.specimen_ids?.length) {
        const specimenId = upload.specimen_ids[0];
        setReference((previous) => ({
          ...(previous || {}),
          ref: `REF-${String(specimenId).slice(0, 6).toUpperCase()}`,
          backendId: specimenId,
          uploadStatus: 'uploaded',
        }));
        getEvidence(specimenId)
          .then((specimen) => {
            setReference((previous) => ({
              ...(previous || {}),
              ...specimenMetadata(specimen),
              ref: previous?.ref || `REF-${String(specimenId).slice(0, 6).toUpperCase()}`,
              origin: previous?.origin || 'Reference specimen supplied with the exhibit',
            }));
          })
          .catch((error) => {
            notify(`Reference specimen metadata could not be loaded: ${error.message}`, 'warning');
          });
      }

      startPipelinePolling(upload.run_id);
      notify('Exhibit uploaded, hashed server-side and queued for analysis.', 'success');
      navigate(SCREENS.PREPROCESSING);
      return true;
    } catch (error) {
      setEvidence((previous) => (previous ? { ...previous, uploadStatus: 'error' } : previous));
      notify(`Upload failed: ${error.message}`, 'error');
      return false;
    }
  }, [backendStatus, caseInfo, evidence, navigate, notify, reference, resetAnalysis, runId, startPipelinePolling]);

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
    if (comparisonStatus === 'running') return;

    setComparisonStatus('running');
    setComparisonError('');
    try {
      const response = await compareSpecimen(runId, {
        file: reference.file,
        specimenId: reference.backendId,
      });
      setReference((previous) => ({
        ...(previous || {}),
        ...specimenMetadata(response.specimen),
        ref: `REF-${String(response.specimen.id).slice(0, 6).toUpperCase()}`,
        origin: previous?.origin || 'Reference specimen supplied with the exhibit',
        needsComparison: false,
      }));
      const review = await refreshReview(runId);
      setReviewData(review);
      setIsApproved(review.status === 'approved');
      setComparisonStatus('done');
      notify('Comparison completed. Measured outputs are ready for examiner interpretation.', 'success');
    } catch (error) {
      setComparisonStatus('error');
      setComparisonError(error.message);
      notify(`Comparison failed: ${error.message}`, 'error');
    }
  }, [backendStatus, comparisonStatus, notify, reference, refreshReview, runId]);

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
        transcript={transcript}
        runId={runId}
        backendStatus={backendStatus}
        reviewData={reviewData}
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
        pipeline={pipeline}
        comparisonStatus={comparisonStatus}
        comparison={comparisonResult}
        transcript={transcript}
        reviewData={reviewData}
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
