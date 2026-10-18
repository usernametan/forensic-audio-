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

  const notify = useToast();
  const timersRef = useRef({});
  const contentRef = useRef(null);

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((t) => {
        window.clearInterval(t);
        window.clearTimeout(t);
      });
    };
  }, []);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [screen]);

  const navigate = useCallback((next) => setScreen(next), []);

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
    notify('Running illustrative comparison pipeline…', 'info');
    const timer = window.setTimeout(() => {
      setComparison({ status: 'done', result: COMPARISON_RESULT });
      notify('Comparison complete — demo result generated', 'success');
    }, 2400);
    timersRef.current.comparison = timer;
  }, [comparison.status, notify]);

  const handleApplyTranslation = useCallback(() => {
    setTranslationStatus('translating');
    const timer = window.setTimeout(() => {
      setAppliedLanguage(language);
      setTranslationStatus('ready');
      notify(`Translation applied — ${TRANSLATIONS[language].label}`, 'success');
    }, 750);
    timersRef.current.translation = timer;
  }, [language, notify]);

  const handleBeginAnalysis = useCallback(() => {
    if (!evidence) {
      setEvidence(EXAMPLE_EVIDENCE);
      notify('No file uploaded — example exhibit EV-001 loaded for demonstration', 'info');
    } else {
      notify(`Exhibit ${evidence.ref || 'staged'} locked — opening preprocessing lab`, 'success');
    }
    navigate(SCREENS.PREPROCESSING);
  }, [evidence, navigate, notify]);

  const allStagesComplete =
    stages.noise.status === 'complete' &&
    stages.enhance.status === 'complete' &&
    stages.separate.status === 'complete';

  const handleContinueToComparison = useCallback(() => {
    if (!allStagesComplete) {
      notify('Preprocessing incomplete — continuing with partial data (demo mode)', 'warn');
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
      />
    );
  } else if (screen === SCREENS.COMPARISON) {
    activeScreen = (
      <ComparisonScreen
        questioned={{
          ...EXAMPLE_EVIDENCE,
          ref: 'EV-001-A',
          name: 'questioned_extract_spk01.wav',
          duration: '02:31',
          quality: 'Fair',
          snr: '12.4 dB',
          bandwidth: '8 kHz narrowband',
          qualityNote: 'Background hiss, clipped peaks, narrowband channel',
          seed: 7,
        }}
        reference={reference}
        setReference={setReference}
        comparison={comparison}
        onRunComparison={handleRunComparison}
        onContinue={() => {
          if (comparison.status !== 'done') {
            notify('Run the comparison first — showing preview flow anyway', 'warn');
          }
          navigate(SCREENS.TRANSCRIPTION);
        }}
      />
    );
  } else if (screen === SCREENS.TRANSCRIPTION) {
    activeScreen = (
      <TranscriptionScreen
        transcript={TRANSCRIPT}
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
        transcript={TRANSCRIPT}
        translations={TRANSLATIONS}
        appliedLanguage={appliedLanguage}
        onReturn={handleReturnToDashboard}
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
        <Header screen={screen} caseInfo={caseInfo} onMenu={() => setSidebarOpen(true)} />
        <main className="content" ref={contentRef}>
          <FlowStepper screen={screen} onNavigate={navigate} />
          <div className="screen" key={screen}>
            {activeScreen}
          </div>
          <footer className="app-footer no-print">
            AUDIO FORENSICS prototype · Academic demonstration only · All analysis outputs are simulated mock data
          </footer>
        </main>
      </div>
    </div>
  );
}
