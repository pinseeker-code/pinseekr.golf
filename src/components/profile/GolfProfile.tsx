import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Calendar, 
  Trophy, 
 
  Edit, 
  UserPlus,
  MessageCircle,
  MoreHorizontal 
} from 'lucide-react';
import { BadgeDisplay } from './BadgeDisplay';
import { StatsCard } from './StatsCard';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { GolfProfile as GolfProfileType } from '@/lib/golf/social';
import type { NostrMetadata } from '@nostrify/nostrify';

interface GolfProfileProps {
  profile: GolfProfileType;
  metadata?: NostrMetadata;
  isOwn?: boolean;
  className?: string;
}

const ProfileHeader = ({ 
  profile, 
  metadata, 
  isOwn 
}: { 
  profile: GolfProfileType; 
  metadata?: NostrMetadata; 
  isOwn?: boolean;
}) => {
  const displayName = metadata?.display_name || metadata?.name || profile.displayName || profile.name;
  const bio = metadata?.about || profile.bio;
  const profileImage = metadata?.picture;

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Avatar and Basic Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="text-2xl">
                {displayName?.[0]?.toUpperCase() || 'G'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold">{displayName || 'Golf Player'}</h1>
              {bio && (
                <p className="text-muted-foreground mt-2 max-w-md">{bio}</p>
              )}
              
              {/* Location and Course Info */}
              <div className="flex flex-col sm:flex-row gap-4 mt-4 text-sm text-muted-foreground">
                {profile.homeLocation && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{profile.homeLocation}</span>
                  </div>
                )}
                {profile.homeCourse && (
                  <div className="flex items-center gap-1">
                    <Trophy className="h-4 w-4" />
                    <span>Home: {profile.homeCourse}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Joined {new Date(profile.joinedAt * 1000).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col gap-2 sm:ml-auto">
            {isOwn ? (
              <Button size="sm" className="gap-2">
                <Edit className="h-4 w-4" />
                Edit Profile
              </Button>
            ) : (
              <>
                <Button size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Follow
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Message
                </Button>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Handicap and Social Stats */}
        <div className="flex flex-wrap gap-6 mt-6 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{profile.handicap}</div>
            <div className="text-sm text-muted-foreground">Handicap</div>
          </div>
          <Separator orientation="vertical" className="h-12" />
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.socialStats.followers}</div>
            <div className="text-sm text-muted-foreground">Followers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.socialStats.following}</div>
            <div className="text-sm text-muted-foreground">Following</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{profile.socialStats.roundsWithFriends}</div>
            <div className="text-sm text-muted-foreground">Rounds with Friends</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {profile.socialStats.matchesWon}
            </div>
            <div className="text-sm text-muted-foreground">Wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {profile.socialStats.matchesLost}
            </div>
            <div className="text-sm text-muted-foreground">Losses</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export function GolfProfile({ profile, metadata, isOwn, className }: GolfProfileProps) {
  const { user } = useCurrentUser();
  const actualIsOwn = isOwn ?? (user?.pubkey === profile.pubkey);

  return (
    <div className={`space-y-6 ${className || ''}`}>
      <ProfileHeader 
        profile={profile} 
        metadata={metadata} 
        isOwn={actualIsOwn}
      />
      
      {/* Stats and Badges Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatsCard profile={profile} />
        <BadgeDisplay 
          badges={profile.badges} 
          showAll={false}
          maxDisplay={6}
        />
      </div>
      
      {/* Recent Achievement Highlights */}
      {profile.achievements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              Recent Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile.achievements
                .sort((a, b) => b.completedAt! - a.completedAt!)
                .slice(0, 6)
                .map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <Trophy className="h-8 w-8 text-yellow-600" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{achievement.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {achievement.completedAt && 
                          new Date(achievement.completedAt * 1000).toLocaleDateString()
                        }
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}