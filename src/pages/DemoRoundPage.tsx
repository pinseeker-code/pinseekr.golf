import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import MobileContainer from '@/components/MobileContainer';
import { ScoreCard } from '@/components/scoring/ScoreCard';
import { Scoreboard } from '@/components/scoring/Scoreboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  createDemoRound, 
  DEMO_COURSE, 
  calculateDemoStats,
  type DemoRoundStats 
} from '@/lib/golf/demoData';
import { GolfRound } from '@/lib/golf/types';
import { 
  Trophy, 
  Target, 
  Users, 
  ArrowLeft, 
  BarChart3,
  Zap,
  Info
} from 'lucide-react';

export const DemoRoundPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Create demo round - useMemo to prevent recreation on every render
  const initialRound = useMemo(() => createDemoRound(), []);
  const [round, setRound] = useState<GolfRound>(initialRound);
  const [showSummary, setShowSummary] = useState(false);
  const [stats, setStats] = useState<DemoRoundStats | null>(null);
  const [showIntro, setShowIntro] = useState(true);

  const handleUpdateRound = useCallback((updatedRound: GolfRound | Partial<GolfRound>) => {
    setRound(prev => ({ ...prev, ...updatedRound } as GolfRound));
  }, []);

  const handleFinishRound = useCallback(() => {
    // Calculate final stats
    const finalStats = calculateDemoStats(round);
    setStats(finalStats);
    setShowSummary(true);
  }, [round]);

  const handleStartOver = useCallback(() => {
    setRound(createDemoRound());
    setShowSummary(false);
    setStats(null);
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-4">
        <MobileContainer>
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                Demo Mode
              </Badge>
            </div>

            {/* Demo Info Banner */}
            <Card className="mb-4 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950">
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-purple-900 dark:text-purple-100">
                      Interactive Demo: 9-Hole Round
                    </p>
                    <p className="text-purple-700 dark:text-purple-300">
                      Holes 1-8 are pre-filled. Navigate to <strong>Hole 9</strong> and enter scores for both players, 
                      then click <strong>Finish Round</strong> to see the stats summary. 
                      Active modes: <span className="font-semibold">Stroke Play, Match Play, Snake</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Game Modes */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active Modes:</span>
              <Badge className="bg-purple-600 text-white">
                <Target className="h-3 w-3 mr-1" />
                Stroke Play
              </Badge>
              <Badge className="bg-red-600 text-white">
                <Users className="h-3 w-3 mr-1" />
                Match Play
              </Badge>
              <Badge className="bg-green-600 text-white">
                🐍 Snake
              </Badge>
            </div>

            {/* ScoreCard */}
            <ScoreCard
              round={round}
              course={DEMO_COURSE}
              onUpdateRound={handleUpdateRound}
              onSaveRound={handleFinishRound}
            />

            {/* Summary Dialog */}
            <Dialog open={showSummary} onOpenChange={setShowSummary}>
              <DialogContent className="w-full max-w-md sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <Trophy className="h-6 w-6 text-yellow-500" />
                    Round Complete!
                  </DialogTitle>
                  <DialogDescription>
                    Here's how you and your opponent performed on the demo course.
                  </DialogDescription>
                </DialogHeader>

                {stats && (
                  <div className="space-y-6 mt-4">
                    {/* Full Scoreboard */}
                    <Card className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 border-purple-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-white text-base">Final Scorecard</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Scoreboard
                          round={round}
                          course={DEMO_COURSE}
                          compact
                        />
                      </CardContent>
                    </Card>

                    {/* Match Play Result */}
                    <Card className="border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-950">
                      <CardContent className="py-4">
                        <div className="text-center">
                          <div className="text-sm text-yellow-700 dark:text-yellow-300 mb-1">Match Play Result</div>
                          <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                            {stats.matchPlayStatus}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Player Comparison */}
                    <div className="grid grid-cols-2 gap-4">
                      {[stats.player1, stats.player2].map((player, idx) => (
                        <Card key={idx} className={idx === 0 ? 'border-blue-200' : 'border-red-200'}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{player.name}</CardTitle>
                            <CardDescription>
                              {player.totalHoles} holes
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <div className="text-sm text-gray-500">Active Modes</div>
                                <div className="flex gap-2 mt-1">
                                  {/* mode badges */}
                                </div>
                              </div>

                              <div>
                                <div className="text-gray-500">To Par</div>
                                <div className={`text-xl font-bold ${player.toPar < 0 ? 'text-green-600' : player.toPar > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                  {player.toPar > 0 ? '+' : ''}{player.toPar}
                                </div>
                              </div>
                            </div>

                            <div className="border-t pt-2 space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Birdies</span>
                                <span className="font-medium text-green-600">{player.birdies}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Pars</span>
                                <span className="font-medium">{player.pars}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Bogeys</span>
                                <span className="font-medium text-yellow-600">{player.bogeys}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Double+</span>
                                <span className="font-medium text-red-600">{player.doublePlus}</span>
                              </div>
                            </div>

                            <div className="border-t pt-2 space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Avg Putts</span>
                                <span className="font-medium">{player.avgPutts.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Fairways</span>
                                <span className="font-medium">{player.fairwayHitPct.toFixed(0)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">GIR</span>
                                <span className="font-medium">{player.girPct.toFixed(0)}%</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Snake Result */}
                    <Card className="border-green-200 bg-green-50 dark:bg-green-950">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">🐍</span>
                            <div>
                              <div className="text-sm text-green-700 dark:text-green-300">Snake Game</div>
                              <div className="font-bold text-green-900 dark:text-green-100">
                                {stats.snakeHolder === 'None' ? 'No 3-putts!' : `${stats.snakeHolder} holds the snake`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-green-700 dark:text-green-300">Transfers</div>
                            <div className="text-xl font-bold text-green-900 dark:text-green-100">{stats.snakeTransfers}</div>
                          </div>
                        </div>
                        {stats.snakeTransferHoles.length > 0 && (
                          <div className="border-t border-green-200 dark:border-green-800 pt-3">
                            <div className="text-xs text-green-700 dark:text-green-300 mb-2">Transfer History:</div>
                            <div className="flex flex-wrap gap-2">
                              {stats.snakeTransferHoles.map((transfer, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                                >
                                  Hole {transfer.holeNumber}: {transfer.playerName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        onClick={handleStartOver}
                        className="flex-1"
                      >
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Try Again
                      </Button>
                      <Button 
                        onClick={() => navigate('/round/new')}
                        className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Start Real Round
                      </Button>
                    </div>

                    {/* CTA */}
                    <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                      Ready to track your actual rounds? Sign in with Nostr to save scores, 
                      split wagers with Lightning, and share achievements!
                    </p>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Intro Dialog */}
            <Dialog open={showIntro} onOpenChange={setShowIntro}>
              <DialogContent className="w-full max-w-md mx-4 sm:mx-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="text-2xl">⛳</span>
                    Welcome to the Demo!
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-gray-600 dark:text-gray-400">
                    Experience Pinseekr's scoring interface with a pre-filled 9-hole round.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">✓</span>
                      <span><strong>Holes 1-8</strong> are already scored for both players</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-500">→</span>
                      <span>Navigate to <strong>Hole 9</strong> and enter scores</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-purple-500">★</span>
                      <span>Click <strong>Finish Round</strong> to see the summary</span>
                    </div>
                  </div>
                  <div className="pt-2">
                    <div className="text-xs text-gray-500 mb-2">Active game modes:</div>
                    <div className="flex gap-2">
                      <Badge variant="outline">Stroke Play</Badge>
                      <Badge variant="outline">Match Play</Badge>
                      <Badge variant="outline">🐍 Snake</Badge>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowIntro(false)} 
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
                  >
                    Let's Go!
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </MobileContainer>
      </div>
    </Layout>
  );
};

export default DemoRoundPage;
