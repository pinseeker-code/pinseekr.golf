import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GameMode } from '@/lib/golf/types';
import { Trophy, Users, Target, Zap } from 'lucide-react';

interface GameModeSelectorProps {
  selectedMode: GameMode | null;
  onModeSelect: (mode: GameMode) => void;
}

export const GameModeSelector: React.FC<GameModeSelectorProps> = ({
  selectedMode,
  onModeSelect
}) => {
  const gameModes: { mode: GameMode; name: string; description: string; rules: string; icon: React.ReactNode; color: string }[] = [
    {
      mode: GameMode.STROKE_PLAY,
      name: 'Stroke Play',
      description: 'Traditional scoring - lowest total score wins',
    rules: 'Count every stroke taken throughout the round. Add up all strokes across 18 holes - lowest total score wins. Most common format for tournaments and casual play. Can use gross scores or net scores (handicap adjustments).',
      icon: <Target className="h-6 w-6" />,
      color: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      mode: GameMode.MATCH_PLAY,
      name: 'Match Play',
      description: 'Head-to-head competition - hole-by-hole scoring',
      rules: 'Win, lose, or tie each individual hole. Winner of each hole wins that hole (1 up). If tied, hole is halved. First player to be more holes "up" than holes remaining wins the match. Example: 3 up with 2 holes to play = match won.',
      icon: <Users className="h-6 w-6" />,
      color: 'bg-red-100 text-red-800 border-red-200'
    },
    {
      mode: GameMode.SKINS,
      name: 'Skins',
      description: 'Win individual holes - lowest score on each hole wins',
      rules: 'Each hole has a monetary value ("skin"). Player with lowest score on a hole wins that skin. If tied, the skin carries over to the next hole (making it worth more). Continue until someone wins a hole outright. All skins must be won - if the last holes tie, those skins push to a playoff or next round.',
      icon: <Trophy className="h-6 w-6" />,
      color: 'bg-green-100 text-green-800 border-green-200'
    },
    {
      mode: GameMode.NASSAU,
      name: 'Nassau',
      description: 'Three matches in one: front nine, back nine, and total',
      rules: 'Three separate bets: Front 9, Back 9, and Overall 18-hole match. Each is worth equal money. You can win, lose, or push each bet independently. Typically played as match play (hole-by-hole) for each segment. A player could lose the front 9, win the back 9, and tie overall - resulting in winning 1 out of 3 bets.',
      icon: <Zap className="h-6 w-6" />,
      color: 'bg-purple-100 text-purple-800 border-purple-200'
    },
    {
      mode: GameMode.POINTS,
      name: 'Stableford',
      description: 'Stableford',
      rules: 'Earn points based on score relative to par: Double Eagle = 8pts, Eagle = 5pts, Birdie = 3pts, Par = 2pts, Bogey = 1pt, Double Bogey+ = 0pts. Highest point total wins. This format rewards aggressive play and reduces the impact of disaster holes since you can\'t score negative points.',
      icon: <Target className="h-6 w-6" />,
      color: 'bg-indigo-100 text-indigo-800 border-indigo-200'
    },
    {
      mode: GameMode.WOLF,
      name: 'Wolf',
      description: 'Strategic game with rotating roles and partnerships',
      rules: 'Players rotate being the "Wolf" each hole. Wolf tees off last and chooses a partner after seeing everyone\'s drive, or plays alone ("Lone Wolf") for double points. Wolf & partner vs other two players. Points awarded: Win = +2pts each, Lose = -1pt each. Lone Wolf wins = +4pts, Lone Wolf loses = -2pts. Most points after 18 holes wins.',
      icon: <Users className="h-6 w-6" />,
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    },
    {
      mode: GameMode.VEGAS,
      name: 'Vegas',
      description: 'Two-person teams with combined scoring',
      rules: 'Two teams of 2 players each. Combine teammates\' scores by concatenating them (not adding). Lower score goes first. Example: Team A scores 4 and 5 = 45, Team B scores 3 and 6 = 36. Team B wins the hole. If a player shoots 10+, flip the scores (45 vs 63 becomes 54 vs 36). Play for points per hole.',
      icon: <Zap className="h-6 w-6" />,
      color: 'bg-pink-100 text-pink-800 border-pink-200'
    },
    {
      mode: GameMode.SIXES,
      name: 'Sixes',
      description: 'Rotating partnerships every 6 holes with best ball scoring',
      rules: 'Players form new partnerships every 6 holes (holes 1-6, 7-12, 13-18), creating different team matchups throughout the round. Partners play best ball (take the better score) against the remaining players. Each 6-hole segment awards 1 point to each player on the winning team. Individual scores are tracked separately. Works well with 3+ players for competitive team play with constantly changing alliances.',
      icon: <Users className="h-6 w-6" />,
      color: 'bg-teal-100 text-teal-800 border-teal-200'
    },
    {
      mode: GameMode.DOTS,
      name: 'Dots',
      description: 'Par-based game with bonus points for birdies',
      rules: 'Earn dots (points) for achievements: Fairway hit = 1 dot, Green in regulation = 1 dot, One putt = 1 dot, Birdie = 2 dots, Eagle = 5 dots. Lose dots: Double bogey = -1 dot. Add up dots for each hole. Most dots wins. Rewards consistent, solid golf play across all aspects of the game.',
      icon: <Target className="h-6 w-6" />,
      color: 'bg-orange-100 text-orange-800 border-orange-200'
    },
    {
      mode: GameMode.SNAKE,
      name: 'Snake',
      description: 'Progressive Wager (penalty increases as more three-putts are made by the group)',
      rules: 'One player holds the "Snake". When a player three-putts, the Snake is passed to them. The player holding the Snake at the end of the round pays a penalty to other players. In Fixed mode, penalty is a set amount. In Progressive mode, the penalty multiplies with each transfer (default 1.1x). Most three-putts = biggest penalty.',
      icon: <Zap className="h-6 w-6" />,
      color: 'bg-lime-100 text-lime-800 border-lime-200'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Select Game Mode</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Choose how you want to score your round
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gameModes.map(({ mode, name, description, icon, color }) => {
          // Special styling for Snake button - spans full width and looks scaly
          if (mode === GameMode.SNAKE) {
            return (
              <Card
                key={mode}
                className={`cursor-pointer transition-all hover:shadow-lg col-span-full ${
                  selectedMode === mode ? 'ring-2 ring-green-500' : ''
                } bg-gradient-to-r from-green-100 via-lime-100 to-green-100 dark:from-green-900 dark:via-lime-900 dark:to-green-900 border-2 border-green-300 dark:border-green-600 relative overflow-hidden`}
                onClick={() => onModeSelect(mode)}
              >
                {/* Scaly pattern background */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 20px 20px, rgba(34, 197, 94, 0.3) 2px, transparent 2px),
                                     radial-gradient(circle at 40px 40px, rgba(34, 197, 94, 0.2) 1px, transparent 1px)`,
                    backgroundSize: '30px 30px'
                  }}></div>
                </div>
                
                <CardHeader className="pb-3 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-green-500 text-white p-3 rounded-full shadow-lg transform hover:scale-110 transition-transform">
                        🐍
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-green-800 dark:text-green-200">
                          {name}
                        </CardTitle>
                        <p className="text-green-700 dark:text-green-300 font-medium">
                          {description}
                        </p>
                      </div>
                    </div>
                    {selectedMode === mode && (
                      <Badge className="bg-green-600 text-white animate-pulse">🐍 Selected</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-700">
                    <p className="text-green-800 dark:text-green-200 text-sm font-medium">
                      🐍 {gameModes.find(g => g.mode === mode)?.rules}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          }

          // Regular game mode cards
          return (
            <Card
              key={mode}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedMode === mode ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => onModeSelect(mode)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`${color} p-2 rounded-lg`}>
                      {icon}
                    </div>
                    <CardTitle className="text-lg">{name}</CardTitle>
                  </div>
                  {selectedMode === mode && (
                    <Badge className="bg-blue-500 text-white">Selected</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedMode && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-blue-900 dark:text-blue-100">
              <Target className="h-5 w-5 text-blue-600" />
              <span>{selectedMode.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
            </CardTitle>
            <CardDescription className="text-blue-700 dark:text-blue-300">
              {gameModes.find(g => g.mode === selectedMode)?.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">How to Play:</h4>
                <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">
                  {gameModes.find(g => g.mode === selectedMode)?.rules}
                </p>
              </div>
              <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                  ✓ Ready to start your {selectedMode.replace('-', ' ')} round!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};