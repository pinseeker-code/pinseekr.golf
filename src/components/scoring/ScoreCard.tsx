import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GameMode, HoleScore, GolfRound } from '@/lib/golf/types';
import { ScoringEngine } from '@/lib/golf/scoringEngine';
import { Settings, Save, Share2 } from 'lucide-react';

interface ScoreCardProps {
  round: GolfRound;
  onUpdateRound: (round: GolfRound) => void;
  onSaveRound: () => void;
  onShareRound: () => void;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({
  round,
  onUpdateRound,
  onSaveRound,
  onShareRound
}) => {
  const [editingHole, setEditingHole] = useState<number | null>(null);
  const [tempScores, setTempScores] = useState<{[key: string]: Partial<HoleScore>}>({});

  const scoringEngine = new ScoringEngine({
    mode: round.gameMode,
    players: round.players,
    handicaps: {},
    settings: { useHandicaps: true, netScoring: true }
  });

  const handleScoreChange = (playerId: string, holeIndex: number, field: keyof HoleScore, value: unknown) => {
    const newScores = { ...tempScores };
    const holeKey = `${playerId}-${holeIndex}`;

    if (!newScores[holeKey]) {
      newScores[holeKey] = {};
    }

    newScores[holeKey] = {
      ...newScores[holeKey],
      [field]: value
    };

    setTempScores(newScores);
  };

  const saveHoleScores = (holeIndex: number) => {
    const updatedRound = { ...round };

    round.players.forEach(player => {
      const holeKey = `${player.playerId}-${holeIndex}`;
      const tempScore = tempScores[holeKey];

      if (tempScore) {
        const hole = updatedRound.holes[holeIndex];
        if (hole) {
          Object.assign(hole, tempScore);
        }
      }
    });

    // Recalculate player totals
    updatedRound.players = updatedRound.players.map(player => {
      const scores = updatedRound.holes
        .slice(0, player.scores.length)
        .map((_, index) => player.scores[index] || 0);

      const total = scores.reduce((sum, score) => sum + score, 0);
      const netTotal = scoringEngine.calculateNetScore(total, player.handicap);

      return {
        ...player,
        scores,
        total,
        netTotal
      };
    });

    onUpdateRound(updatedRound);
    setEditingHole(null);
    setTempScores({});
  };

  const getGameModeColor = (mode: GameMode): string => {
    const colors: Record<GameMode, string> = {
      [GameMode.STROKE_PLAY]: 'bg-blue-100 text-blue-800',
      [GameMode.SKINS]: 'bg-green-100 text-green-800',
      [GameMode.NASSAU]: 'bg-purple-100 text-purple-800',
      [GameMode.MATCH_PLAY]: 'bg-red-100 text-red-800',
      [GameMode.WOLF]: 'bg-yellow-100 text-yellow-800',
      [GameMode.POINTS]: 'bg-indigo-100 text-indigo-800',
      [GameMode.VEGAS]: 'bg-pink-100 text-pink-800',
      [GameMode.SIXES]: 'bg-teal-100 text-teal-800',
      [GameMode.DOTS]: 'bg-orange-100 text-orange-800',
      [GameMode.ROLLING_STROKES]: 'bg-cyan-100 text-cyan-800',
      [GameMode.SNAKE]: 'bg-lime-100 text-lime-800'
    };

    return colors[mode] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">⛳</span>
              </div>
              <div>
                <CardTitle className="text-2xl">{round.metadata.courseName}</CardTitle>
                <p className="text-gray-600 dark:text-gray-400">
                  {new Date(round.date).toLocaleDateString()} • {round.players.length} players
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getGameModeColor(round.gameMode)}>
                {round.gameMode.replace('-', ' ').toUpperCase()}
              </Badge>
              <Badge variant={round.status === 'completed' ? 'default' : 'secondary'}>
                {round.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Score Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Hole
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Par
                  </th>
                  {round.players.map((player) => (
                    <th key={player.playerId} className="px-4 py-3 text-center">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {player.name}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {player.handicap > 0 ? `+${player.handicap}` : ''}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {round.holes.map((hole, holeIndex) => (
                  <tr key={hole.holeNumber} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {hole.holeNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                      {hole.par}
                    </td>

                    {round.players.map((player) => {
                      const holeKey = `${player.playerId}-${holeIndex}`;
                      const tempScore = tempScores[holeKey];
                      const isEditing = editingHole === holeIndex;
                      const playerScore = player.scores[holeIndex] || 0;

                      return (
                        <td key={player.playerId} className="px-2 py-3 text-center">
                          {isEditing ? (
                            <div className="space-y-1">
                              <Input
                                type="number"
                                min="0"
                                max="20"
                                value={tempScore?.strokes || playerScore || ''}
                                onChange={(e) => handleScoreChange(player.playerId, holeIndex, 'strokes', parseInt(e.target.value) || 0)}
                                className="w-16 text-center"
                              />
                              <Input
                                type="number"
                                min="0"
                                max="10"
                                value={tempScore?.putts || hole.putts || ''}
                                onChange={(e) => handleScoreChange(player.playerId, holeIndex, 'putts', parseInt(e.target.value) || 0)}
                                className="w-16 text-center text-xs"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {playerScore}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {hole.putts}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-4 py-3 text-sm text-center font-medium">
                      {round.players[0]?.scores[holeIndex] || 0}
                    </td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr className="bg-gray-50 dark:bg-gray-800 font-semibold">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    Total
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                    {round.holes.reduce((sum, hole) => sum + hole.par, 0)}
                  </td>

                  {round.players.map((player) => (
                    <td key={player.playerId} className="px-4 py-3 text-center">
                      <div className="text-lg font-bold">
                        {player.total}
                      </div>
                      {player.handicap > 0 && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ({player.netTotal})
                        </div>
                      )}
                    </td>
                  ))}

                  <td className="px-4 py-3 text-sm text-center font-medium">
                    {round.players[0]?.total || 0}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingHole(editingHole === null ? 0 : null)}
          >
            <Settings className="mr-2 h-4 w-4" />
            {editingHole === null ? 'Edit Scores' : 'View Mode'}
          </Button>

          {editingHole !== null && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveHoleScores(editingHole)}
            >
              Save Hole {editingHole + 1}
            </Button>
          )}
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" onClick={onShareRound}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button onClick={onSaveRound}>
            <Save className="mr-2 h-4 w-4" />
            Save Round
          </Button>
        </div>
      </div>
    </div>
  );
};