import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { OnboardingPage } from './pages/OnboardingPage';
import { HomePage } from './pages/HomePage';
import { ChatPage } from './pages/ChatPage';
import { ReflectPage } from './pages/ReflectPage';
import { GoalsPage } from './pages/GoalsPage';
import { ProfilePage } from './pages/ProfilePage';
import { PhoneShell } from './components/layout/PhoneShell';
import { MonthlyRitualCloseOut } from './components/ritual/MonthlyRitualCloseOut';
import { MonthlyRitualRollover } from './components/ritual/MonthlyRitualRollover';
import { MonthlyRitualComplete } from './components/ritual/MonthlyRitualComplete';
import { MonthlyRitualIncome } from './components/ritual/MonthlyRitualIncome';
import { MonthlyRitualCommitments } from './components/ritual/MonthlyRitualCommitments';
import { MonthlyRitualFocus } from './components/ritual/MonthlyRitualFocus';
import { MonthlyRitualLockIn } from './components/ritual/MonthlyRitualLockIn';
import { WindfallAllocate } from './components/windfall/WindfallAllocate';
import { WindfallReview } from './components/windfall/WindfallReview';

function App() {
  return (
    <Router>
      <PhoneShell>
        <Routes>
          {/* Phase C4 — single-route onboarding (replaces old WelcomePage).
              The 11-screen flow lives inside one component with internal
              step state, mirroring docs/savio_onboarding.jsx structure.
              "Demo: log in as Priya" skip path preserved within. */}
          <Route path="/" element={<OnboardingPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/reflect" element={<ReflectPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* Monthly ritual — 7 screens. `:month` param is M-1 (the month
              being closed out) throughout the entire flow. The new-month
              screens (income/commitments/focus/lockin) derive M from M-1. */}
          <Route path="/ritual/:month" element={<MonthlyRitualCloseOut />} />
          <Route path="/ritual/:month/rollover" element={<MonthlyRitualRollover />} />
          <Route path="/ritual/:month/complete" element={<MonthlyRitualComplete />} />
          <Route path="/ritual/:month/income" element={<MonthlyRitualIncome />} />
          <Route path="/ritual/:month/commitments" element={<MonthlyRitualCommitments />} />
          <Route path="/ritual/:month/focus" element={<MonthlyRitualFocus />} />
          <Route path="/ritual/:month/lockin" element={<MonthlyRitualLockIn />} />
          {/* Phase C2 — Windfall allocation flow (2 screens). Reaches /home on lock-in. */}
          <Route path="/windfall/:eventId/allocate" element={<WindfallAllocate />} />
          <Route path="/windfall/:eventId/review" element={<WindfallReview />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PhoneShell>
    </Router>
  );
}

export default App;
