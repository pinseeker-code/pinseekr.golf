import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { ScrollToTop } from "./components/ScrollToTop";

const Index = lazy(() => import("./pages/Index"));
const NIP19Page = lazy(() => import("./pages/NIP19Page"));
const JoinRoundPage = lazy(() => import('./pages/JoinRoundPage'));
const NotFound = lazy(() => import("./pages/NotFound"));
const NewRoundPage = lazy(() => import("./pages/NewRoundPage"));
const DemoRoundPage = lazy(() => import("./pages/DemoRoundPage"));
const ScoreEntryPage = lazy(() => import("./pages/ScoreEntryPage"));
const AchievementsPage = lazy(() => import("./pages/AchievementsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AccountInfoPage = lazy(() => import("./pages/AccountInfoPage"));

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/demo" element={<DemoRoundPage />} />
          <Route path="/round/new" element={<NewRoundPage />} />
          <Route path="/score-entry" element={<ScoreEntryPage />} />
          <Route path="/join/:roundId" element={<JoinRoundPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
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