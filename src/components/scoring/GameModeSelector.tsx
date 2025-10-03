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
      rules: 'Count every stroke taken throughout the round. Add up all strokes across 18 holes - lowest total score wins. Most common format for tournaments and casual play. Can use gross scores or net scores (with handicap adjustments).',
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
      name: 'Points (Stableford)',
      description: 'Point-based system with different values for scores',
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
      description: 'Three-person teams with rotating partners',
      rules: 'Three players rotate partnerships every 6 holes. Holes 1-6: A&B vs C, Holes 7-12: A&C vs B, Holes 13-18: B&C vs A. Partners play best ball (take the better score). Each 6-hole match awards points to winners. Individual scores tracked separately. Great for threesomes wanting competitive team play.',
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
      mode: GameMode.ROLLING_STROKES,
      name: 'Rolling Strokes',
      description: 'Handicap-adjusted scoring with rolling handicaps',
      rules: 'Dynamic handicap system that adjusts based on recent performance. Start with established handicaps, then adjust up/down based on scores relative to handicap. Better scores lower your handicap for future holes, worse scores raise it. Creates more balanced competition as the round progresses.',
      icon: <Trophy className="h-6 w-6" />,
      color: 'bg-cyan-100 text-cyan-800 border-cyan-200'
    },
    {
      mode: GameMode.SNAKE,
      name: 'Snake',
      description: 'Progressive penalty game for three-putts',
      rules: 'One player holds the "Snake" (starts randomly or by three-putting). When you three-putt, you take the Snake from current holder. Snake holder pays a penalty at the end of each hole to all other players. Penalty often increases as round progresses. The goal is to avoid three-putts and get rid of the Snake quickly.',
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
        {gameModes.map(({ mode, name, description, icon, color }) => (
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
        ))}
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