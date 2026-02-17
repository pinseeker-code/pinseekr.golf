import React, { useState } from 'react';
import { BadgeService } from '@/lib/golf/badgeSystem';
import { BadgeDefinition } from '@/lib/golf/types';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserBadges, useBadgeStats } from '@/hooks/useUserBadges';
import MobileContainer from '@/components/MobileContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge as BadgeUI } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trophy, Star, Award, Target, LogIn } from 'lucide-react';
import { Layout } from '@/components/Layout';

export const AchievementsPage: React.FC = () => {
  const { user } = useCurrentUser();
  const [badgeService] = useState(() => new BadgeService());
  const [allBadges] = useState<BadgeDefinition[]>(badgeService.getBadgeDefinitions());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch user's earned badges from Nostr
  const { data: earnedBadges, isLoading: badgesLoading, error: badgesError } = useUserBadges(user?.pubkey);
  const badgeStats = useBadgeStats(user?.pubkey);

  const categories = [
    { id: 'all', name: 'All', icon: <Trophy className="h-4 w-4" /> },
    { id: 'scoring', name: 'Scoring', icon: <Target className="h-4 w-4" /> },
    { id: 'participation', name: 'Participation', icon: <Star className="h-4 w-4" /> },
    { id: 'social', name: 'Social', icon: <Award className="h-4 w-4" /> },
    { id: 'milestones', name: 'Milestones', icon: <Trophy className="h-4 w-4" /> },
  ];

  const filteredBadges = selectedCategory === 'all'
    ? allBadges
    : allBadges.filter(badge => badge.category === selectedCategory);

  const rarityColors = {
    common: 'bg-gray-100 text-gray-800 border-gray-200',
    rare: 'bg-purple-100 text-purple-800 border-purple-200',
    epic: 'bg-amber-100 text-amber-800 border-amber-200',
    legendary: 'bg-yellow-100 text-yellow-800 border-yellow-200'
  };

  const rarityIcons = {
    common: <Star className="h-4 w-4 text-gray-400" />,
    rare: <Star className="h-4 w-4 text-purple-400" />,
    epic: <Star className="h-4 w-4 text-amber-400" />,
    legendary: <Star className="h-4 w-4 text-yellow-400" />
  };

  const isBadgeEarned = (badgeId: string): boolean => {
    return !!earnedBadges && earnedBadges.some(award => award.badgeId === badgeId);
  };

  const getEarnedDate = (badgeId: string): string | null => {
    if (!earnedBadges) return null;
    const award = earnedBadges.find(a => a.badgeId === badgeId);
    return award ? new Date(award.issuedAt).toLocaleDateString() : null;
  };

  // Show login prompt if not logged in
  if (!user) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8">
          <MobileContainer>
            <Alert>
              <LogIn className="h-4 w-4" />
              <AlertDescription>
                Please log in to view your golf achievements and earned badges.
              </AlertDescription>
            </Alert>
          </MobileContainer>
        </div>
      </Layout>
    );
  }

  // Show loading state
  if (badgesLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8">
          <MobileContainer>
            <div className="max-w-6xl mx-auto space-y-6">
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
              <Skeleton className="h-12 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            </div>
          </MobileContainer>
        </div>
      </Layout>
    );
  }

  // Show error state
  if (badgesError) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8">
          <MobileContainer>
            <Alert variant="destructive">
              <AlertDescription>
                Failed to load achievements. Please try again later.
              </AlertDescription>
            </Alert>
          </MobileContainer>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8">
        <MobileContainer>
          <div>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Golf Achievements
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Earn badges for your golf accomplishments and share them with your network
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {badgeStats.total}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Badges Earned
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {badgeStats.legendary}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Legendary
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {badgeStats.epic}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Epic
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {Math.round((badgeStats.total / allBadges.length) * 100)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Complete
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-8">
            <TabsList className="grid w-full grid-cols-5">
              {categories.map((category) => (
                <TabsTrigger key={category.id} value={category.id} className="flex items-center space-x-2">
                  {category.icon}
                  <span>{category.name}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Badges Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBadges.map((badge) => {
              const isEarned = isBadgeEarned(badge.id);
              const earnedDate = getEarnedDate(badge.id);

              return (
                <Card
                  key={badge.id}
                  className={`transition-all hover:shadow-md ${
                    isEarned ? 'ring-2 ring-yellow-500 bg-yellow-50 dark:bg-yellow-950' : 'opacity-75'
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-3xl">{badge.icon}</div>
                        <div>
                          <CardTitle className="flex items-center space-x-2">
                            <span>{badge.name}</span>
                            <BadgeUI className={rarityColors[badge.rarity]}>
                              {badge.rarity}
                            </BadgeUI>
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {badge.description}
                          </CardDescription>
                        </div>
                      </div>
                      {isEarned && (
                        <div className="flex items-center space-x-1 text-yellow-600">
                          {rarityIcons[badge.rarity]}
                          <Star className="h-4 w-4 fill-current" />
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-3">
                      {isEarned && earnedDate && (
                        <div className="text-sm text-yellow-600 dark:text-yellow-400">
                          Earned on {earnedDate}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {badge.criteria.type.replace('-', ' ')}
                        </div>

                        {isEarned ? (
                          <Button variant="outline" size="sm">
                            Share Achievement
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled>
                            Locked
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredBadges.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold mb-2">No badges found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Try selecting a different category
                </p>
              </CardContent>
            </Card>
          )}

          {/* Progress Footer */}
          <div className="mt-12 text-center">
            <div className="mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Progress: {badgeStats.total} of {allBadges.length} badges earned
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(badgeStats.total / allBadges.length) * 100}%` }}
                />
              </div>
            </div>

            <Button variant="outline">
              Share Achievement Progress
            </Button>
          </div>
          </div>
        </div>
      </MobileContainer>
    </div>
  </Layout>
  );
};

export default AchievementsPage;