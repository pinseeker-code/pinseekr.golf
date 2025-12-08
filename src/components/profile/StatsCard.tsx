import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Trophy, Target, Calendar } from 'lucide-react';
import type { GolfProfile } from '@/lib/golf/social';

interface StatsCardProps {
  profile: GolfProfile;
  className?: string;
}

interface StatItemProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'number' | 'percentage' | 'currency';
}

const formatValue = (value: number | string, format?: 'number' | 'percentage' | 'currency'): string => {
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'percentage':
      return `${value}%`;
    case 'currency':
      return `$${value.toLocaleString()}`;
    case 'number':
    default:
      return value.toLocaleString();
  }
};

const StatItem = ({ label, value, icon, trend, format }: StatItemProps) => {
  const getTrendIcon = () => {
    if (!trend || trend === 'neutral') return null;
    return trend === 'up' ? 
      <TrendingUp className="h-3 w-3 text-green-500" /> : 
      <TrendingDown className="h-3 w-3 text-red-500" />;
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
        {getTrendIcon()}
      </div>
      <span className="font-semibold">{formatValue(value, format)}</span>
    </div>
  );
};

export function StatsCard({ profile, className }: StatsCardProps) {
  const { stats } = profile;

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-600" />
          Golf Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Primary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatItem
            label="Handicap"
            value={profile.handicap}
            icon={<Target className="h-4 w-4 text-blue-600" />}
          />
          <StatItem
            label="Rounds Played"
            value={stats.roundsPlayed}
            icon={<Calendar className="h-4 w-4 text-green-600" />}
          />
          <StatItem
            label="Average Score"
            value={Math.round(stats.averageScore * 10) / 10}
            icon={<Trophy className="h-4 w-4 text-purple-600" />}
          />
          <StatItem
            label="Best Score"
            value={stats.bestScore}
            icon={<TrendingUp className="h-4 w-4 text-red-600" />}
          />
        </div>

        {/* Performance Stats */}
        <div className="mt-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Performance Metrics
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatItem
              label="Fairways Hit"
              value={Math.round(stats.fairwayHitPercentage)}
              icon={<Target className="h-4 w-4 text-green-500" />}
              format="percentage"
            />
            <StatItem
              label="Greens in Regulation"
              value={Math.round(stats.greenInRegulationPercentage)}
              icon={<Target className="h-4 w-4 text-blue-500" />}
              format="percentage"
            />
            <StatItem
              label="Average Putts"
              value={Math.round(stats.averagePutts * 10) / 10}
              icon={<Trophy className="h-4 w-4 text-orange-500" />}
            />
            <StatItem
              label="Eagles"
              value={stats.eagles}
              icon={<Trophy className="h-4 w-4 text-yellow-500" />}
            />
          </div>
        </div>

        {/* Achievement Summary */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Achievement Level</span>
            <Badge variant="secondary" className="ml-2">
              {profile.achievements.length > 20 ? 'Expert' : 
               profile.achievements.length > 10 ? 'Advanced' : 
               profile.achievements.length > 5 ? 'Intermediate' : 'Beginner'}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>{profile.achievements.length} Achievements</span>
            <span>•</span>
            <span>{profile.badges.length} Badges</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}