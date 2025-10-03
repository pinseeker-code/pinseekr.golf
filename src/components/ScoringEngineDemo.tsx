import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  processRoundWagers,
  getNetSettlement,
  type WagerConfig,
  type Payable
} from '@/lib/golf/scoringEngine';
import {
  strokeEngine,
  convertToRoundData,
  type StrokeConfig
} from '@/lib/golf/strokeEngine';
import {
  matchEngine,
  convertToMatchData,
  type MatchConfig,
  type MatchResult
} from '@/lib/golf/matchEngine';
import {
  dotsEngine,
  convertToDotsData,
  type DotsConfig,
  type DotsResult
} from '@/lib/golf/dotsEngine';
import {
  snakeEngine,
  convertToSnakeData,
  type SnakeConfig,
  type SnakeResult
} from '@/lib/golf/snakeEngine';
import { PlayerInRound } from '@/lib/golf/types';interface ScoringEngineDemoProps {
  className?: string;
}

export const ScoringEngineDemo: React.FC<ScoringEngineDemoProps> = ({ className }) => {
  // State for collapsible sections
  const [showSampleData, setShowSampleData] = useState(false);
  const [showGameConfig, setShowGameConfig] = useState(false);

  // Results state
  const [netSettlement, setNetSettlement] = useState<Payable[]>([]);
  const [strokeResults, setStrokeResults] = useState<{
    name: string;
    leaderboard: Array<{ playerId: string; position: number }>;
    totals: { [playerId: string]: { gross: number; net: number } };
  } | null>(null);
  const [matchResults, setMatchResults] = useState<MatchResult | null>(null);
  const [dotsResults, setDotsResults] = useState<DotsResult | null>(null);
  const [snakeResults, setSnakeResults] = useState<SnakeResult | null>(null);

  // Sample round data
  const samplePlayers: PlayerInRound[] = [
    {
      playerId: 'alice',
      name: 'Alice Cooper',
      handicap: 10,
      scores: [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4], // 72 total
      total: 72,
      netTotal: 67
    },
    {
      playerId: 'bob',
      name: 'Bob Wilson',
      handicap: 18,
      scores: [5, 4, 6, 5, 5, 4, 5, 6, 5, 5, 4, 6, 5, 5, 4, 5, 6, 5], // 90 total
      total: 90,
      netTotal: 72
    },
    {
      playerId: 'charlie',
      name: 'Charlie Brown',
      handicap: 2,
      scores: [3, 4, 4, 3, 3, 4, 3, 4, 3, 3, 4, 4, 3, 3, 4, 3, 4, 3], // 62 total
      total: 62,
      netTotal: 60
    }
  ];

  const gameConfigs: { [gameName: string]: WagerConfig } = {
    'Nassau': { useNet: false, unitSats: 1000 },
    'Skins': { useNet: false, unitSats: 500, carryCap: 4 }
  };

  const processRound = () => {
    // Process wagers (Nassau & Skins)
    const roundResults = processRoundWagers(samplePlayers, gameConfigs);
    const settlement = getNetSettlement(roundResults);
    setNetSettlement(settlement);

    // Run stroke play engine
    const coreData = convertToRoundData(samplePlayers);
    const strokeConfig: StrokeConfig = { useNet: true };
    const strokeResult = strokeEngine(coreData, strokeConfig);

    setStrokeResults({
      name: strokeResult.name,
      leaderboard: strokeResult.breakdown.leaderboard,
      totals: strokeResult.breakdown.totals
    });

    // Run match play engine (using first two players)
    if (samplePlayers.length >= 2) {
      const matchPlayers = samplePlayers.slice(0, 2);
      const matchData = convertToMatchData(matchPlayers);
      const matchConfig: MatchConfig = { useNet: true };
      const matchResult = matchEngine(matchData, matchConfig);
      setMatchResults(matchResult);
    }

    // Run dots game engine
    const dotsData = convertToDotsData(coreData);
    const dotsConfig: DotsConfig = {
      wagerPerDot: 100,
      fairwayDots: 1,
      girDots: 1,
      onePuttDots: 1,
      birdieDots: 2,
      eagleDots: 5,
      doubleBogeyPenalty: -1
    };
    const dotsResult = dotsEngine(dotsData, dotsConfig);
    setDotsResults(dotsResult);

    // Run snake game engine
    const snakeData = convertToSnakeData(coreData);
    const snakeConfig: SnakeConfig = {
      penaltyAmount: 1000,
      distributeToGroup: false
    };
    const snakeResult = snakeEngine(snakeData, snakeConfig);
    setSnakeResults(snakeResult);
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
            <Badge variant="outline">Lightning Network</Badge>
          </CardTitle>
          <CardDescription>
            Process multiple golf game modes: Nassau, Skins, Stroke Play, Match Play, Dots, and Snake with Lightning Network settlement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lightning Settlement - Top Priority */}
          {netSettlement.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-purple-600 flex items-center gap-2">
                ⚡ Optimized Lightning Settlement
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  Final Result
                </Badge>
              </h3>
              <div className="space-y-2">
                {netSettlement.map((payment, index) => (
                  <div key={index} className="flex justify-between p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <span className="font-medium text-lg">
                      {samplePlayers.find(p => p.playerId === payment.from)?.name} pays {samplePlayers.find(p => p.playerId === payment.to)?.name}
                    </span>
                    <span className="font-mono font-bold text-purple-600 text-lg">
                      {formatSats(payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stroke Play Results */}
          {strokeResults && (
            <div>
              <h3 className="font-semibold mb-3 text-green-600 flex items-center gap-2">
                🏌️ Stroke Play Leaderboard
              </h3>
              <div className="space-y-2">
                {strokeResults.leaderboard.map((entry) => {
                  const player = samplePlayers.find(p => p.playerId === entry.playerId);
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
                        {totals.gross} / {totals.net}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Match Play Results */}
          {matchResults && (
            <div>
              <h3 className="font-semibold mb-3 text-blue-600 flex items-center gap-2">
                🥊 Match Play
              </h3>
              <div className="space-y-2">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-lg">{matchResults.matchSummary}</span>
                    <span className="font-mono font-bold text-blue-600 text-lg">
                      {matchResults.finalStatus.winner ? '1-0' : '0-0'}
                    </span>
                  </div>
                </div>

                {/* Player Stats */}
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(matchResults.totals).map(([playerId, totals]) => {
                    const player = samplePlayers.find(p => p.playerId === playerId);
                    return (
                      <div key={playerId} className="p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                        <div className="font-medium">{player?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Won: {totals.holesWon} | Lost: {totals.holesLost} | Tied: {totals.holesTied}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Dots Game Results */}
          {dotsResults && (
            <div>
              <h3 className="font-semibold mb-3 text-orange-600 flex items-center gap-2">
                🎯 Dots Game (Points)
              </h3>
              <div className="space-y-2">
                {/* Summary */}
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-lg">Total Dots Earned</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(dotsResults.totals).map(([playerId, totals]) => {
                      const player = samplePlayers.find(p => p.playerId === playerId);
                      return (
                        <div key={playerId} className="text-center">
                          <div className="font-medium">{player?.name}</div>
                          <div className="text-2xl font-bold text-orange-600">{totals.totalDots}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Payments */}
                {dotsResults.payments && dotsResults.payments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Payments</h4>
                    {dotsResults.payments.map((payment, index) => {
                      const fromPlayer = samplePlayers.find(p => p.playerId === payment.from);
                      const toPlayer = samplePlayers.find(p => p.playerId === payment.to);
                      return (
                        <div key={index} className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                          <span className="font-medium">
                            {fromPlayer?.name} pays {toPlayer?.name}
                          </span>
                          <span className="font-mono font-bold text-orange-600">
                            {formatSats(payment.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(snakeResults.threePuttSummary).map(([playerId, count]) => {
                      const player = samplePlayers.find(p => p.playerId === playerId);
                      return (
                        <div key={playerId} className="text-center">
                          <div className="font-medium">{player?.name}</div>
                          <div className="text-xl font-bold text-red-600">{count}</div>
                          <div className="text-xs text-muted-foreground">three-putts</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Snake Holder & Penalty */}
                {snakeResults.finalSnakeHolder && (
                  <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-lg">
                        🐍 {samplePlayers.find(p => p.playerId === snakeResults.finalSnakeHolder)?.name} holds the snake!
                      </span>
                      {snakeResults.penalty && (
                        <span className="font-mono font-bold text-red-600 text-lg">
                          -{formatSats(snakeResults.penalty.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sample Players - Collapsible */}
          <Collapsible open={showSampleData} onOpenChange={setShowSampleData}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <h3 className="font-semibold">Sample Round Data</h3>
                {showSampleData ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {samplePlayers.map(player => (
                  <div key={player.playerId} className="p-3 border rounded-lg">
                    <div className="font-medium">{player.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Total: {player.total} | Handicap: {player.handicap}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Game Configuration - Collapsible */}
          <Collapsible open={showGameConfig} onOpenChange={setShowGameConfig}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <h3 className="font-semibold">Game Configuration</h3>
                {showGameConfig ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-3 border rounded-lg">
                  <div className="font-medium">Nassau</div>
                  <div className="text-sm text-muted-foreground">1,000 sats per match</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="font-medium">Skins</div>
                  <div className="text-sm text-muted-foreground">500 sats per skin, 4 carry cap</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="font-medium">Dots Game</div>
                  <div className="text-sm text-muted-foreground">100 sats per dot difference</div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="font-medium">Snake</div>
                  <div className="text-sm text-muted-foreground">1,000 sats penalty for holder</div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Button onClick={processRound} className="w-full" size="lg">
            Process All Game Modes & Calculate Settlements
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
