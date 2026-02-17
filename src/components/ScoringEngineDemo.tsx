import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  strokeEngine,
  convertToRoundData,
  type StrokeConfig
} from '@/lib/golf/strokeEngine';
import {
  snakeEngine,
  convertToSnakeData as _convertToSnakeData,
  type SnakeConfig,
  type SnakeResult
} from '@/lib/golf/snakeEngine';
import { PlayerInRound } from '@/lib/golf/types';
import { createDemoRound, DEMO_COURSE_PARS } from '@/lib/golf/demoData';
import { SnakeVisualization } from '@/components/golf/SnakeVisualization';

interface ScoringEngineDemoProps {
  className?: string;
}
interface DemoPlayer extends PlayerInRound {
  putts?: number[];
}

type SkinsBreakdown = {
  hole: number;
  winner?: string;
  skins?: number;
  result?: string;
  scores?: { [playerId: string]: number };
};

type SkinsPayment = {
  from: string;
  to: string;
  amount: number;
  memo?: string;
};

type SkinsResult = {
  name: string;
  ledger: SkinsPayment[];
  breakdown: SkinsBreakdown[];
};


export const ScoringEngineDemo: React.FC<ScoringEngineDemoProps> = ({ className }) => {
  // Get initial demo round data
  const initialDemoRound = useMemo(() => createDemoRound(), []);
  
  // Initialize players with demo data including putts
  const initialPlayers = useMemo(() => {
    return initialDemoRound.players.map(player => ({
      ...player,
      putts: Array.from({ length: 9 }, (_, i) => player.holeDetails?.[i]?.putts || 0)
    }));
  }, [initialDemoRound.players]);
  
  // State for editable player data
  const [players, setPlayers] = useState<DemoPlayer[]>(initialPlayers);
  
  // State for collapsible sections
  const [showSampleData, setShowSampleData] = useState(false);
  const [showGameConfig, setShowGameConfig] = useState(false);

  // State for game mode selection
  const [enableStroke, setEnableStroke] = useState(true);
  const [enableSkins, setEnableSkins] = useState(true);
  const [enableSnake, setEnableSnake] = useState(true);
  const [enableStableford, setEnableStableford] = useState(false);

  // State for game configurations
  const [skinsSats, setSkinsSats] = useState(500);
  const [snakeSats, setSnakeSats] = useState(1000);
  const [useNetScoring, setUseNetScoring] = useState(true);

  // Results state
  const [strokeResults, setStrokeResults] = useState<{
    name: string;
    leaderboard: Array<{ playerId: string; position: number }>;
    totals: { [playerId: string]: { gross: number; net: number } };
  } | null>(null);
  const [snakeResults, setSnakeResults] = useState<SnakeResult | null>(null);
  const [skinsResults, setSkinsResults] = useState<SkinsResult | null>(null);
  const [stablefordResults, setStablefordResults] = useState<{
    leaderboard: Array<{ 
      playerId: string; 
      name: string; 
      points: number; 
      position: number;
      breakdown: {
        eagles: number;
        birdies: number;
        pars: number;
        bogeys: number;
        doubles: number;
      };
    }>;
  } | null>(null);

  // Handle score updates
  const updatePlayerScore = (playerId: string, holeIndex: number, score: number) => {
    setPlayers(prev => prev.map(p => {
      if (p.playerId === playerId) {
        const newScores = [...(p.scores || [])];
        newScores[holeIndex] = score;
        return { ...p, scores: newScores, total: newScores.reduce((a, b) => a + b, 0) };
      }
      return p;
    }));
  };

  // Handle putt updates
  const updatePlayerPutts = (playerId: string, holeIndex: number, putts: number) => {
    setPlayers(prev => prev.map(p => {
      if (p.playerId === playerId) {
        const newPutts = [...(p.putts || [])];
        newPutts[holeIndex] = putts;
        return { ...p, putts: newPutts };
      }
      return p;
    }));
  };

  // Handle handicap updates
  const updatePlayerHandicap = (playerId: string, handicap: number) => {
    setPlayers(prev => prev.map(p => 
      p.playerId === playerId ? { ...p, handicap } : p
    ));
  };

  // Generate new random simulation
  const generateNewSimulation = () => {
    const newDemoRound = createDemoRound();
    const newPlayers = newDemoRound.players.map(player => ({
      ...player,
      putts: Array.from({ length: 9 }, (_, i) => player.holeDetails?.[i]?.putts || 0)
    }));
    setPlayers(newPlayers);
    // Clear previous results
    setStrokeResults(null);
    setSkinsResults(null);
    setSnakeResults(null);
    setStablefordResults(null);
  };

  const processRound = () => {

    // Run stroke play engine
    if (enableStroke) {
      const coreData = convertToRoundData(players);
      const strokeConfig: StrokeConfig = { useNet: useNetScoring };
      const strokeResult = strokeEngine(coreData, strokeConfig);

      setStrokeResults({
        name: strokeResult.name,
        leaderboard: strokeResult.breakdown.leaderboard,
        totals: strokeResult.breakdown.totals
      });
    } else {
      setStrokeResults(null);
    }

    // Run skins processor (9 holes with whole sats)
    if (enableSkins) {
      let carry = 0;
      const ledger: Array<{ from: string; to: string; amount: number; memo?: string }> = [];
      const breakdown: Array<{ hole: number; winner?: string; skins?: number; result?: string; scores?: { [playerId: string]: number } }> = [];
      const playerIds = players.map(p => p.playerId);
      const numHoles = 9;

      // Helper to get scores for a hole
      const getHoleScores = (hole: number) => {
        const scores: { [playerId: string]: number } = {};
        players.forEach(p => {
          const grossScore = (p.scores || [])[hole - 1];
          if (grossScore !== undefined) {
            const netScore = useNetScoring ? grossScore - Math.floor(p.handicap / numHoles) : grossScore;
            scores[p.playerId] = netScore;
          }
        });
        return scores;
      };

      // Helper to find unique low score
      const findUniqueLow = (scores: { [playerId: string]: number }) => {
        const values = Object.values(scores);
        if (values.length === 0) return null;
        const low = Math.min(...values);
        const winners = Object.keys(scores).filter(id => scores[id] === low);
        return winners.length === 1 ? winners[0] : null;
      };

      // Process each hole
      for (let hole = 1; hole <= numHoles; hole++) {
        carry++;
        const scores = getHoleScores(hole);
        const winnerId = findUniqueLow(scores);
        
        if (winnerId) {
          const skinsWon = carry;
          
          // Each loser pays skinsSats per skin to the winner
          const losers = playerIds.filter(id => id !== winnerId);
          losers.forEach((playerId) => {
            const payment = skinsSats * skinsWon;
            ledger.push({
              from: playerId,
              to: winnerId,
              amount: payment,
              memo: `Hole ${hole} - ${skinsWon} skin${skinsWon > 1 ? 's' : ''}`
            });
          });
          
          breakdown.push({ 
            hole: hole, 
            winner: winnerId, 
            skins: skinsWon,
            scores: scores
          });
          carry = 0;
        } else {
          breakdown.push({
            hole: hole,
            result: "Tie - carry over",
            scores: scores
          });
        }
      }

      setSkinsResults({ name: 'Skins', ledger, breakdown });
    } else {
      setSkinsResults(null);
    }

    // Run stableford scoring
    if (enableStableford) {
      const stablefordData = players.map(player => {
        let totalPoints = 0;
        const breakdown = { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0 };
        (player.scores || []).forEach((score, idx) => {
          const par = DEMO_COURSE_PARS[idx] ?? 4;
          const netScore = useNetScoring ? score - Math.floor(player.handicap / 9) : score;
          const diff = netScore - par;
          let points = 0;
          if (diff <= -2) {
            points = 3; // Eagle or better
            breakdown.eagles++;
          } else if (diff === -1) {
            points = 2; // Birdie
            breakdown.birdies++;
          } else if (diff === 0) {
            points = 1; // Par
            breakdown.pars++;
          } else if (diff === 1) {
            points = 0; // Bogey
            breakdown.bogeys++;
          } else {
            points = -1; // Double bogey or worse
            breakdown.doubles++;
          }
          totalPoints += points;
        });
        return {
          playerId: player.playerId,
          name: player.name,
          points: totalPoints,
          breakdown
        };
      });
      
      // Sort by points descending
      stablefordData.sort((a, b) => b.points - a.points);
      
      // Assign positions
      const leaderboard = stablefordData.map((player, idx) => ({
        ...player,
        position: idx + 1
      }));
      
      setStablefordResults({ leaderboard });
    } else {
      setStablefordResults(null);
    }

    // Run snake game engine
    if (enableSnake) {
      const coreData = convertToRoundData(players);
      
      // Create snake data with actual putts from players
      const puttsData: { [playerId: string]: { [hole: number]: number } } = {};
      players.forEach(player => {
        puttsData[player.playerId] = {};
        (player.putts || []).forEach((puttCount, idx) => {
          puttsData[player.playerId]![idx + 1] = puttCount;
        });
      });
      
      const snakeData = {
        ...coreData,
        putts: puttsData
      };
      
      const snakeConfig: SnakeConfig = {
        penaltyAmount: snakeSats,
        distributeToGroup: false
      };
      const snakeResult = snakeEngine(snakeData, snakeConfig);
      setSnakeResults(snakeResult);
    } else {
      setSnakeResults(null);
    }
  };

  const formatSats = (sats: number) => {
    return new Intl.NumberFormat().format(sats) + ' sats';
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ⚡ Scoring Engine Demo
          </CardTitle>
          <CardDescription>
            Process multiple golf game modes: Stroke Play, Skins, Snake, and Stableford
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Snake Visualization */}
          {snakeResults && (
            <SnakeVisualization
              snakeResult={snakeResults}
              playerNames={Object.fromEntries(players.map(p => [p.playerId, p.name]))}
              playerScores={Object.fromEntries(
                players.map(p => [
                  p.playerId,
                  p.scores || []
                ])
              )}
              coursePars={DEMO_COURSE_PARS}
            />
          )}


          {/* Stroke Play Results */}
          {strokeResults && (
            <div>
              <h3 className="font-semibold mb-3 text-green-600 flex items-center gap-2">
                🏌️ Stroke Play Leaderboard
              </h3>
              <div className="space-y-2">
                {strokeResults.leaderboard.map((entry) => {
                  const player = players.find(p => p.playerId === entry.playerId);
                  const totals = strokeResults.totals[entry.playerId];
                  return (
                    <div key={entry.playerId} className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg min-w-[2rem]">
                          {entry.position}.
                        </span>
                        <div>
                          <span className="font-medium text-lg">{player?.name}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-green-600 text-lg">
                        {(totals?.gross ?? 0)} / {(totals?.net ?? 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end mt-1">
                <span className="text-xs text-muted-foreground mr-4">Gross / Net</span>
              </div>
            </div>
          )}

          {/* Skins Results */}
          {skinsResults && (
            <div>
              <h3 className="font-semibold mb-3 text-blue-600 flex items-center gap-2">
                💰 Skins Game
              </h3>
              <div className="space-y-2">
                {/* Hole by hole breakdown */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="font-medium text-sm mb-2">Hole-by-Hole Results</div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {(skinsResults.breakdown as { hole: number; winner?: string; skins?: number; result?: string; scores?: { [playerId: string]: number } }[]).map((holeResult, idx) => (
                      <div key={idx} className="text-xs py-1 border-b border-blue-100 dark:border-blue-800 last:border-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">Hole {holeResult.hole}</span>
                          {holeResult.winner ? (
                            <span className="text-blue-600 font-semibold">
                              {players.find(p => p.playerId === holeResult.winner)?.name} wins {holeResult.skins} skin{holeResult.skins && holeResult.skins > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-500">{holeResult.result}</span>
                          )}
                        </div>
                        {holeResult.scores && (
                          <div className="flex gap-3 text-xs text-muted-foreground ml-2">
                            {Object.entries(holeResult.scores).map(([playerId, score]) => {
                              const player = players.find(p => p.playerId === playerId);
                              const isWinner = playerId === holeResult.winner;
                              return (
                                <span key={playerId} className={isWinner ? 'font-semibold text-blue-600' : ''}>
                                  {player?.name.split(' ')[0]}: {score}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Payment summary */}
                {skinsResults.ledger.length > 0 && (
                  <div className="p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
                    <div className="font-medium text-sm mb-2">Payment Summary</div>
                    <div className="space-y-1">
                      {(() => {
                        // Calculate net payments for each player
                        const netPayments: Record<string, number> = {};
                        skinsResults.ledger.forEach(payment => {
                          netPayments[payment.from] = (netPayments[payment.from] || 0) - payment.amount;
                          netPayments[payment.to] = (netPayments[payment.to] || 0) + payment.amount;
                        });
                        
                        // Display net position for each player
                        return Object.entries(netPayments)
                          .sort((a, b) => b[1] - a[1]) // Sort by amount (winners first)
                          .map(([playerId, amount]) => {
                            const player = players.find(p => p.playerId === playerId);
                            const isWinner = amount > 0;
                            return (
                              <div key={playerId} className="flex justify-between text-sm">
                                <span className="font-medium">{player?.name}</span>
                                <span className={`font-mono font-bold ${isWinner ? 'text-green-600' : 'text-red-600'}`}>
                                  {isWinner ? '+' : ''}{formatSats(amount)}
                                </span>
                              </div>
                            );
                          });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stableford Results */}
          {stablefordResults && (
            <div>
              <h3 className="font-semibold mb-3 text-orange-600 flex items-center gap-2">
                📊 Stableford Points
              </h3>
              <div className="space-y-2">
                {stablefordResults.leaderboard.map((entry) => (
                  <div key={entry.playerId} className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    {/* Player header */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg min-w-[2rem]">
                          {entry.position}.
                        </span>
                        <span className="font-medium text-lg">{entry.name}</span>
                      </div>
                      <span className="font-mono font-bold text-orange-600 text-lg">
                        {entry.points} pts
                      </span>
                    </div>
                    {/* Breakdown */}
                    <div className="grid grid-cols-5 gap-2 text-center text-sm pt-3 border-t border-orange-200 dark:border-orange-700">
                      <div>
                        <div className="font-bold text-orange-600">{entry.breakdown.eagles}</div>
                        <div className="text-xs text-muted-foreground">Eagles</div>
                        <div className="text-xs font-mono text-orange-500">{entry.breakdown.eagles * 3} pts</div>
                      </div>
                      <div>
                        <div className="font-bold text-orange-600">{entry.breakdown.birdies}</div>
                        <div className="text-xs text-muted-foreground">Birdies</div>
                        <div className="text-xs font-mono text-orange-500">{entry.breakdown.birdies * 2} pts</div>
                      </div>
                      <div>
                        <div className="font-bold text-orange-600">{entry.breakdown.pars}</div>
                        <div className="text-xs text-muted-foreground">Pars</div>
                        <div className="text-xs font-mono text-orange-500">{entry.breakdown.pars * 1} pts</div>
                      </div>
                      <div>
                        <div className="font-bold text-gray-500">{entry.breakdown.bogeys}</div>
                        <div className="text-xs text-muted-foreground">Bogeys</div>
                        <div className="text-xs font-mono text-gray-400">0 pts</div>
                      </div>
                      <div>
                        <div className="font-bold text-gray-500">{entry.breakdown.doubles}</div>
                        <div className="text-xs text-muted-foreground">Dbl+</div>
                        <div className="text-xs font-mono text-red-500">{entry.breakdown.doubles * -1} pts</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Snake Game Results */}
          {snakeResults && (
            <div>
              <h3 className="font-semibold mb-3 text-red-600 flex items-center gap-2">
                🐍 Snake Game
              </h3>
              <div className="space-y-2">
                {/* Summary */}
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-lg">Three-Putt Summary</span>
                    <span className="text-sm text-muted-foreground">
                      {snakeResults.snakePasses} snake passes
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(snakeResults.threePuttSummary).map(([playerId, count]) => {
                      const player = players.find(p => p.playerId === playerId);
                      return (
                        <div key={playerId} className="text-center">
                          <div className="font-medium text-sm">{player?.name}</div>
                          <div className="text-xl font-bold text-red-600">{count}</div>
                          <div className="text-xs text-muted-foreground">three-putts</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Snake Holder & Penalty */}
                {snakeResults.finalSnakeHolder && snakeResults.penalty && (
                  <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-lg">
                        🐍 {players.find(p => p.playerId === snakeResults.finalSnakeHolder)?.name} holds the snake!
                      </span>
                      <span className="font-mono font-bold text-red-600 text-lg">
                        Owes {formatSats(snakeResults.penalty.amount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sample Players - Editable */}
          <Collapsible open={showSampleData} onOpenChange={setShowSampleData}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <h3 className="font-semibold">Sample Round Data</h3>
                {showSampleData ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {players.map(player => (
                  <div key={player.playerId} className="p-4 border rounded-lg space-y-3">
                    <div className="font-semibold">{player.name}</div>
                    
                    {/* Handicap */}
                    <div>
                      <label className="text-sm font-medium">Handicap</label>
                      <input
                        type="number"
                        value={player.handicap}
                        onChange={(e) => updatePlayerHandicap(player.playerId, parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    {/* Scores Grid */}
                    <div>
                      <label className="text-sm font-medium block mb-2">Scores (9 holes)</label>
                      <div className="grid grid-cols-9 gap-1">
                        {Array.from({ length: 9 }).map((_, idx) => (
                          <div key={idx}>
                            <label className="text-xs text-gray-500 block">{idx + 1}</label>
                            <input
                              type="number"
                              value={player.scores?.[idx] || ''}
                              onChange={(e) => updatePlayerScore(player.playerId, idx, parseInt(e.target.value) || 0)}
                              className="w-full px-1 py-1 border rounded text-sm text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
                              min="1"
                              max="13"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Putts Grid */}
                    <div>
                      <label className="text-sm font-medium block mb-2">Putts (9 holes)</label>
                      <div className="grid grid-cols-9 gap-1">
                        {Array.from({ length: 9 }).map((_, idx) => (
                          <div key={idx}>
                            <label className="text-xs text-gray-500 block">{idx + 1}</label>
                            <input
                              type="number"
                              value={player.putts?.[idx] || ''}
                              onChange={(e) => updatePlayerPutts(player.playerId, idx, parseInt(e.target.value) || 0)}
                              className="w-full px-1 py-1 border rounded text-sm text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
                              min="0"
                              max="10"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="text-sm pt-2 border-t">
                      <div>Total Score: <span className="font-semibold">{player.total}</span></div>
                      <div>Total Putts: <span className="font-semibold">{(player.putts || []).reduce((a, b) => a + b, 0)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Game Configuration - Configurable */}
          <Collapsible open={showGameConfig} onOpenChange={setShowGameConfig}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <h3 className="font-semibold">Game Configuration</h3>
                {showGameConfig ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              {/* Game Mode Selection */}
              <div>
                <h4 className="font-medium mb-3">Select Game Modes</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableStroke}
                      onChange={(e) => setEnableStroke(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Stroke Play (Net Scoring)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSkins}
                      onChange={(e) => setEnableSkins(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Skins (Per-Hole)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableSnake}
                      onChange={(e) => setEnableSnake(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Snake Game</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableStableford}
                      onChange={(e) => setEnableStableford(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Stableford (Points)</span>
                  </label>
                </div>
              </div>

              {/* Stroke Play Configuration */}
              {enableStroke && (
                <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded border border-green-200 dark:border-green-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useNetScoring}
                      onChange={(e) => setUseNetScoring(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="font-medium text-sm">Use Net Scoring (with handicap)</span>
                  </label>
                </div>
              )}

              {/* Skins Configuration */}
              {enableSkins && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded border border-blue-200 dark:border-blue-800 space-y-2">
                  <label className="font-medium text-sm block">Skins Value (sats per player)</label>
                  <input
                    type="number"
                    value={skinsSats}
                    onChange={(e) => setSkinsSats(e.target.value === '' ? 0 : parseInt(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
                    min="100"
                    step="100"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Each loser pays {formatSats(skinsSats)} per skin to the winner (ties carry over)
                  </p>
                </div>
              )}

              {/* Stableford Configuration */}
              {enableStableford && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded border border-orange-200 dark:border-orange-800 space-y-2">
                  <p className="font-medium text-sm">Stableford Point Scoring</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Eagle: +3pts | Birdie: +2pts | Par: +1pt | Bogey: 0pts | Double+: -1pt
                  </p>
                </div>
              )}

              {/* Snake Configuration */}
              {enableSnake && (
                <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded border border-red-200 dark:border-red-800 space-y-2">
                  <label className="font-medium text-sm block">Snake Penalty (sats)</label>
                  <input
                    type="number"
                    value={snakeSats}
                    onChange={(e) => setSnakeSats(e.target.value === '' ? 0 : parseInt(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    className="w-full px-3 py-2 border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
                    min="100"
                    step="100"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Final snake holder pays this amount split among other players
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="flex gap-2">
            <Button onClick={generateNewSimulation} variant="outline" className="flex-1" size="lg">
              🎲 New Simulation
            </Button>
            <Button onClick={processRound} className="flex-1" size="lg">
              ⚡ Process Round
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
