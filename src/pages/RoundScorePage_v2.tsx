/**
 * RoundScorePage - New route-based scoring component
 * Route: /round/:id/score (main), replaces scoring flow
 *
 * This is the second step in the multi-step round wizard.
 * Receives round data via route state, displays ScoreCard, and handles settlement.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScoreCard } from '@/components/scoring/ScoreCard';
import { AddPlayerDialog } from '@/components/AddPlayerDialog';
import { Layout } from '@/components/Layout';
import MobileContainer from '@/components/MobileContainer';
import { GameMode, GolfRound, PlayerInRound, HoleScore, APP_KIND } from '@/lib/golf/types';
import { SUBTYPES } from '@/lib/golfTags';
import { createGameEvent, createRoundEvent, createHoleScoreEvent, parseHoleScoreEvent } from '@/lib/golf/nostrEvents';
import { processRoundWagers, netting, type Payable } from '@/lib/golf/scoringEngine';
import { convertToRoundData } from '@/lib/golf/strokeEngine';
import { dotsEngine, convertToDotsData } from '@/lib/golf/dotsEngine';
import { snakeEngine, convertToSnakeData } from '@/lib/golf/snakeEngine';
import type { GolfCourse } from '@/hooks/useGolfCourses';

type AggregatedInvoice = { recipient: string; amount: number; payers: string[]; memo?: string };

type RoundScoreRouteState = {
  round?: Partial<GolfRound>;
  selectedCourse?: GolfCourse | null;
  selectedGameModes?: Record<string, boolean>;
  selectedGameModeList?: Array<{ key: string; name: string; description: string; rules: string }>;
  wagersEnabled?: boolean;
  wagerAmounts?: Record<string, '111' | '1111' | 'custom'>;
  customWagerAmounts?: Record<string, string>;
  pinseekrWagersEnabled?: boolean;
  pinseekrCupSettings?: {
    formatOrder: string[];
    formatPositions: Record<string, number>;
    cycleLength: number;
    presetMode: 'ryder-cup' | 'trad-golf' | 'duffers-delight' | 'custom';
    strokePlayUseNet: boolean;
  };
  tournament?: unknown;
  snakeVariant?: 'fixed' | 'progressive';
  progressiveMultiplier?: number;
  modifiedStableford?: boolean;
  useHandicaps?: boolean;
  netScoring?: boolean;
  vegasTeams?: { teamA: string[]; teamB: string[] };
  wolfPartners?: Record<string, string | null>;
  roundCode?: string;
  persistWagers?: boolean;
  persistTournamentWagers?: boolean;
};

export const RoundScorePage: React.FC = () => {
  const navigate = useNavigate();
  const { id: roundId } = useParams<{ id: string }>();
  const location = useLocation();
  const { nostr } = useNostr();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const { mutate: publishEvent } = useNostrPublish();

  const state = (location.state || {}) as RoundScoreRouteState;

  const [round, setRound] = useState<Partial<GolfRound>>(
    state.round || {
      id: roundId,
      date: Date.now(),
      players: [],
      gameMode: GameMode.STROKE_PLAY,
      holes: [],
      status: 'active',
    }
  );

  const [selectedCourse] = useState<GolfCourse | null>(state.selectedCourse || null);
  const [selectedGameModes] = useState<Record<string, boolean>>(state.selectedGameModes || {});
  const [selectedGameModeList] = useState<Array<{ key: string; name: string; description: string; rules: string }>>(
    state.selectedGameModeList || []
  );
  const [wagersEnabled] = useState<boolean>(state.wagersEnabled || false);
  const [wagerAmounts] = useState<Record<string, '111' | '1111' | 'custom'>>(state.wagerAmounts || {});
  const [customWagerAmounts] = useState<Record<string, string>>(state.customWagerAmounts || {});
  const [pinseekrWagersEnabled] = useState<boolean>(state.pinseekrWagersEnabled || false);
  const [pinseekrCupSettings] = useState<RoundScoreRouteState['pinseekrCupSettings']>(state.pinseekrCupSettings);
  const [modifiedStableford] = useState<boolean>(state.modifiedStableford || false);
  const [useHandicaps] = useState<boolean>(state.useHandicaps || false);
  const [netScoring] = useState<boolean>(state.netScoring || false);
  const [wolfPartners, setWolfPartners] = useState<Record<string, string | null>>(state.wolfPartners || {});
  const [roundCode] = useState<string>(state.roundCode || '');
  const [persistWagers] = useState<boolean>(state.persistWagers || false);

  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState(false);
  const [showSettlementPreview, setShowSettlementPreview] = useState(false);
  const [settlementPreview, setSettlementPreview] = useState<AggregatedInvoice[]>([]);
  const [isCreatingInvoices, setIsCreatingInvoices] = useState(false);
  const [wolfSettingsOpen, setWolfSettingsOpen] = useState(false);

  const guardState = useMemo(() => ({
    round,
    selectedCourseId: selectedCourse?.id || null,
  }), [round, selectedCourse?.id]);

  const guardKey = round.id || roundId || 'round-score';
  const guardKeyRef = useRef<string>('');
  const guardSnapshotRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const serializedGuardState = useMemo(() => JSON.stringify(guardState), [guardState]);
  const roundSavedRef = useRef(false);
  const pendingScoreEventsRef = useRef(0);

  useEffect(() => {
    if (guardKeyRef.current !== guardKey) {
      guardKeyRef.current = guardKey;
      guardSnapshotRef.current = serializedGuardState;
      setIsDirty(false);
      return;
    }

    setIsDirty(serializedGuardState !== guardSnapshotRef.current);
  }, [guardKey, serializedGuardState]);

  useNavigationGuard(isDirty, 'You have unsaved changes. Are you sure you want to leave?');

  useEffect(() => {
    if (!state.round && roundId) {
      toast({
        title: 'Round Not Found',
        description: 'Could not load round data. Please start from setup.',
        variant: 'destructive',
      });
      navigate('/round/new');
    }
  }, [roundId, state.round, navigate, toast]);

  // Subscribe to hole score events for real-time score sync
  useEffect(() => {
    if (!nostr || !roundId) return;

    let mounted = true;
    const controller = new AbortController();

    const subscribeToScores = async () => {
      try {
        const subscription = nostr.req(
          [{ 
            kinds: [APP_KIND], 
            '#round': [roundId], 
            '#t': ['golf', SUBTYPES.HOLE], 
            limit: 500 
          }],
          { signal: controller.signal }
        );

        for await (const msg of subscription) {
          if (!mounted) break;

          if (msg[0] === 'CLOSED') {
            console.log('[RoundScore] Score subscription closed');
            break;
          }

          if (msg[0] === 'EVENT') {
            const ev = msg[2] as NostrEvent;
            const holeScore = parseHoleScoreEvent(ev);
            if (!holeScore) continue;

            const playerId = (((ev.tags as string[][]).find((t: string[]) => t[0] === 'player') || [])[1]) || ev.pubkey;

            // Update player's score in real-time
            setRound(prev => {
              const players = prev!.players || [];
              const playerIndex = players.findIndex(p => p.playerId === playerId);
              
              if (playerIndex === -1) return prev;

              const updatedPlayers = [...players];
              const player = { ...updatedPlayers[playerIndex] };
              
              if (!player.scores) player.scores = [];
              player.scores[holeScore.holeNumber - 1] = holeScore.strokes;
              
              if (!player.holeDetails) player.holeDetails = {};
              player.holeDetails[holeScore.holeNumber - 1] = {
                putts: holeScore.putts,
                fairways: holeScore.fairways,
                greens: holeScore.greens,
                sandTraps: holeScore.sandTraps,
                penalties: holeScore.penalties,
                notes: holeScore.notes
              };

              updatedPlayers[playerIndex] = player as PlayerInRound;
              return { ...prev!, players: updatedPlayers };
            });
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('[RoundScore] Score subscription error:', error);
      }
    };

    subscribeToScores();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [nostr, roundId]);

  const handleAddPlayer = (newPlayer: PlayerInRound) => {
    setRound(prev => ({
      ...prev!,
      players: [...(prev!.players || []), newPlayer]
    }));
  };

  const saveRound = () => {
    if (!round.players || round.players.length === 0) {
      toast({
        title: 'Missing Players',
        description: 'Please add at least one player before saving.',
        variant: 'destructive',
      });
      return;
    }

    roundSavedRef.current = false;
    pendingScoreEventsRef.current = 0;

    const finalizeSaveIfReady = () => {
      if (!roundSavedRef.current) return;
      if (pendingScoreEventsRef.current > 0) return;
      guardSnapshotRef.current = serializedGuardState;
      setIsDirty(false);
    };

    const roundEvent = createRoundEvent(round as GolfRound);
    publishEvent(roundEvent, {
      onSuccess: () => {
        roundSavedRef.current = true;
        finalizeSaveIfReady();
        toast({
          title: 'Round Saved',
          description: 'Your scores have been published to Nostr.',
        });
      },
      onError: () => {
        toast({
          title: 'Save Failed',
          description: 'Failed to publish round. Please try again.',
          variant: 'destructive',
        });
      }
    });

    const settings = {
      useHandicaps,
      netScoring,
      modifiedStableford,
      allowWagers: persistWagers && wagersEnabled,
    };

    const gameEvent = createGameEvent(
      round.gameMode || GameMode.STROKE_PLAY,
      round.players || [],
      round.id || '',
      settings
    );

    if (persistWagers && wagersEnabled) {
      try {
        const wagersData: Record<string, number> = {};
        selectedGameModeList.forEach(gm => {
          const current = wagerAmounts[gm.key] || '111';
          const custom = customWagerAmounts[gm.key] || '';
          wagersData[gm.key] = current === 'custom' ? (parseInt(custom) || 0) : parseInt(current);
        });

        (gameEvent.tags as string[][]).push(['wagers', JSON.stringify(wagersData)]);
      } catch (err) {
        console.error('Failed to attach wagers to game event', err);
      }
    }

    publishEvent(gameEvent, {
      onError: (error) => {
        console.error('Error publishing game event:', error);
      }
    });

    const scoreEvents: Array<ReturnType<typeof createHoleScoreEvent>> = [];
    (round.players || []).forEach((player) => {
      const scores = player.scores || [];
      scores.forEach((strokes, holeIndex) => {
        if (!strokes || strokes <= 0) return;
        const hole = round.holes?.[holeIndex];
        if (!hole) return;

        const holeDetails = player.holeDetails?.[holeIndex] || {};
        const greensValue = holeDetails.greens === 'unreachable'
          ? 'unreachable'
          : typeof holeDetails.greens === 'boolean'
            ? holeDetails.greens
            : Boolean(hole.greens);
        const holeScore: HoleScore = {
          holeNumber: hole.holeNumber,
          par: hole.par,
          strokes,
          putts: typeof holeDetails.putts === 'number' ? holeDetails.putts : hole.putts,
          fairways: typeof holeDetails.fairways === 'boolean' ? holeDetails.fairways : Boolean(hole.fairways),
          greens: greensValue,
          chips: typeof holeDetails.chips === 'number' ? holeDetails.chips : hole.chips,
          sandTraps: typeof holeDetails.sandTraps === 'number' ? holeDetails.sandTraps : hole.sandTraps,
          penalties: typeof holeDetails.penalties === 'number' ? holeDetails.penalties : hole.penalties,
          notes: typeof holeDetails.notes === 'string' ? holeDetails.notes : hole.notes,
        };

        scoreEvents.push(createHoleScoreEvent(holeScore, round.id || '', player));
      });
    });

    scoreEvents.forEach((event) => {
      pendingScoreEventsRef.current += 1;
      publishEvent(event, {
        onSuccess: () => {
          pendingScoreEventsRef.current -= 1;
          finalizeSaveIfReady();
        },
        onError: (error) => {
          console.error('Error publishing hole score event:', error);
          pendingScoreEventsRef.current -= 1;
        }
      });
    });
  };

  const generateAndPublishSettlement = async () => {
    if (!user) {
      toast({ title: 'Login required', description: 'You must be logged in to publish settlement.', variant: 'destructive' });
      return;
    }

    const players = round.players || [];
    if (players.length === 0) {
      toast({ title: 'No players', description: 'Add players before settling wagers.', variant: 'destructive' });
      return;
    }

    let totalToCollect = 0;
    if (selectedGameModes.pinseekrCup && pinseekrWagersEnabled) {
      totalToCollect = (pinseekrCupSettings?.formatOrder || []).reduce((sum, format) => {
        const current = wagerAmounts[format] || '111';
        const custom = customWagerAmounts[format] || '';
        return sum + (current === 'custom' ? (parseInt(custom) || 0) : parseInt(current));
      }, 0);
    } else if (wagersEnabled) {
      totalToCollect = selectedGameModeList.reduce((sum, gameMode) => {
        const currentAmount = wagerAmounts[gameMode.key] || '111';
        const customAmount = customWagerAmounts[gameMode.key] || '';
        const wagerValue = currentAmount === 'custom' ? (parseInt(customAmount) || 0) : parseInt(currentAmount);
        return sum + wagerValue;
      }, 0);
    }

    if (totalToCollect <= 0) {
      toast({ title: 'No wagers', description: 'No wagers configured to settle.', variant: 'destructive' });
      return;
    }

    const payables: Payable[] = [];
    const coreData = convertToRoundData((round.players || []).map(p => ({ playerId: p.playerId, scores: p.scores || [], handicap: p.handicap || 0 })));

    const gameConfigs: { [gameName: string]: import('@/lib/golf/scoringEngine').WagerConfig } = {};
    selectedGameModeList.forEach(gm => {
      if (!wagersEnabled && !(selectedGameModes.pinseekrCup && pinseekrWagersEnabled)) return;
      const key = gm.key;
      const current = wagerAmounts[key] || '111';
      const custom = customWagerAmounts[key] || '';
      const unit = current === 'custom' ? (parseInt(custom) || 0) : parseInt(current);

      if (key === 'nassau') gameConfigs['Nassau'] = { useNet: true, unitSats: unit };
      if (key === 'skins') gameConfigs['Skins'] = { useNet: true, unitSats: unit, carryCap: 4 };
    });

    if (Object.keys(gameConfigs).length > 0) {
      const results = processRoundWagers(round.players || [], gameConfigs);
      for (const r of Object.values(results)) {
        payables.push(...r.ledger);
      }
    }

    if ((selectedGameModes.dots && wagersEnabled) || (selectedGameModes.pinseekrCup && pinseekrWagersEnabled && wagerAmounts['dots'])) {
      const dotsCfg = { wagerPerDot: parseInt(customWagerAmounts['dots'] || (wagerAmounts['dots'] === 'custom' ? '0' : (wagerAmounts['dots'] || '100'))) || 100 };
      const dotsData = convertToDotsData(coreData);
      const dotsResult = dotsEngine(dotsData, dotsCfg);
      for (const p of dotsResult.payments) {
        payables.push({ from: p.from, to: p.to, amount: p.amount, memo: p.reason });
      }
    }

    if ((selectedGameModes.snake && wagersEnabled) || (selectedGameModes.pinseekrCup && pinseekrWagersEnabled && wagerAmounts['snake'])) {
      const snakeData = convertToSnakeData(coreData);
      const snakeResult = snakeEngine(snakeData, { penaltyAmount: parseInt(customWagerAmounts['snake'] || (wagerAmounts['snake'] === 'custom' ? '0' : (wagerAmounts['snake'] || '100'))) || 500 });
      if (snakeResult.penalty && snakeResult.penalty.loser) {
        for (const rec of snakeResult.penalty.recipients || []) {
          const from = snakeResult.penalty.loser;
          const to = rec.playerId;
          payables.push({ from, to, amount: rec.amount, memo: 'Snake penalty' });
        }
      }
    }

    const netted = netting(payables);

    const aggregateByRecipient = (items: Payable[]): AggregatedInvoice[] => {
      const m = new Map<string, { amount: number; payers: Set<string>; memo?: string }>();
      for (const it of items) {
        if (it.amount <= 0) continue;
        const cur = m.get(it.to) || { amount: 0, payers: new Set<string>(), memo: it.memo };
        cur.amount += it.amount;
        cur.payers.add(it.from);
        m.set(it.to, cur);
      }
      return Array.from(m.entries()).map(([recipient, v]) => ({ recipient, amount: v.amount, payers: Array.from(v.payers), memo: v.memo }));
    };

    const aggregated = aggregateByRecipient(netted);
    setSettlementPreview(aggregated);
    setShowSettlementPreview(true);
  };

  const confirmSettlementAndCreateInvoices = async () => {
    if (!user) {
      toast({ title: 'Login required', description: 'You must be logged in to publish settlement.', variant: 'destructive' });
      return;
    }

    setIsCreatingInvoices(true);

    try {
      let totalPot = 0;
      if (selectedGameModes.pinseekrCup && pinseekrWagersEnabled) {
        totalPot = (pinseekrCupSettings?.formatOrder || []).reduce((sum, format) => {
          const current = wagerAmounts[format] || '111';
          const custom = customWagerAmounts[format] || '';
          return sum + (current === 'custom' ? (parseInt(custom) || 0) : parseInt(current));
        }, 0);
      } else if (wagersEnabled) {
        totalPot = selectedGameModeList.reduce((sum, gameMode) => {
          const currentAmount = wagerAmounts[gameMode.key] || '111';
          const customAmount = customWagerAmounts[gameMode.key] || '';
          const wagerValue = currentAmount === 'custom' ? (parseInt(customAmount) || 0) : parseInt(currentAmount);
          return sum + wagerValue;
        }, 0);
      }

      const payments = settlementPreview.map(agg => ({
        from: agg.payers[0] || '',
        to: agg.recipient,
        amountSats: agg.amount,
        memo: agg.memo,
      }));

      const settlementEvent: Omit<import('@nostrify/nostrify').NostrEvent, 'id' | 'pubkey' | 'sig'> = {
        kind: APP_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', `${round.id}-result`],
          ['t', 'golf'],
          ['t', SUBTYPES.RESULT],
          ['round', `${round.id ?? ''}`],
          ...(round.metadata?.courseName ? [['course', round.metadata.courseName]] : []),
        ],
        content: JSON.stringify({
          payments,
          totalPot,
          gameModes: selectedGameModeList.map(gm => gm.name),
          date: round.date || Date.now(),
        }),
      };

      await publishEvent(settlementEvent);

      toast({
        title: 'Settlement published',
        description: 'Winners can now generate invoices to claim their winnings.'
      });

      setShowSettlementPreview(false);
    } catch (err) {
      console.error('Failed to publish settlement event', err);
      toast({
        title: 'Publish failed',
        description: 'Could not publish settlement event.',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingInvoices(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8">
        <MobileContainer>
          <div>
            <div className="max-w-6xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {round.metadata?.courseName || selectedCourse?.name || 'Golf Course'} - {round.gameMode || 'STROKE PLAY'}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {round.players?.length || 0} players • {new Date(round.date || Date.now()).toLocaleDateString()}
                </p>
              </div>

              <div className="mt-8">
                <ScoreCard
                  round={round as GolfRound}
                  course={selectedCourse}
                  onUpdateRound={setRound}
                  onSaveRound={saveRound}
                  onShareRound={() => {
                    toast({
                      title: 'Round Shared',
                      description: 'Your round has been shared with your Nostr network.',
                    });
                  }}
                />

                {(wagersEnabled || (selectedGameModes.pinseekrCup && pinseekrWagersEnabled)) && (
                  <div className="mt-4 flex gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={generateAndPublishSettlement}
                    >
                      Generate Settlement Invoices (NWC)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </MobileContainer>
      </div>

      <AddPlayerDialog
        open={showAddPlayerDialog}
        onOpenChange={setShowAddPlayerDialog}
        onAddPlayer={handleAddPlayer}
        existingPlayers={round.players || []}
        roundId={round.id}
        joinCode={roundCode}
        courseName={selectedCourse?.name}
      />

      <Dialog open={wolfSettingsOpen} onOpenChange={setWolfSettingsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Wolf Settings</DialogTitle>
            <DialogDescription>
              Assign default partners for Wolf mode. Players can still pick partners per-hole when playing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {round.players && round.players.length > 0 ? (
              round.players.map((p) => (
                <div key={`wolf-${p.playerId}`} className="flex items-center justify-between">
                  <div className="text-sm">{p.name}</div>
                  <select
                    value={wolfPartners[p.playerId] || ''}
                    onChange={(e) => setWolfPartners(prev => ({ ...prev, [p.playerId]: e.target.value || null }))}
                    className="border px-2 py-1 rounded"
                  >
                    <option value="">No default partner</option>
                    {(round.players || []).filter(x => x.playerId !== p.playerId).map(o => (
                      <option key={o.playerId} value={o.playerId}>{o.name}</option>
                    ))}
                  </select>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Add players to assign partners.</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setWolfSettingsOpen(false)}>Close</Button>
            <Button onClick={() => setWolfSettingsOpen(false)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettlementPreview} onOpenChange={setShowSettlementPreview}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Settlement Preview</DialogTitle>
            <DialogDescription>
              Review the net payments below. This will be published to Nostr, and winners can generate invoices to claim their winnings.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3 max-h-72 overflow-auto">
            {settlementPreview.length === 0 ? (
              <div className="text-sm text-muted-foreground">No payments to settle.</div>
            ) : (
              settlementPreview.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                  <div>
                    <div className="text-sm font-medium">{(p.payers || []).join(', ')} → {p.recipient}</div>
                    <div className="text-xs text-muted-foreground">{p.memo || 'Net settlement'}</div>
                  </div>
                  <div className="text-sm font-mono font-bold">{p.amount.toLocaleString()} sats</div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSettlementPreview(false)}>Cancel</Button>
            <Button onClick={confirmSettlementAndCreateInvoices} disabled={isCreatingInvoices}>
              {isCreatingInvoices ? 'Publishing...' : 'Publish Settlement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default RoundScorePage;
