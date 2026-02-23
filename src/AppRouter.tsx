import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ScrollToTop } from "./components/ScrollToTop";

const Index = lazy(() => import("./pages/Index"));
const NIP19Page = lazy(() => import("./pages/NIP19Page"));
const JoinRoundPage = lazy(() => import('./pages/JoinRoundPage'));
const NotFound = lazy(() => import("./pages/NotFound"));
const DemoRoundPage = lazy(() => import("./pages/DemoRoundPage"));
const SimulatorPage = lazy(() => import("./pages/SimulatorPage"));
const RoundSummaryPage = lazy(() => import("./pages/RoundSummaryPage"));
const RoundHistoryPage = lazy(() => import("./pages/RoundHistoryPage"));
const RoundDetailsPage = lazy(() => import("./pages/RoundDetailsPage"));
const AchievementsPage = lazy(() => import("./pages/AchievementsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AccountInfoPage = lazy(() => import("./pages/AccountInfoPage"));
const SettlementsPage = lazy(() => import("./pages/SettlementsPage"));

// New route-based components (Phase 2.3)
const RoundSetupPageV2 = lazy(() => import("./pages/RoundSetupPage_v2"));
const RoundScorePageV2 = lazy(() => import("./pages/RoundScorePage_v2"));

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/demo" element={<DemoRoundPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/round-summary" element={<RoundSummaryPage />} />
          <Route path="/round/:id/summary" element={<RoundSummaryPage />} />
          <Route path="/round/:id" element={<RoundDetailsPage />} />
          <Route path="/rounds" element={<RoundHistoryPage />} />
          <Route path="/round/new" element={<RoundSetupPageV2 />} />
          <Route path="/round/:id/score" element={<RoundScorePageV2 />} />
          <Route path="/join/:roundId" element={<JoinRoundPage />} />
          
          {/* Phase 2.3 refactor aliases */}
          <Route path="/round-v2/new" element={<RoundSetupPageV2 />} />
          <Route path="/round-v2/:id/score" element={<RoundScorePageV2 />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/settlements" element={<SettlementsPage />} />
          <Route path="/account" element={<AccountInfoPage />} />
          <Route path="/profile/:nip19Id" element={<ProfilePage />} />
          {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
          <Route path="/:nip19" element={<NIP19Page />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
export default AppRouter;