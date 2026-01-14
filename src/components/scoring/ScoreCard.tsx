import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { HoleScore, GolfRound, PlayerInRound, MissDepth, MissSide } from '@/lib/golf/types';
import { useRoundPersistence } from '@/hooks/useRoundPersistence';
import { Scoreboard } from './Scoreboard';
import { 
  Save, 
  Share2, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  XCircle,
  Plus,
  Receipt,
} from 'lucide-react';
import { snakeEngine } from '@/lib/golf/snakeEngine';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { CostSplitDialog } from '@/components/golf/CostSplitDialog';
import type { Expense } from '@/lib/golf/expenseTypes';

interface ScoreCardProps {
  round: GolfRound;
  course?: { 
    holes: { [hole: number]: number };
    sections?: { [sectionIndex: number]: string };
  } | null; // Course par data
  onUpdateRound: (round: GolfRound) => void;
  onSaveRound: () => void;
  onShareRound?: () => void;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({
  round,
  course,
  onUpdateRound,
  onSaveRound,
  onShareRound
}) => {
  const [currentHole, setCurrentHole] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [activeTab, setActiveTab] = useState<'score' | 'others'>('score');
  const [expandedPutts, setExpandedPutts] = useState(false);
  const [expandedChips, setExpandedChips] = useState(false);
  const [expandedSand, setExpandedSand] = useState(false);
  const [expandedPenalties, setExpandedPenalties] = useState(false);
  const [manualInput, setManualInput] = useState<{ field: string; value: string }>({ field: '', value: '' });
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showCostSplit, setShowCostSplit] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const isMobile = useIsMobile();

  // Helper function to get section name for current hole
  const getCurrentSectionName = (): string | null => {
    if (!course?.sections) return null;
    
    const holeNumber = currentHole + 1;
    const sectionIndex = Math.floor((holeNumber - 1) / 9);
    return course.sections[sectionIndex] || null;
  };

  
  
  const { saveRound: persistRound } = useRoundPersistence(round.id || 'current-round');

  const currentHoleData = round.holes[currentHole];
  const player = round.players[currentPlayer];
  const [playerDisplayMode, setPlayerDisplayMode] = useState<'total' | 'strokes'>('total');

  const getPlayerInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };


  // Helper: get per-player per-hole details (falls back to hole-level values)
  const getPlayerHoleDetails = (playerIndex: number, holeIndex: number) => {
    const hole = round.holes?.[holeIndex] || { holeNumber: holeIndex + 1, par: 4 } as HoleScore;
    const p = round.players[playerIndex];
    const details = p.holeDetails?.[holeIndex] || {};

    return {
      strokes: p.scores?.[holeIndex] ?? 0,
      putts: details.putts ?? hole.putts ?? 0,
      fairways: details.fairways ?? null,
      fairwayMissDepth: (details.fairwayMissDepth as MissDepth) ?? null,
      fairwayMissSide: (details.fairwayMissSide as MissSide) ?? null,
      greens: details.greens ?? null,
      greenMissDepth: (details.greenMissDepth as MissDepth) ?? null,
      greenMissSide: (details.greenMissSide as MissSide) ?? null,
      chips: details.chips ?? hole.chips ?? 0,
      sandTraps: details.sandTraps ?? hole.sandTraps ?? 0,
      penalties: details.penalties ?? hole.penalties ?? 0,
      notes: details.notes ?? hole.notes ?? '' ,
      par: hole.par
    };
  };

  const currentPlayerHole = getPlayerHoleDetails(currentPlayer, currentHole);

  // Given a player's handicap and a hole's stroke index (1..18), calculate how many
  // handicap strokes are allocated to that hole according to standard rules:
  // base = floor(hcp/18), remainder = hcp % 18, additional stroke on holes with
  // strokeIndex <= remainder.
  const strokesGivenForHole = (handicap: number, holeStrokeIndex: number) => {
    if (!handicap || handicap <= 0) return 0;
    const base = Math.floor(handicap / 18);
    const remainder = handicap % 18;
    return base + (holeStrokeIndex <= remainder ? 1 : 0);
  };

  // Compute totals (gross and net) for a single player using per-hole handicap allocation
  // Determine a hole's stroke index using a provided round object (makes the helper pure)
  const getHoleStrokeIndexForRound = React.useCallback((r: GolfRound, holeIndex: number) => {
    const hole = r.holes?.[holeIndex];
    const holeNumber = hole?.holeNumber ?? holeIndex + 1;

    if (hasStrokeIndexProp(hole)) return hole.strokeIndex;

    const courseHole: unknown = course && (course.holes as unknown) ? (course.holes as unknown as Record<number, unknown>)[holeNumber] : undefined;
    if (hasStrokeIndexProp(courseHole)) return courseHole.strokeIndex;

    return holeNumber;
  }, [course]);

  // Compute totals (gross and net) for a single player using per-hole handicap allocation
  const computePlayerTotals = React.useCallback((player: PlayerInRound, r: GolfRound) => {
    let total = 0;
    let netTotal = 0;

    // Calculate handicap stroke allocation for match play
    let handicapStrokesGiven = 0;
    if (r.players.length === 2) {
      const p1 = r.players[0];
      const p2 = r.players[1];
      const p1Hcp = p1.handicap || 0;
      const p2Hcp = p2.handicap || 0;
      
      // Only the higher handicap player gets strokes
      const isHigherHandicap = player.handicap > (p1.playerId === player.playerId ? p2Hcp : p1Hcp);
      if (isHigherHandicap) {
        const strokeDifference = Math.abs(p1Hcp - p2Hcp);
        handicapStrokesGiven = strokeDifference;
      }
    }

    r.holes?.forEach((hole, holeIndex) => {
      const strokes = (player.scores?.[holeIndex] ?? 0) as number;
      if (strokes > 0) {
        total += strokes;
        const strokeIdx = getHoleStrokeIndexForRound(r, holeIndex);
        const given = handicapStrokesGiven > 0 ? strokesGivenForHole(handicapStrokesGiven, strokeIdx) : 0;
        netTotal += (strokes - given);
      }
    });

    return { total, netTotal };
  }, [getHoleStrokeIndexForRound]);

  // Recompute totals for all players in the round and update their fields
  const computeTotalsInRound = React.useCallback((r: GolfRound) => {
    r.players = r.players.map((p) => {
      const { total, netTotal } = computePlayerTotals(p, r);
      return {
        ...p,
        total,
        netTotal
      };
    });
  }, [computePlayerTotals]);


  // Cycle display under avatars between total and current hole strokes every 6s
  React.useEffect(() => {
    const id = setInterval(() => {
      setPlayerDisplayMode(prev => prev === 'total' ? 'strokes' : 'total');
    }, 6000);
    return () => clearInterval(id);
  }, []);

  // Ensure the page loads scrolled to top when this component mounts
  React.useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch {
      // ignore in non-browser environments
    }
  }, []);

  // Calculate current snake holder for Snake game mode
  const getCurrentSnakeHolder = (): string | null => {
    // Support both single gameMode and gameModes array
    const hasSnakeMode = round.gameMode === 'snake' || round.gameModes?.includes('snake');
    if (!hasSnakeMode) return null;

    // Build per-player putts data from player's holeDetails (fall back to hole-level if present)
    const putts: { [playerId: string]: { [hole: number]: number } } = {};
    round.players.forEach((player) => {
      putts[player.playerId] = {};
      round.holes.forEach((hole, holeIndex) => {
        if (holeIndex <= currentHole) {
          const playerHoleDetails = player.holeDetails?.[holeIndex];
          const pPutts = (playerHoleDetails && typeof playerHoleDetails.putts === 'number')
            ? playerHoleDetails.putts
            : (typeof hole.putts === 'number' ? hole.putts : 0);
          putts[player.playerId][hole.holeNumber] = pPutts;
        }
      });
    });

    // Create snake data structure
    const snakeData = {
      players: round.players.map(p => p.playerId),
      strokes: round.players.reduce((acc, player) => {
        acc[player.playerId] = {};
        round.holes.forEach((hole, holeIndex) => {
          if (holeIndex <= currentHole && player.scores[holeIndex] > 0) {
            acc[player.playerId][hole.holeNumber] = player.scores[holeIndex];
          }
        });
        return acc;
      }, {} as { [playerId: string]: { [hole: number]: number } }),
      course: {
        holes: round.holes.reduce((acc, hole) => {
          acc[hole.holeNumber] = { par: hole.par, strokeIndex: hole.holeNumber };
          return acc;
        }, {} as { [hole: number]: { par: number; strokeIndex: number } })
      },
      putts
    };
    
    // Calculate snake result up to current hole
    const result = snakeEngine(snakeData);
    
    // Return the snake holder for the most recent hole with data
    if (result.holeByHole.length === 0) return null;
    
    const lastHole = result.holeByHole[result.holeByHole.length - 1];
    return lastHole.snakeHolder;
  };

  // Initialize holes with proper structure if needed
  React.useEffect(() => {
    if (!round.holes || round.holes.length === 0) {
      // Determine number of holes from course data, default to 18
      const numberOfHoles = course?.holes ? Math.max(...Object.keys(course.holes).map(Number)) : 18;
      
      const initialHoles: HoleScore[] = Array.from({ length: numberOfHoles }, (_, i) => {
        const holeNumber = i + 1;
        // Use course par data if available, otherwise default to par 4
        const par = course?.holes?.[holeNumber] || 4;
        
        return {
          holeNumber,
          par,
          strokes: 0,
          putts: 0,
          fairways: false,
          greens: false,
          chips: 0,
          sandTraps: 0,
          penalties: 0,
          notes: ''
        };
      });

      const updatedRound = {
        ...round,
        holes: initialHoles,
        players: round.players.map(player => ({
          ...player,
          scores: Array(numberOfHoles).fill(0)
        }))
      };
      
      // Compute initial totals for each player
      computeTotalsInRound(updatedRound);

      onUpdateRound(updatedRound);
    }
  }, [round, course, onUpdateRound, computeTotalsInRound]);

  const updateScore = (field: keyof HoleScore, value: unknown) => {
    const updatedRound = { ...round };

    // Ensure holes array exists (metadata defaults only)
    if (!updatedRound.holes) {
      updatedRound.holes = Array.from({ length: 18 }, (_, i) => ({
        holeNumber: i + 1,
        par: 4,
        strokes: 0,
        putts: 0,
        fairways: false,
        greens: false,
        chips: 0,
        sandTraps: 0,
        penalties: 0,
        notes: ''
      }));
    }

    // Update player scores array when strokes change
    if (field === 'strokes' && typeof value === 'number') {
      updatedRound.players = updatedRound.players.map((p, index) => {
        if (index === currentPlayer) {
          const newScores = [...p.scores];
          newScores[currentHole] = value;

          // Calculate totals using proper handicap allocation
          const { total, netTotal } = computePlayerTotals({ ...p, scores: newScores }, updatedRound);

          return {
            ...p,
            scores: newScores,
            total,
            netTotal
          };
        }
        return p;
      });
    } else {
      // For non-stroke fields, store them in the player's per-hole details so
      // stats are independent per player (putts, fairways, greens, chips, etc.)
      updatedRound.players = updatedRound.players.map((p, index) => {
        if (index === currentPlayer) {
          const holeDetails = { ...(p.holeDetails || {}) } as Record<number, Record<string, unknown>>;
          const hd = { ...(holeDetails[currentHole] || {}) } as Record<string, unknown>;
          hd[field as string] = value as unknown;

          // When setting fairways to true (Hit), also clear miss direction fields
          if (field === 'fairways' && value === true) {
            hd['fairwayMissDepth'] = null;
            hd['fairwayMissSide'] = null;
          }
          // When setting greens to true (Hit) or 'unreachable', also clear miss direction fields
          if (field === 'greens' && (value === true || value === 'unreachable')) {
            hd['greenMissDepth'] = null;
            hd['greenMissSide'] = null;
          }

          holeDetails[currentHole] = hd;

          return {
            ...p,
            holeDetails
          };
        }
        return p;
      });
    }

    // Recompute totals (gross/net) for all players after the update
    computeTotalsInRound(updatedRound);

    // Auto-save to localStorage
    persistRound(updatedRound);

    onUpdateRound(updatedRound);
  };



  const getScoreColor = (strokes: number, par: number) => {
    const diff = strokes - par;
    if (diff <= -2) return 'text-green-400'; // Eagle or better
    if (diff === -1) return 'text-green-300'; // Birdie
    if (diff === 0) return 'text-white'; // Par
    if (diff === 1) return 'text-yellow-300'; // Bogey
    return 'text-red-400'; // Double bogey or worse
  };

  const getScoreName = (strokes: number, par: number) => {
    const diff = strokes - par;
    if (diff <= -3) return 'Albatross';
    if (diff === -2) return 'Eagle';
    if (diff === -1) return 'Birdie';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double Bogey';
    return 'Triple+';
  };

  // Helper: detect objects that include a numeric strokeIndex property
  const hasStrokeIndexProp = (v: unknown): v is { strokeIndex: number } => {
    if (typeof v !== 'object' || v === null) return false;
    const maybe = v as Record<string, unknown>;
    return typeof maybe.strokeIndex === 'number';
  };

  // (old getHoleStrokeIndex removed; using getHoleStrokeIndexForRound instead)


  // Calculate round statistics for current player
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

        // Score tracking
        if (diff <= -2) stats.eagles++;
        else if (diff === -1) stats.birdies++;
        else if (diff === 0) stats.pars++;
        else if (diff === 1) stats.bogeys++;
        else if (diff >= 2) stats.doubleBogeys++;

        // Fairway stats (exclude par 3s) - use per-player details first
        if (hole.par > 3) {
          stats.fairwaysTotal++;
          const pHole = player.holeDetails?.[holeIndex];
          if (pHole?.fairways) stats.fairwaysHit++;
        }

        // Green stats - per-player
        stats.greensTotal++;
        const pHole2 = player.holeDetails?.[holeIndex];
        if (pHole2?.greens) stats.greensHit++;

        // Putt stats - per-player then hole-level
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

  const currentPlayerStats = calculatePlayerStats(currentPlayer);

  const nextHole = () => {
    if (currentHole < round.holes.length - 1) {
      setCurrentHole(currentHole + 1);
    }
  };

  const prevHole = () => {
    if (currentHole > 0) {
      setCurrentHole(currentHole - 1);
    }
  };

  // Swipe gesture handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      nextHole();
    } else if (isRightSwipe) {
      prevHole();
    }
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 text-white"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header with hole info and navigation */}
      <div className="flex items-center justify-between p-4 bg-black/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={prevHole}
          disabled={currentHole === 0}
          className="text-white hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="text-center">
          <div className={cn(isMobile ? "text-xl" : "text-2xl", "font-bold")}>Hole {currentHoleData?.holeNumber ?? (currentHole + 1)}</div>
          <div className="text-sm text-purple-200">Par {currentHoleData?.par || course?.holes?.[currentHole + 1] || 4}</div>
          <div className="text-xs text-purple-300">
            {(() => {
              const sectionName = getCurrentSectionName();
              const courseName = round.metadata?.courseName;
              if (courseName && sectionName) {
                return `${courseName} - ${sectionName.toUpperCase()}`;
              }
              return courseName || 'Unknown Course';
            })()}
          </div>
          
          {/* Show current player's score if they've entered it */}
          {player.scores[currentHole] > 0 && (
            <div className="mt-1">
              <span className={cn(
                "text-lg font-bold",
                getScoreColor(player.scores[currentHole], currentHoleData?.par || course?.holes?.[currentHole + 1] || 4)
              )}>
                {player.scores[currentHole]}
              </span>
              <span className="text-xs text-purple-300 ml-1">
                ({getScoreName(player.scores[currentHole], currentHoleData?.par || course?.holes?.[currentHole + 1] || 4)})
              </span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={nextHole}
          disabled={currentHole === round.holes.length - 1}
          className="text-white hover:bg-white/10"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Player selector */}
      <div className="flex justify-center px-4 py-2 bg-black/10">
        <div className={cn("flex", isMobile ? "space-x-2" : "space-x-4")}>
          {round.players.map((p, index) => {
            const currentSnakeHolder = getCurrentSnakeHolder();
            const hasSnake = currentSnakeHolder === p.playerId;
            const hasSnakeMode = round.gameMode === 'snake' || round.gameModes?.includes('snake');
            const playerHasThreePutt = !!Object.values(p.holeDetails || {}).some((hd: unknown) => {
              const h = hd as Record<string, unknown> | undefined;
              const putts = h && typeof h.putts === 'number' ? (h.putts as number) : 0;
              return putts >= 3;
            });
            
            return (
              <button
                key={p.playerId}
                onClick={() => setCurrentPlayer(index)}
                className={cn(
                  "flex flex-col items-center space-y-1 transition-all relative",
                  currentPlayer === index ? "opacity-100" : "opacity-60 hover:opacity-80"
                )}
              >
                <div className="relative">
                  <Avatar className={cn(
                    isMobile ? "h-10 w-10" : "h-12 w-12",
                    "border-2 transition-all",
                    currentPlayer === index 
                      ? "border-yellow-400 shadow-lg shadow-yellow-400/25" 
                      : "border-purple-300"
                  )}>
                    <AvatarFallback className="bg-purple-600 text-white">
                      {getPlayerInitials(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  {(hasSnake || (hasSnakeMode && playerHasThreePutt)) && (
                    <div className="absolute -bottom-1 -right-1 text-base drop-shadow-lg">
                      🐍
                    </div>
                  )}
                </div>
                <div className="text-xs text-center">
                  <div className="font-medium">
                    {p.name.split(' ')[0]}
                  </div>
                  <div className="text-purple-200">
                    {playerDisplayMode === 'total' ? (p.total || '-') : (p.scores[currentHole] || '-')}
                  </div>
                </div>
              </button>
            );
          })}
          
          <button className="flex flex-col items-center space-y-1 opacity-60 hover:opacity-80">
            <div className={cn(
              "border-2 border-dashed border-purple-300 rounded-full flex items-center justify-center",
              isMobile ? "h-10 w-10" : "h-12 w-12"
            )}>
              <Plus className={cn(isMobile ? "h-5 w-5" : "h-6 w-6", "text-purple-300")} />
            </div>
            <div className="text-xs text-purple-300">Add Player</div>
          </button>
        </div>
      </div>


      {/* Main scoring area */}
      <div className={cn("flex-1", isMobile ? "p-2" : "p-4")}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'score' | 'others')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-black/20 border-purple-400/20">
            <TabsTrigger 
              value="score" 
              className="text-white data-[state=active]:bg-yellow-500 data-[state=active]:text-black"
            >
              Scoring
            </TabsTrigger>
            <TabsTrigger 
              value="others" 
              className="text-white data-[state=active]:bg-yellow-500 data-[state=active]:text-black"
            >
              Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="score" className="space-y-6">
            {/* Score buttons */}
            <div className="space-y-4">
              <div className={cn("grid gap-3", isMobile ? "grid-cols-4" : "grid-cols-3")}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((score) => {
                  const isPar = score === (currentHoleData?.par || course?.holes?.[currentHole + 1] || 4);
                  const currentScore = player?.scores[currentHole];
                  const isSelected = currentScore === score;
                  
                  return (
                    <Button
                      key={score}
                      onClick={() => updateScore('strokes', score)}
                      className={cn(
                        "h-16 text-xl font-bold transition-all",
                        isSelected ? "bg-yellow-500 hover:bg-yellow-400 text-black border-2 border-yellow-700" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      {score}
                      {isPar && <div className="text-xs text-purple-200">Par</div>}
                    </Button>
                  );
                })}
              </div>
              
              {/* 10+ button or manual input */}
              {manualInput.field === 'strokes' ? (
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={manualInput.value}
                    onChange={(e) => setManualInput({ field: 'strokes', value: e.target.value })}
                    className="flex-1 h-12 bg-white/10 border-purple-300 text-white"
                    placeholder="Enter score"
                    autoFocus
                  />
                  <Button
                    onClick={() => {
                      if (manualInput.value && parseInt(manualInput.value) > 0) {
                        updateScore('strokes', parseInt(manualInput.value));
                      }
                      setManualInput({ field: '', value: '' });
                    }}
                    className="h-12 px-4 bg-green-600 hover:bg-green-700"
                  >
                    ✓
                  </Button>
                  <Button
                    onClick={() => setManualInput({ field: '', value: '' })}
                    className="h-12 px-4 bg-red-600 hover:bg-red-700"
                  >
                    ✗
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setManualInput({ field: 'strokes', value: '' })}
                  className="flex-1 h-12 bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                >
                  <div className="text-center">
                    <div className="text-sm font-bold">10+</div>
                    <div className="text-xs">Tap to enter manually</div>
                  </div>
                </Button>
              )}
            </div>

            {/* Putts */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Putts</h3>
              <div className="space-y-2">
                {/* First row: 0-3 and 4+ button */}
                <div className="flex space-x-3">
                  {[0, 1, 2, 3].map((putts) => (
                    <Button
                      key={putts}
                      onClick={() => {
                        updateScore('putts', putts);
                        setExpandedPutts(false);
                      }}
                      className={cn(
                        "flex-1 h-12 transition-all",
                        (currentPlayerHole?.putts || 0) === putts ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      {putts}
                    </Button>
                  ))}
                  <Button
                    onClick={() => {
                      if (!expandedPutts) {
                        setExpandedPutts(true);
                      } else {
                        updateScore('putts', 4);
                        setExpandedPutts(false);
                      }
                    }}
                    className={cn(
                      "flex-1 h-12 transition-all",
                      (currentPlayerHole?.putts || 0) >= 4 ? 
                      "bg-purple-500 text-white border-2 border-yellow-400" :
                      "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                    )}
                  >
                          {(currentPlayerHole?.putts || 0) >= 4 ? (currentPlayerHole?.putts || 4) : (expandedPutts ? '4' : '4+')}
                  </Button>
                </div>
                
                {/* Second row: 5-9 (only shown when expanded) */}
                {expandedPutts && (
                  <div className="flex space-x-3">
                    {[5, 6, 7, 8, 9].map((putts) => (
                      <Button
                        key={putts}
                        onClick={() => {
                          updateScore('putts', putts);
                          setExpandedPutts(false);
                        }}
                        className={cn(
                          "flex-1 h-12 transition-all",
                          (currentPlayerHole?.putts || 0) === putts ? 
                          "bg-purple-500 text-white border-2 border-yellow-400" :
                          "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                        )}
                      >
                        {putts}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Fairway Hit */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Fairway Hit</h3>
              <div className="flex space-x-4">
                <Button
                  onClick={() => updateScore('fairways', true)}
                  className={cn(
                    "flex-1 h-12 flex items-center justify-center space-x-2",
                    currentPlayerHole?.fairways === true ? 
                    "bg-green-500 hover:bg-green-400 text-white" :
                    "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                  )}
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>Hit</span>
                </Button>
                <Button
                  onClick={() => updateScore('fairways', false)}
                  className={cn(
                    "flex-1 h-12 flex items-center justify-center space-x-2",
                    currentPlayerHole?.fairways === false ? 
                    "bg-red-500 hover:bg-red-400 text-white" :
                    "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                  )}
                >
                  <XCircle className="h-5 w-5" />
                  <span>Miss</span>
                </Button>
              </div>
              {/* Fairway Miss Direction Buttons */}
              {currentPlayerHole?.fairways === false && (
                <div className="space-y-2 pt-2">
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => updateScore('fairwayMissDepth', currentPlayerHole?.fairwayMissDepth === 'long' ? null : 'long')}
                      className={cn(
                        "flex-1 h-10 text-sm",
                        currentPlayerHole?.fairwayMissDepth === 'long' ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      Long
                    </Button>
                    <Button
                      onClick={() => updateScore('fairwayMissDepth', currentPlayerHole?.fairwayMissDepth === 'short' ? null : 'short')}
                      className={cn(
                        "flex-1 h-10 text-sm",
                        currentPlayerHole?.fairwayMissDepth === 'short' ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      Short
                    </Button>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => updateScore('fairwayMissSide', currentPlayerHole?.fairwayMissSide === 'left' ? null : 'left')}
                      className={cn(
                        "flex-1 h-10 text-sm",
                        currentPlayerHole?.fairwayMissSide === 'left' ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      Left
                    </Button>
                    <Button
                      onClick={() => updateScore('fairwayMissSide', currentPlayerHole?.fairwayMissSide === 'right' ? null : 'right')}
                      className={cn(
                        "flex-1 h-10 text-sm",
                        currentPlayerHole?.fairwayMissSide === 'right' ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      Right
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Greens in Regulation */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Greens in Regulation</h3>
              <div className="flex space-x-4">
                <Button
                  onClick={() => updateScore('greens', true)}
                  className={cn(
                    "flex-1 h-12 flex items-center justify-center space-x-2",
                    currentPlayerHole?.greens === true ? 
                    "bg-green-500 hover:bg-green-400 text-white" :
                    "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                  )}
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>Hit</span>
                </Button>
                <Button
                  onClick={() => updateScore('greens', false)}
                  className={cn(
                    "flex-1 h-12 flex items-center justify-center space-x-2",
                    (currentPlayerHole?.greens === false || currentPlayerHole?.greens === 'unreachable') ? 
                    "bg-red-500 hover:bg-red-400 text-white" :
                    "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                  )}
                >
                  <XCircle className="h-5 w-5" />
                  <span>Miss</span>
                </Button>
              </div>
              {/* Green Miss Direction Buttons */}
              {currentPlayerHole?.greens === false && (
                <div className="space-y-2 pt-2">
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => updateScore('greenMissDepth', currentPlayerHole?.greenMissDepth === 'long' ? null : 'long')}
                      className={cn(
                        "flex-1 h-10 text-sm",
                        currentPlayerHole?.greenMissDepth === 'long' ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      Long
                    </Button>
                    <Button
                      onClick={() => updateScore('greenMissDepth', currentPlayerHole?.greenMissDepth === 'short' ? null : 'short')}
                      className={cn(
                        "flex-1 h-10 text-sm",
                        currentPlayerHole?.greenMissDepth === 'short' ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      Short
                    </Button>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => updateScore('greenMissSide', currentPlayerHole?.greenMissSide === 'left' ? null : 'left')}
                      className={cn(
                        "flex-1 h-10 text-sm",
                        currentPlayerHole?.greenMissSide === 'left' ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      Left
                    </Button>
                    <Button
                      onClick={() => updateScore('greenMissSide', currentPlayerHole?.greenMissSide === 'right' ? null : 'right')}
                      className={cn(
                        "flex-1 h-10 text-sm",
                        currentPlayerHole?.greenMissSide === 'right' ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      Right
                    </Button>
                  </div>
                </div>
              )}
              {/* Unreachable Button - only shown when Miss is selected or when Unreachable is already selected */}
              {(currentPlayerHole?.greens === false || currentPlayerHole?.greens === 'unreachable') && (
                <Button
                  onClick={() => updateScore('greens', 'unreachable')}
                  className={cn(
                    "w-full h-10 text-sm mt-2",
                    currentPlayerHole?.greens === 'unreachable' ? 
                    "bg-purple-500 text-white border-2 border-yellow-400" :
                    "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                  )}
                >
                  Unreachable
                </Button>
              )}
            </div>

            {/* Penalties */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Penalties</h3>
              <div className="space-y-2">
                {/* First row: 0-3 and 4+ button */}
                <div className="flex space-x-3">
                  {[0, 1, 2, 3].map((penalty) => (
                    <Button
                      key={penalty}
                      onClick={() => {
                        updateScore('penalties', penalty);
                        setExpandedPenalties(false);
                      }}
                      className={cn(
                        "flex-1 h-12 transition-all",
                        (currentPlayerHole?.penalties || 0) === penalty ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      {penalty}
                    </Button>
                  ))}
                  <Button
                    onClick={() => {
                      if (!expandedPenalties) {
                        setExpandedPenalties(true);
                      } else {
                        updateScore('penalties', 4);
                        setExpandedPenalties(false);
                      }
                    }}
                    className={cn(
                      "flex-1 h-12 transition-all",
                      (currentPlayerHole?.penalties || 0) >= 4 ? 
                      "bg-purple-500 text-white border-2 border-yellow-400" :
                      "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                    )}
                  >
                    {(currentPlayerHole?.penalties || 0) >= 4 ? (currentPlayerHole?.penalties || 4) : (expandedPenalties ? '4' : '4+')}
                  </Button>
                </div>
                
                {/* Second row: 5-9 (only shown when expanded) */}
                {expandedPenalties && (
                  <div className="flex space-x-3">
                    {[5, 6, 7, 8, 9].map((penalty) => (
                      <Button
                        key={penalty}
                        onClick={() => {
                          updateScore('penalties', penalty);
                          setExpandedPenalties(false);
                        }}
                        className={cn(
                          "flex-1 h-12 transition-all",
                              (currentPlayerHole?.penalties || 0) === penalty ? 
                          "bg-purple-500 text-white border-2 border-yellow-400" :
                          "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                        )}
                      >
                        {penalty}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chip Shots */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Chip Shots</h3>
              <div className="space-y-2">
                {/* First row: 0-3 and 4+ button */}
                <div className="flex space-x-3">
                  {[0, 1, 2, 3].map((chips) => (
                    <Button
                      key={chips}
                      onClick={() => {
                        updateScore('chips', chips);
                        setExpandedChips(false);
                      }}
                      className={cn(
                        "flex-1 h-12 transition-all",
                        (currentPlayerHole?.chips || 0) === chips ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      {chips}
                    </Button>
                  ))}
                  <Button
                    onClick={() => {
                      if (!expandedChips) {
                        setExpandedChips(true);
                      } else {
                        updateScore('chips', 4);
                        setExpandedChips(false);
                      }
                    }}
                    className={cn(
                      "flex-1 h-12 transition-all",
                      (currentPlayerHole?.chips || 0) >= 4 ? 
                      "bg-purple-500 text-white border-2 border-yellow-400" :
                      "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                    )}
                  >
                    {(currentPlayerHole?.chips || 0) >= 4 ? (currentPlayerHole?.chips || 4) : (expandedChips ? '4' : '4+')}
                  </Button>
                </div>
                
                {/* Second row: 5-9 (only shown when expanded) */}
                {expandedChips && (
                  <div className="flex space-x-3">
                    {[5, 6, 7, 8, 9].map((chips) => (
                      <Button
                        key={chips}
                        onClick={() => {
                          updateScore('chips', chips);
                          setExpandedChips(false);
                        }}
                        className={cn(
                          "flex-1 h-12 transition-all",
                          (currentPlayerHole?.chips || 0) === chips ? 
                          "bg-purple-500 text-white border-2 border-yellow-400" :
                          "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                        )}
                      >
                        {chips}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Greenside Sand Shots */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Bunker Shots</h3>
              <div className="space-y-2">
                {/* First row: 0-3 and 4+ button */}
                <div className="flex space-x-3">
                  {[0, 1, 2, 3].map((sand) => (
                    <Button
                      key={sand}
                      onClick={() => {
                        updateScore('sandTraps', sand);
                        setExpandedSand(false);
                      }}
                      className={cn(
                        "flex-1 h-12 transition-all",
                        (currentPlayerHole?.sandTraps || 0) === sand ? 
                        "bg-purple-500 text-white border-2 border-yellow-400" :
                        "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                      )}
                    >
                      {sand}
                    </Button>
                  ))}
                  <Button
                    onClick={() => {
                      if (!expandedSand) {
                        setExpandedSand(true);
                      } else {
                        updateScore('sandTraps', 4);
                        setExpandedSand(false);
                      }
                    }}
                    className={cn(
                      "flex-1 h-12 transition-all",
                      (currentPlayerHole?.sandTraps || 0) >= 4 ? 
                      "bg-purple-500 text-white border-2 border-yellow-400" :
                      "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                    )}
                  >
                    {(currentPlayerHole?.sandTraps || 0) >= 4 ? (currentPlayerHole?.sandTraps || 4) : (expandedSand ? '4' : '4+')}
                  </Button>
                </div>
                
                {/* Second row: 5-9 (only shown when expanded) */}
                {expandedSand && (
                  <div className="flex space-x-3">
                    {[5, 6, 7, 8, 9].map((sand) => (
                      <Button
                        key={sand}
                        onClick={() => {
                          updateScore('sandTraps', sand);
                          setExpandedSand(false);
                        }}
                        className={cn(
                          "flex-1 h-12 transition-all",
                          (currentPlayerHole?.sandTraps || 0) === sand ? 
                          "bg-purple-500 text-white border-2 border-yellow-400" :
                          "bg-white/10 hover:bg-white/20 text-white border border-purple-300"
                        )}
                      >
                        {sand}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="others" className="space-y-4">
            {/* Full Scoreboard */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-purple-200 mb-2">Scoreboard</h4>
              <Scoreboard
                round={round}
                course={course}
                currentHoleIndex={currentHole}
                compact
                className="bg-black/20 p-3 rounded-lg"
              />
            </div>

            {/* Other players' scores for this hole */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-purple-200">This Hole</h4>
              {round.players.filter((_, index) => index !== currentPlayer).map((p, _index) => (
                <div key={p.playerId} className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-purple-600 text-white text-sm">
                        {getPlayerInitials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <div className="text-lg font-bold">
                    {p.scores[currentHole] || '-'}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Round Statistics */}
      {currentPlayerStats.holesPlayed > 0 && (
        <div className="p-4 bg-black/20 space-y-4">
          <h3 className="text-lg font-semibold text-white">Round Statistics</h3>
          
          {/* Score Breakdown */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-purple-200">Eagles:</span>
                <span className="text-green-400 font-medium">{currentPlayerStats.eagles}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-purple-200">Birdies:</span>
                <span className="text-green-300 font-medium">{currentPlayerStats.birdies}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-purple-200">Pars:</span>
                <span className="text-white font-medium">{currentPlayerStats.pars}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-purple-200">Bogeys:</span>
                <span className="text-yellow-300 font-medium">{currentPlayerStats.bogeys}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-purple-200">Double+:</span>
                <span className="text-red-400 font-medium">{currentPlayerStats.doubleBogeys}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-purple-200">Total Score:</span>
                <span className="text-white font-bold">{currentPlayerStats.score}</span>
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="grid grid-cols-3 gap-4 p-3 bg-white/10 rounded-lg">
            <div className="text-center">
              <div className="text-lg font-bold text-white">
                {currentPlayerStats.fairwaysTotal > 0 ? 
                  Math.round((currentPlayerStats.fairwaysHit / currentPlayerStats.fairwaysTotal) * 100) : 0}%
              </div>
              <div className="text-xs text-purple-200">Fairways</div>
              <div className="text-xs text-purple-300">
                {currentPlayerStats.fairwaysHit}/{currentPlayerStats.fairwaysTotal}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-white">
                {currentPlayerStats.greensTotal > 0 ? 
                  Math.round((currentPlayerStats.greensHit / currentPlayerStats.greensTotal) * 100) : 0}%
              </div>
              <div className="text-xs text-purple-200">Greens</div>
              <div className="text-xs text-purple-300">
                {currentPlayerStats.greensHit}/{currentPlayerStats.greensTotal}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-white">
                {currentPlayerStats.averagePutts.toFixed(1)}
              </div>
              <div className="text-xs text-purple-200">Avg Putts</div>
              <div className="text-xs text-purple-300">
                {currentPlayerStats.totalPutts} total
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation */}
      <div className="p-4 bg-black/20 space-y-3">
        <div className="flex items-center justify-between p-3 bg-yellow-500 text-black rounded-lg font-medium">
          <div className="flex items-center space-x-3 min-w-0">
            <span className="text-sm font-semibold truncate">Hole {currentHole + 1} of {round.holes.length}</span>
            <span className="text-yellow-800">•</span>
            <span className="text-sm truncate">{player.name}</span>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              onClick={prevHole}
              disabled={currentHole === 0}
              variant="outline"
              className="border-yellow-700 text-yellow-900 hover:bg-yellow-600 w-9 h-9 p-0 flex items-center justify-center"
              aria-label="Previous hole"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              onClick={() => {
                if (currentHole === round.holes.length - 1) {
                  onSaveRound();
                } else {
                  nextHole();
                }
              }}
              disabled={currentHole === round.holes.length - 1 && currentPlayerStats.holesPlayed < round.holes.length}
              className="bg-yellow-600 hover:bg-yellow-700 text-black px-3 py-2 rounded-md flex items-center space-x-2"
            >
              <span className="text-sm font-medium">{currentHole === round.holes.length - 1 ? 'Finish' : 'Next'}</span>
              <ChevronRight className="h-4 w-4 ml-0 flex-shrink-0" />
            </Button>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setShowCostSplit(true)} 
            className="flex-1 border-purple-300 text-white hover:bg-white/10"
          >
            <Receipt className="mr-2 h-4 w-4" />
            Split Costs
          </Button>
          {onShareRound && (
            <Button variant="outline" onClick={onShareRound} className="flex-1 border-purple-300 text-white hover:bg-white/10">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          )}
          <Button onClick={onSaveRound} className="flex-1 bg-purple-600 hover:bg-purple-700">
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Cost Split Dialog */}
      <CostSplitDialog
        open={showCostSplit}
        onOpenChange={setShowCostSplit}
        players={round.players.map(p => ({ playerId: p.playerId, name: p.name }))}
        expenses={expenses}
        onExpensesChange={setExpenses}
      />
    </div>
  );
};