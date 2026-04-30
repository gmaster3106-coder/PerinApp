import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useApp } from './context/AppContext.jsx';
import { useTTS } from './hooks/useTTS.js';
import Header from './components/Header.jsx';
import Toast from './components/Toast.jsx';
import AuthModal from './components/AuthModal.jsx';
import Welcome from './screens/Welcome.jsx';
import Profile from './screens/Profile.jsx';
import Onboarding from './screens/Onboarding.jsx';
import Intro from './screens/Intro.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Scenarios from './screens/Scenarios.jsx';
import Journey from './screens/Journey.jsx';
import Chat from './screens/Chat.jsx';
import Settings from './screens/Settings.jsx';
import WordPrep from './screens/WordPrep.jsx';
import SrsReview from './screens/SrsReview.jsx';
import FillBlank from './screens/FillBlank.jsx';
import SentenceBuilder from './screens/SentenceBuilder.jsx';
import ListeningMode from './screens/ListeningMode.jsx';
import ReadingMode from './screens/ReadingMode.jsx';
import VocabQuiz from './screens/VocabQuiz.jsx';
import DialectDecoder from './screens/DialectDecoder.jsx';
import Pressure from './screens/Pressure.jsx';
import Memory from './screens/Memory.jsx';
import Scenes from './screens/Scenes.jsx';
import Friends from './screens/Friends.jsx';
import Connections from './screens/Connections.jsx';
import SessionSummary from './screens/SessionSummary.jsx';

const HIDE_HEADER_PATHS = new Set([
  '/chat',
  '/pressure',
  '/intro',
  '/welcome',
  '/onboarding',
  '/profile',
  '/summary',
]);

export default function App() {
  const { state } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const { unlockAudio } = useTTS();
  const audioUnlocked = useRef(false);

  const showHeader = !HIDE_HEADER_PATHS.has(location.pathname);

  useEffect(() => {
    const unlock = () => {
      if (audioUnlocked.current) return;
      audioUnlocked.current = true;
      unlockAudio();
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, [unlockAudio]);

  useEffect(() => {
    const path = location.pathname;
    const isRoot = path === '/' || path === '/PerinApp' || path === '/PerinApp/';
    if (!isRoot) return;
    if (!state.profile?.name) {
      navigate('/welcome', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, []);

  return (
    <div id="app-shell" className={showHeader ? '' : 'no-header'}>
      {showHeader && <Header />}
      <main id="main-content">
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/intro" element={<Intro />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scenarios" element={<Scenarios />} />
          <Route path="/journey" element={<Journey />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/summary" element={<SessionSummary />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/wordprep" element={<WordPrep />} />
          <Route path="/srs" element={<SrsReview />} />
          <Route path="/fib" element={<FillBlank />} />
          <Route path="/sentence-builder" element={<SentenceBuilder />} />
          <Route path="/structured" element={<SentenceBuilder />} />
          <Route path="/listening" element={<ListeningMode />} />
          <Route path="/reading" element={<ReadingMode />} />
          <Route path="/vocab-quiz" element={<VocabQuiz />} />
          <Route path="/dialect-decoder" element={<DialectDecoder />} />
          <Route path="/pressure" element={<Pressure />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/scenes" element={<Scenes />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>
      <Toast />
      <AuthModal />
    </div>
  );
}
