import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge as UIBadge } from '@/components/ui/badge';
import { Trophy, Star, Target } from 'lucide-react';
import type { Badge } from '@/lib/golf/social';

interface BadgeDisplayProps {
  badges: Badge[];
  className?: string;
  showAll?: boolean;
  maxDisplay?: number;
}

const BadgeIcon = ({ category }: { category: Badge['category'] }) => {
  switch (category) {
    case 'achievement':
      return <Trophy className="h-3 w-3" />;
    case 'milestone':
      return <Target className="h-3 w-3" />;
    case 'special':
      return <Star className="h-3 w-3" />;
    default:
      return <Trophy className="h-3 w-3" />;
  }
};

const BadgeRarityColor = ({ rarity }: { rarity: Badge['rarity'] }) => {
  const colors = {
    common: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    rare: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    epic: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    legendary: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  };
  return colors[rarity];
};

export function BadgeDisplay({ badges, className, showAll = false, maxDisplay = 6 }: BadgeDisplayProps) {
  const displayBadges = showAll ? badges : badges.slice(0, maxDisplay);
  const remainingCount = badges.length - maxDisplay;

  if (badges.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Badges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No badges earned yet. Start playing to unlock achievements!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Trophy className="h-4 w-4" />
          Badges ({badges.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayBadges.map((badge) => (
            <div
              key={badge.id}
              className="flex flex-col items-center p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              title={badge.description}
            >
              <div className="text-2xl mb-2">{badge.icon}</div>
              <div className="text-center">
                <div className="font-medium text-xs truncate max-w-full">{badge.name}</div>
                <UIBadge
                  variant="secondary"
                  className={`mt-1 text-xs ${BadgeRarityColor({ rarity: badge.rarity })}`}
                >
                  <BadgeIcon category={badge.category} />
                  <span className="ml-1 capitalize">{badge.rarity}</span>
                </UIBadge>
              </div>
            </div>
          ))}
        </div>
        
        {!showAll && remainingCount > 0 && (
          <div className="mt-3 text-center">
            <UIBadge variant="outline" className="text-xs">
              +{remainingCount} more
            </UIBadge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}