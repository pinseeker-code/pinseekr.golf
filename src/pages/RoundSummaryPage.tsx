import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import MobileContainer from '@/components/MobileContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { calculatePlayerStats } from '@/lib/golf/statsCalculator';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { APP_KIND, type GolfRound, type HoleScore, type PlayerInRound } from '@/lib/golf/types';
import { SUBTYPES } from '@/lib/golfTags';
import { parseRoundEvent, parseHoleScoreEvent } from '@/lib/golf/nostrEvents';
import { genUserName } from '@/lib/genUserName';

export const RoundSummaryPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: roundId } = useParams<{ id: string }>();
  const { nostr } = useNostr();
  const [round, setRound] = useState<GolfRound | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');

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
          { kinds: [APP_KIND], '#round': [roundId], '#t': ['golf', SUBTYPES.PLAYER, SUBTYPES.HOLE], limit: 500 }
        ];

        const events = (await nostr.query(filters, { signal: controller.signal })) as NostrEvent[];
        if (aborted) return;

        const roundEvent = events.find((e: NostrEvent) => {
          if (e.kind !== APP_KIND || !Array.isArray(e.tags)) return false;
          const tags = e.tags as string[][];
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

        const parsed = parseRoundEvent(roundEvent);
        if (!parsed) {
          setLoadError('Failed to parse round data.');
          setIsLoading(false);
          return;
        }

        const playerEvents = events.filter((e: NostrEvent) =>
          e.kind === APP_KIND && (e.tags as string[][]).some(t => t[0] === 't' && t[1] === SUBTYPES.PLAYER)
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
          for (const pe of playerEvents) {
            const playerId = ((pe.tags as string[][]).find((t: string[]) => t[0] === 'player') || [])[1] || pe.pubkey;
            const name = ((pe.tags as string[][]).find((t: string[]) => t[0] === 'name') || [])[1] || genUserName(playerId);
            const handicap = parseInt(((pe.tags as string[][]).find((t: string[]) => t[0] === 'handicap') || [])[1] || '0', 10) || 0;
            players.push({ playerId, name, handicap, scores: [], total: 0, netTotal: 0 });
          }
        }

        const holeEvents = events.filter((e: NostrEvent) =>
          e.kind === APP_KIND && (e.tags as string[][]).some(t => t[0] === 't' && t[1] === SUBTYPES.HOLE)
        );
        const holeScores = holeEvents
          .map((event: NostrEvent) => parseHoleScoreEvent(event))
          .filter(Boolean) as HoleScore[];

        for (const he of holeEvents) {
          const hole = parseHoleScoreEvent(he as NostrEvent);
          if (!hole) continue;
          const playerId = (((he.tags as string[][]).find((t: string[]) => t[0] === 'player') || [])[1]) || he.pubkey;
          let p = players.find(pl => pl.playerId === playerId);
          if (!p) {
            p = { playerId, name: genUserName(playerId), handicap: 0, scores: [], total: 0, netTotal: 0 } as PlayerInRound;
            players.push(p);
          }
          if (!p.scores) p.scores = [];
          p.scores[hole.holeNumber - 1] = hole.strokes;
          const existingDetails = p.holeDetails || {};
          existingDetails[hole.holeNumber - 1] = {
            putts: hole.putts,
            fairways: hole.fairways,
            greens: hole.greens,
            sandTraps: hole.sandTraps,
            penalties: hole.penalties,
            notes: hole.notes
          };
          p.holeDetails = existingDetails;
        }

        const newRound: GolfRound = {
          ...parsed,
          players,
          holes: holeScores.length > 0 ? holeScores : parsed.holes
        } as GolfRound;

        setRound(newRound);
        setIsLoading(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Failed to load round summary', error);
        setLoadError('Failed to load round.');
        setIsLoading(false);
      }
    })();

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [nostr, roundId]);

  const coursePars = useMemo(() => {
    if (!round?.holes) return {} as { [hole: number]: number };
    return round.holes.reduce((acc, hole) => {
      acc[hole.holeNumber] = hole.par;
      return acc;
    }, {} as { [hole: number]: number });
  }, [round?.holes]);

  const playerStats = useMemo(() => {
    if (!round) return [];
    return round.players.map(player => calculatePlayerStats(player, coursePars));
  }, [round, coursePars]);

  const getPlayerColor = (index: number) => {
    const colors = ['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-purple-500'];
    return colors[index % colors.length];
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 py-4">
        <MobileContainer>
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <Button 
                variant="ghost" 
                onClick={() => (roundId ? navigate(`/round/${roundId}/score`) : navigate('/round/new'))}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Scorecard
              </Button>
            </div>

            <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Round Summary</h1>

            {/* Player Stats Cards */}
            {isLoading && (
              <div className="text-center text-sm text-muted-foreground">Loading round...</div>
            )}

            {!isLoading && loadError && (
              <div className="text-center text-sm text-destructive">{loadError}</div>
            )}

            {!isLoading && !loadError && (
              <div className="space-y-4">
                {playerStats.map((stats, index) => (
                  <Card key={stats.playerId} className="border-0 shadow-lg dark:bg-gray-800">
                    <CardHeader className={`${getPlayerColor(index)} text-white rounded-t-lg py-4`}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/30 rounded-full flex items-center justify-center font-bold text-lg">
                          {getInitials(stats.playerName)}
                        </div>
                        <div>
                          <CardTitle className="text-xl">{stats.playerName}</CardTitle>
                          <p className="text-sm text-white/90">{stats.holesPlayed} holes • Score: {stats.totalScore} ({stats.scoreToParString})</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Score Breakdown */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Eagles:</span>
                              <span className="text-xl font-bold text-gray-900 dark:text-white">{stats.eagles}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Birdies:</span>
                              <span className="text-xl font-bold text-gray-900 dark:text-white">{stats.birdies}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Pars:</span>
                              <span className="text-xl font-bold text-gray-900 dark:text-white">{stats.pars}</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Bogeys:</span>
                              <span className="text-xl font-bold text-gray-900 dark:text-white">{stats.bogeys}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Double+:</span>
                              <span className="text-xl font-bold text-gray-900 dark:text-white">{stats.doublePlus}</span>
                            </div>
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.fairwaysPercent}%</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Fairways</div>
                            <div className="text-xs text-gray-500">{stats.fairwaysHit}/{stats.fairwaysAttempted}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.greensPercent}%</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Greens</div>
                            <div className="text-xs text-gray-500">{stats.girHit}/{stats.holesPlayed}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgPutts}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Avg Putts</div>
                            <div className="text-xs text-gray-500">{stats.totalPutts} total</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 flex gap-3">
              <Button 
                onClick={() => (roundId ? navigate(`/round/${roundId}/score`) : navigate('/round/new'))}
                className="flex-1"
              >
                Back to Scorecard
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/round/new')}
                className="flex-1"
              >
                New Round
              </Button>
            </div>
          </div>
        </MobileContainer>
      </div>
    </Layout>
  );
};

export default RoundSummaryPage;
