import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import MobileContainer from '@/components/MobileContainer';
import { ScoreCard } from '@/components/scoring/ScoreCard';
import type { GolfRound } from '@/lib/golf/types';

export const ScoreEntryPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Expect a round to be provided via navigation state { round }
  const state = location.state as { round?: GolfRound } | null;
  const round = state?.round;

  React.useEffect(() => {
    if (!round) {
      navigate('/round/new');
    }
  }, [round, navigate]);

  if (!round) return null;

  const handleUpdateRound = (updated: GolfRound) => {
    // For now, simply replace history state so user can continue editing
    navigate(location.pathname, { replace: true, state: { round: updated } });
  };

  const handleSaveRound = () => {
    // Default behavior: navigate back to the round setup page
    navigate('/round/new');
  };

  const handleShareRound = () => {
    // noop placeholder — can be implemented to publish to Nostr
    console.log('Share round requested');
  };

  return (
    <Layout>
      <MobileContainer className="p-4">
        <ScoreCard
          round={round}
          course={null}
          onUpdateRound={handleUpdateRound}
          onSaveRound={handleSaveRound}
          onShareRound={handleShareRound}
        />
      </MobileContainer>
    </Layout>
  );
};

export default ScoreEntryPage;
