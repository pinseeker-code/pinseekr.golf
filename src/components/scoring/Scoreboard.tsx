import React, { useState, useMemo } from 'react';
import { GolfRound } from '@/lib/golf/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ScoreboardProps {
  round: GolfRound;
  course?: {
    holes: { [hole: number]: number };
  } | null;
  /** Highlight which hole the user is currently on (0-indexed) */
  currentHoleIndex?: number;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Optional CSS class */
  className?: string;
}

type NineSelection = 'front' | 'back' | 'all';

/**
 * Golf scoreboard component displaying all players' scores across all holes.
 * Shows hole-by-hole scores, running totals, and match play indicators.
 * For 18-hole rounds, tabs allow switching between Front 9, Back 9, or All.
 */
export const Scoreboard: React.FC<ScoreboardProps> = ({
  round,
  course,
  currentHoleIndex,
  compact = false,
  className,
}) => {
  const totalHoles = round.holes.length;
  const has18Holes = totalHoles >= 18;
  
  // Default to showing the nine that contains the current hole
  const getDefaultNine = (): NineSelection => {
    if (!has18Holes) return 'all';
    if (currentHoleIndex !== undefined) {
      return currentHoleIndex < 9 ? 'front' : 'back';
    }
    return 'front';
  };
  
  const [selectedNine, setSelectedNine] = useState<NineSelection>(getDefaultNine);

  // Calculate which holes to display
  const displayedHoleIndices = useMemo(() => {
    if (!has18Holes || selectedNine === 'all') {
      return Array.from({ length: totalHoles }, (_, i) => i);
    }
    if (selectedNine === 'front') {
      return Array.from({ length: Math.min(9, totalHoles) }, (_, i) => i);
    }
    // back
    return Array.from({ length: Math.min(9, totalHoles - 9) }, (_, i) => i + 9);
  }, [has18Holes, selectedNine, totalHoles]);

  const getPlayerInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Calculate player statistics
  const calculatePlayerStats = (playerIndex: number) => {
    const player = round.players[playerIndex];
    const stats = {
      holesPlayed: 0,
      birdies: 0,
      eagles: 0,
      pars: 0,
      bogeys: 0,
      doubleBogeys: 0,
      fairwaysHit: 0,
      fairwaysTotal: 0,
      greensHit: 0,
      greensTotal: 0,
      totalPutts: 0,
      averagePutts: 0,
      score: player.total || 0,
      netScore: player.netTotal || 0
    };

    round.holes?.forEach((hole, holeIndex) => {
      const strokes = player.scores[holeIndex];
      if (strokes > 0) {
        stats.holesPlayed++;
        const diff = strokes - hole.par;
        
        if (diff <= -2) stats.eagles++;
        else if (diff === -1) stats.birdies++;
        else if (diff === 0) stats.pars++;
        else if (diff === 1) stats.bogeys++;
        else if (diff >= 2) stats.doubleBogeys++;

        // Fairway stats - only for par 4s and 5s
        if (hole.par >= 4) {
          stats.fairwaysTotal++;
          const pHole = player.holeDetails?.[holeIndex];
          if (pHole?.fairways) stats.fairwaysHit++;
        }

        // Green stats
        stats.greensTotal++;
        const pHole2 = player.holeDetails?.[holeIndex];
        if (pHole2?.greens) stats.greensHit++;

        // Putt stats
        const pHolePutts = player.holeDetails?.[holeIndex]?.putts;
        const puttsToAdd = typeof pHolePutts === 'number' ? pHolePutts : (hole.putts || 0);
        if (puttsToAdd > 0) {
          stats.totalPutts += puttsToAdd;
        }
      }
    });

    stats.averagePutts = stats.holesPlayed > 0 ? stats.totalPutts / stats.holesPlayed : 0;
    return stats;
  };

  const getPar = (holeIndex: number): number => {
    const holeNumber = holeIndex + 1;
    return round.holes[holeIndex]?.par || course?.holes?.[holeNumber] || 4;
  };

  const getScoreColor = (score: number, par: number): string => {
    if (score === 0) return 'text-gray-400';
    const diff = score - par;
    if (diff <= -2) return 'text-yellow-400 font-bold'; // Eagle or better
    if (diff === -1) return 'text-green-400'; // Birdie
    if (diff === 0) return 'text-white'; // Par
    if (diff === 1) return 'text-yellow-300'; // Bogey
    return 'text-red-400'; // Double+
  };

  const getScoreBg = (score: number, par: number): string => {
    if (score === 0) return '';
    const diff = score - par;
    if (diff <= -2) return 'bg-yellow-500/20 ring-2 ring-yellow-400'; // Eagle or better
    if (diff === -1) return 'bg-green-500/20'; // Birdie
    return '';
  };

  // Calculate match play status for each hole
  const getMatchPlayIndicator = (holeIndex: number): { winner: number | null; display: string } => {
    if (round.players.length !== 2) return { winner: null, display: '' };
    
    const s1 = round.players[0].scores[holeIndex];
    const s2 = round.players[1].scores[holeIndex];
    
    if (!s1 || !s2) return { winner: null, display: '' };
    
    if (s1 < s2) return { winner: 0, display: '●' };
    if (s2 < s1) return { winner: 1, display: '●' };
    return { winner: null, display: '–' }; // Halved
  };

  // Calculate match play standing
  const getMatchPlayStanding = (upToHoleIndex: number): string => {
    if (round.players.length !== 2) return '';
    
    let p1Wins = 0, p2Wins = 0;
    for (let i = 0; i <= upToHoleIndex; i++) {
      const s1 = round.players[0].scores[i];
      const s2 = round.players[1].scores[i];
      if (s1 > 0 && s2 > 0) {
        if (s1 < s2) p1Wins++;
        else if (s2 < s1) p2Wins++;
      }
    }
    
    if (p1Wins > p2Wins) return `P1 ${p1Wins - p2Wins}UP`;
    if (p2Wins > p1Wins) return `P2 ${p2Wins - p1Wins}UP`;
    return 'AS';
  };

  // Calculate totals for displayed holes only
  const getDisplayedPar = (): number => {
    return displayedHoleIndices.reduce((sum, i) => sum + (round.holes[i]?.par || getPar(i)), 0);
  };

  const getPlayerDisplayedTotal = (playerIndex: number): { score: number; par: number; holesPlayed: number } => {
    let score = 0, par = 0, holesPlayed = 0;
    for (const i of displayedHoleIndices) {
      const s = round.players[playerIndex].scores[i];
      if (s > 0) {
        score += s;
        par += round.holes[i]?.par || getPar(i);
        holesPlayed++;
      }
    }
    return { score, par, holesPlayed };
  };

  // Calculate handicap stroke allocation for match play
  const getHandicapStrokes = React.useMemo(() => {
    if (round.players.length !== 2) return { playerIndex: -1, holes: new Set<number>() };
    
    const p1 = round.players[0];
    const p2 = round.players[1];
    
    // Determine which player gets strokes (higher handicap)
    const p1Hcp = p1.handicap || 0;
    const p2Hcp = p2.handicap || 0;
    
    if (p1Hcp === p2Hcp) return { playerIndex: -1, holes: new Set<number>() };
    
    const higherHcpPlayer = p1Hcp > p2Hcp ? 0 : 1;
    const strokeDifference = Math.abs(p1Hcp - p2Hcp);
    
    // Get stroke indices for all holes and sort by difficulty (lowest index = hardest)
    // Use hole number as default stroke index when not available
    const holeStrokeIndices: Array<{ holeIndex: number; strokeIndex: number }> = [];
    for (let i = 0; i < round.holes.length; i++) {
      const hole = round.holes[i] as { strokeIndex?: number } | undefined;
      const strokeIndex = hole?.strokeIndex || (i + 1);
      holeStrokeIndices.push({ holeIndex: i, strokeIndex });
    }
    
    // Sort by stroke index (ascending - hardest first)
    holeStrokeIndices.sort((a, b) => a.strokeIndex - b.strokeIndex);
    
    // Allocate strokes to the hardest holes
    const strokeHoles = new Set<number>();
    for (let i = 0; i < strokeDifference && i < holeStrokeIndices.length; i++) {
      strokeHoles.add(holeStrokeIndices[i].holeIndex);
    }
    
    return { playerIndex: higherHcpPlayer, holes: strokeHoles };
  }, [round.players, round.holes]);

  const displayedPar = getDisplayedPar();
  const headerSize = compact ? 'text-[10px]' : 'text-xs';
  const rowHeight = compact ? 'h-8' : 'h-10';

  return (
    <div className={cn('w-full', className)}>
      {/* Tabs for Front/Back 9 selection */}
      {has18Holes && (
        <div className="mb-3">
          <Tabs value={selectedNine} onValueChange={(v) => setSelectedNine(v as NineSelection)}>
            <TabsList className="bg-white/10 w-full grid grid-cols-3">
              <TabsTrigger value="front" className="text-xs data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                Front 9
              </TabsTrigger>
              <TabsTrigger value="back" className="text-xs data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                Back 9
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                Stats
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Conditionally render Stats or Scoreboard */}
      {selectedNine === 'all' ? (
        /* Stats View */
        <div className="space-y-3">
          {round.players.map((player, playerIndex) => {
            const stats = calculatePlayerStats(playerIndex);
            const toPar = stats.score - (stats.holesPlayed > 0 ? round.holes.slice(0, stats.holesPlayed).reduce((sum, h) => sum + h.par, 0) : 0);
            
            return (
              <div key={player.playerId} className="bg-white/10 rounded-lg p-4 space-y-3">
                {/* Player Header */}
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback 
                      className={cn(
                        'text-sm font-medium',
                        playerIndex === 0 ? 'bg-blue-600 text-white' : 
                        playerIndex === 1 ? 'bg-red-600 text-white' : 
                        playerIndex === 2 ? 'bg-green-600 text-white' : 'bg-orange-600 text-white'
                      )}
                    >
                      {getPlayerInitials(player.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-semibold text-white">{player.name}</div>
                    <div className="text-sm text-purple-200">
                      {stats.holesPlayed} holes • Score: {stats.score} (
                      <span className={cn(toPar < 0 ? 'text-green-400' : toPar > 0 ? 'text-red-400' : 'text-white')}>
                        {toPar > 0 ? `+${toPar}` : toPar === 0 ? 'E' : toPar}
                      </span>)
                    </div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-200">Eagles:</span>
                      <span className="text-yellow-400 font-medium">{stats.eagles}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-200">Birdies:</span>
                      <span className="text-green-400 font-medium">{stats.birdies}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-200">Pars:</span>
                      <span className="text-white font-medium">{stats.pars}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-200">Bogeys:</span>
                      <span className="text-yellow-300 font-medium">{stats.bogeys}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-purple-200">Double+:</span>
                      <span className="text-red-400 font-medium">{stats.doubleBogeys}</span>
                    </div>
                  </div>
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10">
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">
                      {stats.fairwaysTotal > 0 ? 
                        Math.round((stats.fairwaysHit / stats.fairwaysTotal) * 100) : 0}%
                    </div>
                    <div className="text-xs text-purple-200">Fairways</div>
                    <div className="text-xs text-purple-300">
                      {stats.fairwaysHit}/{stats.fairwaysTotal}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">
                      {stats.greensTotal > 0 ? 
                        Math.round((stats.greensHit / stats.greensTotal) * 100) : 0}%
                    </div>
                    <div className="text-xs text-purple-200">Greens</div>
                    <div className="text-xs text-purple-300">
                      {stats.greensHit}/{stats.greensTotal}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">
                      {stats.averagePutts.toFixed(1)}
                    </div>
                    <div className="text-xs text-purple-200">Avg Putts</div>
                    <div className="text-xs text-purple-300">
                      {stats.totalPutts} total
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Scoreboard Grid - Full Width */
      <div className="w-full">
        {/* Header row: Hole numbers */}
        <div className={cn('flex items-center gap-0.5 mb-1', rowHeight)}>
          <div className={cn('w-10 shrink-0', headerSize, 'text-purple-300 font-medium')}>
            {/* Empty space for avatar */}
          </div>
          <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${displayedHoleIndices.length}, minmax(0, 1fr))` }}>
            {displayedHoleIndices.map((holeIndex) => (
              <div
                key={holeIndex}
                className={cn(
                  'flex items-center justify-center rounded h-full min-h-7',
                  headerSize,
                  'font-bold',
                  currentHoleIndex === holeIndex 
                    ? 'bg-yellow-500 text-black' 
                    : 'bg-white/10 text-purple-200'
                )}
              >
                {holeIndex + 1}
              </div>
            ))}
          </div>
          <div className={cn('w-8 shrink-0 flex items-center justify-center', headerSize, 'text-purple-300 font-bold')}>
            {selectedNine === 'front' ? 'OUT' : selectedNine === 'back' ? 'IN' : 'TOT'}
          </div>
          <div className={cn('w-8 shrink-0 flex items-center justify-center', headerSize, 'text-purple-300 font-bold')}>
            +/-
          </div>
        </div>

        {/* Par row */}
        <div className={cn('flex items-center gap-0.5 mb-1', rowHeight)}>
          <div className={cn('w-10 shrink-0 flex items-center justify-center', headerSize, 'text-purple-400 font-medium')}>Hole</div>
          <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${displayedHoleIndices.length}, minmax(0, 1fr))` }}>
            {displayedHoleIndices.map((holeIndex) => (
              <div
                key={holeIndex}
                className={cn(
                  'flex items-center justify-center rounded bg-white/5 h-full min-h-7',
                  headerSize,
                  'text-purple-300'
                )}
              >
                {round.holes[holeIndex]?.par || getPar(holeIndex)}
              </div>
            ))}
          </div>
          <div className={cn('w-8 shrink-0 flex items-center justify-center bg-white/5 rounded', headerSize, 'text-purple-300')}>
            {displayedPar}
          </div>
          <div className={cn('w-8 shrink-0 flex items-center justify-center bg-white/5 rounded', headerSize, 'text-purple-300')}>
            E
          </div>
        </div>

        {/* Player rows */}
        {round.players.map((player, playerIndex) => {
          const { score: totalScore, par: playedPar, holesPlayed } = getPlayerDisplayedTotal(playerIndex);
          const toPar = totalScore - playedPar;

          return (
            <div key={player.playerId} className={cn('flex items-center gap-0.5 mb-0.5', rowHeight)}>
              <div className="w-10 shrink-0 flex items-center justify-center">
                <Avatar className="h-7 w-7">
                  <AvatarFallback 
                    className={cn(
                      'text-xs font-medium',
                      playerIndex === 0 ? 'bg-blue-600 text-white' : 
                      playerIndex === 1 ? 'bg-red-600 text-white' : 
                      playerIndex === 2 ? 'bg-green-600 text-white' : 'bg-orange-600 text-white'
                    )}
                  >
                    {getPlayerInitials(player.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${displayedHoleIndices.length}, minmax(0, 1fr))` }}>
                {displayedHoleIndices.map((holeIndex) => {
                  const score = player.scores[holeIndex];
                  const par = round.holes[holeIndex]?.par || getPar(holeIndex);
                  const matchIndicator = getMatchPlayIndicator(holeIndex);
                  const hasHandicapStroke = getHandicapStrokes.playerIndex === playerIndex && getHandicapStrokes.holes.has(holeIndex);

                  return (
                    <div
                      key={holeIndex}
                      className={cn(
                        'flex items-center justify-center rounded relative h-full min-h-7',
                        currentHoleIndex === holeIndex ? 'ring-2 ring-yellow-400' : '',
                        getScoreBg(score, par),
                        score > 0 ? 'bg-white/10' : 'bg-white/5'
                      )}
                    >
                      <span className={cn(getScoreColor(score, par), headerSize)}>
                        {score > 0 ? score : '-'}
                      </span>
                      {/* Handicap stroke indicator */}
                      {hasHandicapStroke && (
                        <span className="absolute -bottom-0.5 -right-0.5 text-[6px] text-blue-400">●</span>
                      )}
                      {/* Match play indicator dot */}
                      {matchIndicator.winner === playerIndex && (
                        <span className="absolute -top-0.5 -right-0.5 text-[6px] text-green-400">●</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Total */}
              <div className={cn(
                'w-8 shrink-0 flex items-center justify-center rounded bg-white/10 font-bold',
                headerSize,
                playerIndex === 0 ? 'text-blue-300' : 
                playerIndex === 1 ? 'text-red-300' : 
                playerIndex === 2 ? 'text-green-300' : 'text-orange-300'
              )}>
                {holesPlayed > 0 ? totalScore : '-'}
              </div>
              {/* To Par */}
              <div className={cn(
                'w-8 shrink-0 flex items-center justify-center rounded bg-white/10 font-bold',
                headerSize,
                toPar < 0 ? 'text-green-400' : toPar > 0 ? 'text-red-400' : 'text-white'
              )}>
                {holesPlayed > 0 ? (toPar > 0 ? `+${toPar}` : toPar === 0 ? 'E' : toPar) : '-'}
              </div>
            </div>
          );
        })}

        {/* Match Play row (if 2 players) */}
        {round.players.length === 2 && (
          <div className={cn('flex items-center gap-0.5 mt-2 pt-2 border-t border-white/10', rowHeight)}>
            <div className={cn('w-16 sm:w-20 shrink-0', headerSize, 'text-yellow-400 font-medium')}>
              Match
            </div>
            <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${displayedHoleIndices.length}, minmax(0, 1fr))` }}>
              {displayedHoleIndices.map((holeIndex) => {
                const standing = getMatchPlayStanding(holeIndex);
                const s1 = round.players[0].scores[holeIndex];
                const s2 = round.players[1].scores[holeIndex];
                const hasScores = s1 > 0 && s2 > 0;

                return (
                  <div
                    key={holeIndex}
                    className={cn(
                      'flex items-center justify-center rounded bg-white/5 h-full min-h-7',
                      headerSize,
                      currentHoleIndex === holeIndex ? 'ring-1 ring-yellow-400' : '',
                      standing.startsWith('P1') ? 'text-blue-300' :
                      standing.startsWith('P2') ? 'text-red-300' : 'text-gray-400'
                    )}
                  >
                    {hasScores ? (
                      standing === 'AS' ? '–' : standing.replace('P1 ', '').replace('P2 ', '')
                    ) : ''}
                  </div>
                );
              })}
            </div>
            <div className={cn('w-10 sm:w-12 shrink-0 flex items-center justify-center bg-yellow-500/20 rounded', headerSize, 'text-yellow-300 font-bold')}>
              {getMatchPlayStanding(displayedHoleIndices[displayedHoleIndices.length - 1])}
            </div>
            <div className={cn('w-10 sm:w-12 shrink-0')}></div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default Scoreboard;
