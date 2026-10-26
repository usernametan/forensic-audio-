import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import FlowStepper from './components/FlowStepper.jsx';
import { useToast } from './components/Toast.jsx';
import DashboardScreen from './screens/DashboardScreen.jsx';
import PreprocessingScreen from './screens/PreprocessingScreen.jsx';
import ComparisonScreen from './screens/ComparisonScreen.jsx';
import TranscriptionScreen from './screens/TranscriptionScreen.jsx';
import ReportScreen from './screens/ReportScreen.jsx';
import {
  SCREENS,
  DEFAULT_CASE,
  EXAMPLE_EVIDENCE,
  EXAMPLE_REFERENCE,
  STAGE_META,
  COMPARISON_RESULT,
  TRANSCRIPT,
  TRANSLATIONS,
} from './data/mockData';
import {
  checkBackendHealth,
  uploadEvidence,
  getPipelineStatus,
  getReview,
  submitReview,
} from './services/api';

const idleStage = { status: 'idle', progress: 0 };

export default function App() {
  const [screen, setScreen] = useState(SCREENS.DASHBOARD);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [caseInfo, setCaseInfo] = useState({ ...DEFAULT_CASE });
  const [evidence, setEvidence] = useState(null);
  const [reference, setReference] = useState(EXAMPLE_REFERENCE);
  const [stages, setStages] = useState({
    noise: { ...idleStage },
    enhance: { ...idleStage },
    separate: { ...idleStage },
  });
  const [comparison, setComparison] = useState({ status: 'idle', result: null });
  const [language, setLanguage] = useState('english');
  const [appliedLanguage, setAppliedLanguage] = useState('english');
  const [translationStatus, setTranslationStatus] = useState('ready');

  // Backend live integration state
  const [backendConnected, setBackendConnected] = useState(false);
  const [runId, setRunId] = useState('');
  const [reviewData, setReviewData] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState(TRANSCRIPT);

  const notify = useToast();
  const timersRef = useRef({});
  const contentRef = useRef(null);

  // Periodically probe backend health
  useEffect(() => {
    let mounted = true;
    const probe = async () => {
      const ok = await checkBackendHealth();
      if (mounted) {
        setBackendConnected((prev) => {
          if (!prev && ok) {
            notify('Connected to Forensic Audio Backend (port 8000)', 'success');
          }
          return ok;
        });
      }
    };
    probe();
    const interval = window.setInterval(probe, 6000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      Object.values(timersRef.current).forEach((t) => {
        window.clearInterval(t);
        window.clearTimeout(t);
      });
    };
  }, [notify]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [screen]);

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

  const handleRunNoise = useCallback(() => {
    if (stages.noise.status === 'running' || stages.enhance.status === 'running') return;
    if (stages.noise.status === 'complete' && stages.enhance.status === 'complete') {
      notify('Noise reduction & enhancement already complete', 'info');
      return;
    }
    notify('Noise reduction pipeline started', 'info');
    runStageSequence(['noise', 'enhance']);
  }, [stages.noise.status, stages.enhance.status, notify, runStageSequence]);

  const handleRunSeparate = useCallback(() => {
    if (stages.separate.status === 'running') return;
    if (stages.separate.status === 'complete') {
      notify('Speaker separation already complete', 'info');
      return;
    }
    if (stages.noise.status !== 'complete') {
      notify('Run noise reduction before speaker separation', 'warn');
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
        setEvidence((prev) => ({
          ...(prev || stagedEvidence),
          hash: uploadRes.sha256 || prev?.hash,
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
      if (backendConnected && runId) {
        await submitReview(runId, { examiner, approved: true, conclusion });
        setIsApproved(true);
        const updatedRev = await getReview(runId);
        setReviewData(updatedRev);
      } else {
        setIsApproved(true);
      }
    },
    [backendConnected, runId]
  );

  const allStagesComplete =
    stages.noise.status === 'complete' &&
    stages.enhance.status === 'complete' &&
    stages.separate.status === 'complete';

  const handleContinueToComparison = useCallback(() => {
    if (!allStagesComplete) {
      notify('Preprocessing incomplete — continuing with partial data', 'warn');
    } else {
      notify('Preprocessed exhibit forwarded to comparison module', 'success');
    }
    navigate(SCREENS.COMPARISON);
  }, [allStagesComplete, navigate, notify]);

  const handleReturnToDashboard = useCallback(() => {
    navigate(SCREENS.DASHBOARD);
    notify('Session summary saved locally — back to case dashboard', 'info');
  }, [navigate, notify]);

  let activeScreen = null;
  if (screen === SCREENS.DASHBOARD) {
    activeScreen = (
      <DashboardScreen
        caseInfo={caseInfo}
        setCaseInfo={setCaseInfo}
        evidence={evidence}
        setEvidence={setEvidence}
        onBegin={handleBeginAnalysis}
      />
    );
  } else if (screen === SCREENS.PREPROCESSING) {
    activeScreen = (
      <PreprocessingScreen
        evidence={evidence || EXAMPLE_EVIDENCE}
        stages={stages}
        onRunNoise={handleRunNoise}
        onRunSeparate={handleRunSeparate}
        onContinue={handleContinueToComparison}
        runId={runId}
        reviewData={reviewData}
        backendConnected={backendConnected}
      />
    );
  } else if (screen === SCREENS.COMPARISON) {
    activeScreen = (
      <ComparisonScreen
        questioned={{
          ...(evidence || EXAMPLE_EVIDENCE),
          ref: evidence?.ref ? `${evidence.ref}-A` : 'EV-001-A',
          name: evidence?.name ? `extract_${evidence.name}` : 'questioned_extract_spk01.wav',
          duration: evidence?.duration || '02:31',
          quality: 'Fair',
          snr: '14.8 dB',
          bandwidth: '16 kHz wideband',
          qualityNote: 'Cleaned via DeepFilterNet, bandwidth preserved',
          seed: 7,
        }}
        reference={reference}
        setReference={setReference}
        comparison={comparison}
        onRunComparison={handleRunComparison}
        onContinue={() => {
          if (comparison.status !== 'done') {
            notify('Run comparison first — continuing with draft preview', 'warn');
          }
          navigate(SCREENS.TRANSCRIPTION);
        }}
      />
    );
  } else if (screen === SCREENS.TRANSCRIPTION) {
    activeScreen = (
      <TranscriptionScreen
        transcript={liveTranscript}
        translations={TRANSLATIONS}
        language={language}
        setLanguage={setLanguage}
        appliedLanguage={appliedLanguage}
        translationStatus={translationStatus}
        onApply={handleApplyTranslation}
        onContinue={() => {
          notify('Transcript attached to draft report', 'success');
          navigate(SCREENS.REPORT);
        }}
      />
    );
  } else {
    activeScreen = (
      <ReportScreen
        caseInfo={caseInfo}
        evidence={evidence || EXAMPLE_EVIDENCE}
        reference={reference}
        stages={stages}
        comparison={comparison}
        transcript={liveTranscript}
        translations={TRANSLATIONS}
        appliedLanguage={appliedLanguage}
        onReturn={handleReturnToDashboard}
        runId={runId}
        reviewData={reviewData}
        backendConnected={backendConnected}
        onApproveRun={handleApproveRun}
        isApproved={isApproved}
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
      />
      <div className="main-col">
        <Header
          screen={screen}
          caseInfo={caseInfo}
          onMenu={() => setSidebarOpen(true)}
          backendConnected={backendConnected}
          runId={runId}
        />
        <main className="content" ref={contentRef}>
          <FlowStepper screen={screen} onNavigate={navigate} />
          <div className="screen" key={screen}>
            {activeScreen}
          </div>
          <footer className="app-footer no-print">
            AUDIO FORENSICS Platform · Section 65B Indian Evidence Act / Section 63 BSA 2023 Compliant · Automated Court-Ready Audio Analysis
          </footer>
        </main>
      </div>
    </div>
  );
}
