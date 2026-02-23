import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import MobileContainer from '@/components/MobileContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Trophy, DollarSign, Receipt, TrendingUp } from 'lucide-react';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { ZapButton } from '@/components/ZapButton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { calculatePlayerStats } from '@/lib/golf/statsCalculator';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { APP_KIND, type GolfRound, type HoleScore, type PlayerInRound } from '@/lib/golf/types';
import { SUBTYPES } from '@/lib/golfTags';
import { parseHoleScoreEvent, parseRoundEvent, parseExpenseEvent } from '@/lib/golf/nostrEvents';
import { genUserName } from '@/lib/genUserName';
import type { Expense } from '@/lib/golf/expenseTypes';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_ICONS, CURRENCY_SYMBOLS } from '@/lib/golf/expenseTypes';

const buildCoursePars = (round: GolfRound | null) => {
  if (!round?.holes) return {} as { [hole: number]: number };
  return round.holes.reduce((acc, hole) => {
    acc[hole.holeNumber] = hole.par;
    return acc;
  }, {} as { [hole: number]: number });
};

export const RoundDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: roundId } = useParams<{ id: string }>();
  const { nostr } = useNostr();
  const [round, setRound] = useState<GolfRound | null>(null);
  const [roundEvent, setRoundEvent] = useState<NostrEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [settlementEvents, setSettlementEvents] = useState<NostrEvent[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (!roundId) {
      setIsLoading(false);
      setLoadError('Missing round id.');
      return;
    }

    if (!nostr) {
      setIsLoading(false);
      setLoadError('Nostr interface not available.');
      return;
    }

    let aborted = false;
    const controller = new AbortController();

    (async () => {
      try {
        const filters = [
          { kinds: [APP_KIND], '#d': [roundId], '#t': ['golf', SUBTYPES.ROUND], limit: 1 },
          { kinds: [APP_KIND], '#round-id': [roundId], '#t': ['golf', SUBTYPES.ROUND], limit: 1 },
          { kinds: [APP_KIND], '#round': [roundId], '#t': ['golf', SUBTYPES.PLAYER, SUBTYPES.HOLE, SUBTYPES.RESULT, SUBTYPES.EXPENSE], limit: 500 }
        ];

        const events = (await nostr.query(filters, { signal: controller.signal })) as NostrEvent[];
        if (aborted) return;

        const roundEvent = events.find((event) => {
          if (event.kind !== APP_KIND || !Array.isArray(event.tags)) return false;
          const tags = event.tags as string[][];
          const isRoundEvent = tags.some(t => t[0] === 't' && t[1] === SUBTYPES.ROUND);
          if (!isRoundEvent) return false;
          const dTag = tags.find(t => t[0] === 'd')?.[1];
          const roundIdTag = tags.find(t => t[0] === 'round-id')?.[1];
          return dTag === roundId || roundIdTag === roundId;
        });

        if (!roundEvent) {
          setLoadError('Round not found.');
          setIsLoading(false);
          return;
        }

        setRoundEvent(roundEvent);
        const parsed = parseRoundEvent(roundEvent);
        if (!parsed) {
          setLoadError('Failed to parse round data.');
          setIsLoading(false);
          return;
        }

        const playerEvents = events.filter((event) =>
          event.kind === APP_KIND && (event.tags as string[][]).some(t => t[0] === 't' && t[1] === SUBTYPES.PLAYER)
        );
        const players: PlayerInRound[] = [];

        if (playerEvents.length === 0) {
          const playersTag = (roundEvent.tags as string[][]).find((t: string[]) => t[0] === 'players');
          if (playersTag && playersTag.length > 1) {
            for (let i = 1; i < playersTag.length; i++) {
              const pub = playersTag[i];
              if (!pub) continue;
              players.push({ playerId: pub, name: genUserName(pub), handicap: 0, scores: [], total: 0, netTotal: 0 });
            }
          }
        } else {
          for (const playerEvent of playerEvents) {
            const tags = playerEvent.tags as string[][];
            const playerId = tags.find(t => t[0] === 'player')?.[1] || playerEvent.pubkey;
            const name = tags.find(t => t[0] === 'name')?.[1] || genUserName(playerId);
            const handicap = parseInt(tags.find(t => t[0] === 'handicap')?.[1] || '0', 10) || 0;
            const total = parseInt(tags.find(t => t[0] === 'total')?.[1] || '0', 10) || 0;
            const netTotal = parseInt(tags.find(t => t[0] === 'net-total')?.[1] || '0', 10) || 0;
            players.push({ playerId, name, handicap, scores: [], total, netTotal });
          }
        }

        const holeEvents = events.filter((event) =>
          event.kind === APP_KIND && (event.tags as string[][]).some(t => t[0] === 't' && t[1] === SUBTYPES.HOLE)
        );
        const holeScores = holeEvents
          .map((event) => parseHoleScoreEvent(event))
          .filter(Boolean) as HoleScore[];

        const resultEvents = events.filter((event) =>
          event.kind === APP_KIND && (event.tags as string[][]).some(t => t[0] === 't' && t[1] === SUBTYPES.RESULT)
        );
        setSettlementEvents(resultEvents);

        const expenseEvents = events.filter((event) =>
          event.kind === APP_KIND && (event.tags as string[][]).some(t => t[0] === 't' && t[1] === SUBTYPES.EXPENSE)
        );
        const parsedExpenses = expenseEvents
          .map((event) => parseExpenseEvent(event))
          .filter(Boolean) as Expense[];
        setExpenses(parsedExpenses);

        for (const holeEvent of holeEvents) {
          const hole = parseHoleScoreEvent(holeEvent as NostrEvent);
          if (!hole) continue;
          const playerId = (holeEvent.tags as string[][]).find(t => t[0] === 'player')?.[1] || holeEvent.pubkey;
          let player = players.find(pl => pl.playerId === playerId);
          if (!player) {
            player = { playerId, name: genUserName(playerId), handicap: 0, scores: [], total: 0, netTotal: 0 };
            players.push(player);
          }
          if (!player.scores) player.scores = [];
          player.scores[hole.holeNumber - 1] = hole.strokes;
          if (!player.total) {
            player.total = player.scores.reduce((sum, score) => sum + (score || 0), 0);
          }
          const existingDetails = player.holeDetails || {};
          existingDetails[hole.holeNumber - 1] = {
            putts: hole.putts,
            fairways: hole.fairways,
            greens: hole.greens,
            sandTraps: hole.sandTraps,
            penalties: hole.penalties,
            notes: hole.notes
          };
          player.holeDetails = existingDetails;
        }

        const newRound: GolfRound = {
          ...parsed,
          players,
          holes: holeScores.length > 0 ? holeScores : parsed.holes
        };

        setRound(newRound);
        setIsLoading(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Failed to load round details', error);
        setLoadError('Failed to load round.');
        setIsLoading(false);
      }
    })();

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [nostr, roundId]);

  const coursePars = useMemo(() => buildCoursePars(round), [round]);
  const playerStats = useMemo(() => {
    if (!round) return [];
    return round.players.map(player => calculatePlayerStats(player, coursePars));
  }, [round, coursePars]);

  // Prepare chart data - cumulative scores per hole
  const chartData = useMemo(() => {
    if (!round || !round.players || round.players.length === 0) return [];
    
    const data = [];
    for (let hole = 1; hole <= 18; hole++) {
      const holeData: { hole: number; par?: number; [key: string]: number | undefined } = { 
        hole,
        par: coursePars[hole] || undefined
      };
      
      // Calculate cumulative score for each player up to this hole
      round.players.forEach(player => {
        if (player.scores && player.scores.length > 0) {
          const cumulativeScore = player.scores
            .slice(0, hole)
            .reduce((sum, score) => sum + (score || 0), 0);
          holeData[player.name] = cumulativeScore || undefined;
        }
      });
      
      data.push(holeData);
    }
    return data;
  }, [round, coursePars]);

  // Player colors for chart
  const playerColors = ['#60A5FA', '#F472B6', '#34D399', '#F59E0B', '#A78BFA', '#FB7185'];

  const roundDate = round ? new Date(round.date) : null;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-4">
        <MobileContainer>
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => navigate('/rounds')}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Rounds
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => (roundId ? navigate(`/round/${roundId}/summary`) : navigate('/rounds'))}
                >
                  View Summary
                </Button>
                <Button
                  onClick={() => (roundId ? navigate(`/round/${roundId}/score`) : navigate('/round/new'))}
                >
                  Open Scorecard
                </Button>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Round Details</h1>
                <p className="text-muted-foreground">
                  Full round context and player results
                </p>
              </div>
              {roundEvent && (
                <ZapButton 
                  target={roundEvent as unknown as import('nostr-tools').Event} 
                  className="text-sm"
                  showCount={true}
                />
              )}
            </div>

            {isLoading && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32 mt-1" />
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="space-y-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
                  <CardContent className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-5 w-32" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
                  <CardContent><Skeleton className="h-40 w-full" /></CardContent>
                </Card>
              </div>
            )}

            {!isLoading && loadError && (
              <Alert variant="destructive">
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            )}

            {!isLoading && round && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>{round.metadata.courseName}</CardTitle>
                    <CardDescription>
                      {roundDate ? roundDate.toLocaleDateString() : 'Unknown date'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <div className="text-muted-foreground">Game Mode</div>
                      <div className="font-semibold capitalize">{round.gameMode.replace('-', ' ')}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Status</div>
                      <div className="font-semibold capitalize">{round.status}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Players</div>
                      <div className="font-semibold">{round.players.length}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Holes</div>
                      <div className="font-semibold">{round.holes.length || 18}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Players</CardTitle>
                    <CardDescription>Gross totals and net scores when available</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {playerStats.map((stats) => {
                      const player = round.players.find(p => p.playerId === stats.playerId);
                      const netScore = player?.netTotal && player.netTotal > 0 ? player.netTotal : null;

                      return (
                        <div key={stats.playerId} className="flex items-center justify-between border-b border-border pb-3 last:border-b-0 last:pb-0">
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">{stats.playerName}</div>
                            <div className="text-xs text-muted-foreground">
                              Hcp {player?.handicap ?? 0} • {stats.holesPlayed} holes
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              Gross {stats.totalScore} ({stats.scoreToParString})
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Net {netScore ?? '—'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Scorecard</CardTitle>
                    <CardDescription>Hole-by-hole scores for all players</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b-2 border-border">
                            <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Hole</th>
                            {round.holes.slice(0, 9).map((hole) => (
                              <th key={hole.holeNumber} className="text-center py-2 px-1 font-semibold">
                                {hole.holeNumber}
                              </th>
                            ))}
                            <th className="text-center py-2 px-2 font-bold bg-muted">Out</th>
                          </tr>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-2 text-xs text-muted-foreground">Par</th>
                            {round.holes.slice(0, 9).map((hole) => (
                              <td key={hole.holeNumber} className="text-center py-2 px-1 text-xs text-muted-foreground">
                                {hole.par}
                              </td>
                            ))}
                            <td className="text-center py-2 px-2 text-xs font-semibold bg-muted">
                              {round.holes.slice(0, 9).reduce((sum, h) => sum + h.par, 0)}
                            </td>
                          </tr>
                        </thead>
                        <tbody>
                          {round.players.map((player, _playerIndex) => {
                            const frontNine = player.scores.slice(0, 9);
                            const frontNineTotal = frontNine.reduce((sum, s) => sum + (s || 0), 0);
                            const frontNinePar = round.holes.slice(0, 9).reduce((sum, h) => sum + h.par, 0);
                            const frontNineToPar = frontNineTotal - frontNinePar;

                            return (
                              <tr key={player.playerId} className="border-b border-border hover:bg-muted/50">
                                <td className="py-2 px-2 font-semibold text-sm">{player.name}</td>
                                {round.holes.slice(0, 9).map((hole, holeIndex) => {
                                  const score = player.scores[holeIndex] || 0;
                                  const par = hole.par;
                                  const scoreToPar = score - par;
                                  const scoreClass = 
                                    score === 0 ? 'text-muted-foreground' :
                                    scoreToPar <= -2 ? 'text-yellow-600 font-bold' :
                                    scoreToPar === -1 ? 'text-blue-600 font-semibold' :
                                    scoreToPar === 0 ? 'text-green-600' :
                                    scoreToPar === 1 ? 'text-orange-600' :
                                    'text-red-600 font-semibold';

                                  return (
                                    <td key={holeIndex} className={`text-center py-2 px-1 ${scoreClass}`}>
                                      {score || '—'}
                                    </td>
                                  );
                                })}
                                <td className="text-center py-2 px-2 font-bold bg-muted">
                                  {frontNineTotal > 0 ? (
                                    <>
                                      {frontNineTotal}
                                      <span className="text-xs text-muted-foreground ml-1">
                                        ({frontNineToPar > 0 ? `+${frontNineToPar}` : frontNineToPar})
                                      </span>
                                    </>
                                  ) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {round.holes.length > 9 && (
                        <table className="w-full text-sm border-collapse mt-6">
                          <thead>
                            <tr className="border-b-2 border-border">
                              <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Hole</th>
                              {round.holes.slice(9, 18).map((hole) => (
                                <th key={hole.holeNumber} className="text-center py-2 px-1 font-semibold">
                                  {hole.holeNumber}
                                </th>
                              ))}
                              <th className="text-center py-2 px-2 font-bold bg-muted">In</th>
                              <th className="text-center py-2 px-2 font-bold bg-primary text-primary-foreground">Total</th>
                            </tr>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground">Par</th>
                              {round.holes.slice(9, 18).map((hole) => (
                                <td key={hole.holeNumber} className="text-center py-2 px-1 text-xs text-muted-foreground">
                                  {hole.par}
                                </td>
                              ))}
                              <td className="text-center py-2 px-2 text-xs font-semibold bg-muted">
                                {round.holes.slice(9, 18).reduce((sum, h) => sum + h.par, 0)}
                              </td>
                              <td className="text-center py-2 px-2 text-xs font-bold bg-primary text-primary-foreground">
                                {round.holes.reduce((sum, h) => sum + h.par, 0)}
                              </td>
                            </tr>
                          </thead>
                          <tbody>
                            {round.players.map((player) => {
                              const backNine = player.scores.slice(9, 18);
                              const backNineTotal = backNine.reduce((sum, s) => sum + (s || 0), 0);
                              const backNinePar = round.holes.slice(9, 18).reduce((sum, h) => sum + h.par, 0);
                              const backNineToPar = backNineTotal - backNinePar;
                              const totalScore = player.total || player.scores.reduce((sum, s) => sum + (s || 0), 0);
                              const totalPar = round.holes.reduce((sum, h) => sum + h.par, 0);
                              const totalToPar = totalScore - totalPar;

                              return (
                                <tr key={player.playerId} className="border-b border-border hover:bg-muted/50">
                                  <td className="py-2 px-2 font-semibold text-sm">{player.name}</td>
                                  {round.holes.slice(9, 18).map((hole, holeIndex) => {
                                    const score = player.scores[holeIndex + 9] || 0;
                                    const par = hole.par;
                                    const scoreToPar = score - par;
                                    const scoreClass = 
                                      score === 0 ? 'text-muted-foreground' :
                                      scoreToPar <= -2 ? 'text-yellow-600 font-bold' :
                                      scoreToPar === -1 ? 'text-blue-600 font-semibold' :
                                      scoreToPar === 0 ? 'text-green-600' :
                                      scoreToPar === 1 ? 'text-orange-600' :
                                      'text-red-600 font-semibold';

                                    return (
                                      <td key={holeIndex} className={`text-center py-2 px-1 ${scoreClass}`}>
                                        {score || '—'}
                                      </td>
                                    );
                                  })}
                                  <td className="text-center py-2 px-2 font-bold bg-muted">
                                    {backNineTotal > 0 ? (
                                      <>
                                        {backNineTotal}
                                        <span className="text-xs text-muted-foreground ml-1">
                                          ({backNineToPar > 0 ? `+${backNineToPar}` : backNineToPar})
                                        </span>
                                      </>
                                    ) : '—'}
                                  </td>
                                  <td className="text-center py-2 px-2 font-bold bg-primary text-primary-foreground">
                                    {totalScore > 0 ? (
                                      <>
                                        {totalScore}
                                        <span className="text-xs ml-1 opacity-90">
                                          ({totalToPar > 0 ? `+${totalToPar}` : totalToPar})
                                        </span>
                                      </>
                                    ) : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {round.gameMode && round.gameMode !== 'stroke-play' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5" />
                        Game Results
                      </CardTitle>
                      <CardDescription>
                        {round.gameMode.replace('-', ' ')} scoring
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        Game results calculation for {round.gameMode} will be displayed here once engines are integrated.
                      </div>
                    </CardContent>
                  </Card>
                )}

                {settlementEvents.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Settlement Status
                      </CardTitle>
                      <CardDescription>
                        Published settlements for this round
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {settlementEvents.map((event, index) => {
                          const tags = event.tags as string[][];
                          const gameModeTag = tags.find(t => t[0] === 'game-mode')?.[1];
                          const statusTag = tags.find(t => t[0] === 'status')?.[1];
                          const winnersTag = tags.find(t => t[0] === 'winners');
                          const winnerPubkeys = winnersTag ? winnersTag.slice(1) : [];
                          const winnerNames = winnerPubkeys.map(pubkey => {
                            const player = round.players.find(p => p.playerId === pubkey);
                            return player?.name || genUserName(pubkey);
                          });

                          return (
                            <div key={index} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-sm capitalize">
                                    {gameModeTag?.replace('-', ' ') || 'Unknown game'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Settlement published
                                  </div>
                                </div>
                                <div className="text-right text-sm">
                                  <div className="font-semibold capitalize">
                                    {statusTag || 'Completed'}
                                  </div>
                                  {winnerNames.length > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      {winnerNames.join(', ')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div className="mt-4">
                          <Button
                            variant="outline"
                            onClick={() => navigate('/settlements')}
                            className="w-full"
                          >
                            View Settlements Page
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {expenses.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        Expenses
                      </CardTitle>
                      <CardDescription>
                        Round expenses and cost splits
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {expenses.map((expense) => {
                          const payer = round.players.find(p => p.playerId === expense.paidByPlayerId);
                          const payerName = payer?.name || genUserName(expense.paidByPlayerId);
                          const categoryLabel = EXPENSE_CATEGORY_LABELS[expense.category] || expense.category;
                          const categoryIcon = EXPENSE_CATEGORY_ICONS[expense.category] || '📝';
                          const currencySymbol = CURRENCY_SYMBOLS[expense.currency] || expense.currency;

                          return (
                            <div key={expense.id} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-2">
                                  <span className="text-xl">{categoryIcon}</span>
                                  <div>
                                    <div className="font-semibold text-sm">{categoryLabel}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {expense.description || 'No description'}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Paid by {payerName}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Split: {expense.splitMode}
                                      {expense.splitBetweenPlayerIds.length > 0 && (
                                        <> • {expense.splitBetweenPlayerIds.length} {expense.splitBetweenPlayerIds.length === 1 ? 'player' : 'players'}</>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-sm">
                                    {currencySymbol}{expense.amount.toFixed(2)}
                                  </div>
                                  {expense.amountSats > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      {expense.amountSats.toLocaleString()} sats
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Stats Chart */}
                {round && round.players && round.players.length > 0 && chartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Score Progress
                      </CardTitle>
                      <CardDescription>
                        Cumulative strokes per hole
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ChartContainer
                        config={round.players.reduce((acc, player, idx) => {
                          acc[player.name] = {
                            label: player.name,
                            color: playerColors[idx % playerColors.length] || '#60A5FA',
                          };
                          return acc;
                        }, {} as Record<string, { label: string; color: string }>)}
                      >
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="hole" 
                            label={{ value: 'Hole', position: 'insideBottom', offset: -5 }}
                          />
                          <YAxis 
                            label={{ value: 'Cumulative Strokes', angle: -90, position: 'insideLeft' }}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Legend />
                          {round.players.map((player, idx) => (
                            <Line
                              key={player.playerId}
                              type="monotone"
                              dataKey={player.name}
                              stroke={playerColors[idx % playerColors.length]}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          ))}
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Comments Section */}
                {roundEvent && (
                  <CommentsSection 
                    root={roundEvent}
                    title="Round Discussion"
                    emptyStateMessage="No comments yet"
                    emptyStateSubtitle="Share your thoughts about this round!"
                  />
                )}
              </>
            )}
          </div>
        </MobileContainer>
      </div>
    </Layout>
  );
};

export default RoundDetailsPage;
