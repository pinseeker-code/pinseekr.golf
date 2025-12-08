import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { 
  GolfProfile, 
  GolfStats, 
  Badge, 
  Achievement, 
  GolfProfileEvent,
  NOSTR_KINDS,
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_BADGES,
  ProfileUpdateData
} from '@/lib/golf/social';

// Helper functions
const createEmptyStats = (): GolfStats => ({
  roundsPlayed: 0,
  averageScore: 0,
  bestScore: 0,
  worstScore: 0,
  totalStrokes: 0,
  fairwayHitPercentage: 0,
  greenInRegulationPercentage: 0,
  averagePutts: 0,
  holesInOne: 0,
  eagles: 0,
  birdies: 0,
  pars: 0,
  bogeys: 0,
  doubleBogeys: 0,
  tripleBogeyOrWorse: 0,
  lastUpdated: Date.now(),
});

const createDefaultProfile = (pubkey: string, name?: string): GolfProfile => ({
  pubkey,
  name,
  handicap: 0,
  joinedAt: Date.now(),
  stats: createEmptyStats(),
  badges: [
    {
      ...DEFAULT_BADGES.find(b => b.id === 'welcome')!,
      earnedAt: Date.now(),
    }
  ],
  achievements: DEFAULT_ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    progress: 0,
    completed: false,
  })),
  preferences: {
    preferredTees: 'white',
    favoriteFormat: 'stroke-play',
    privacyLevel: 'public',
    shareScores: true,
    shareAchievements: true,
  },
  socialStats: {
    followers: 0,
    following: 0,
    roundsWithFriends: 0,
    matchesWon: 0,
    matchesLost: 0,
  },
});

const parseGolfProfileFromEvent = (event: GolfProfileEvent): GolfProfile | null => {
  try {
    const getName = () => event.tags.find(([name]) => name === 'name')?.[1];
    const getHandicap = () => parseInt(event.tags.find(([name]) => name === 'handicap')?.[1] || '0');
    const getHomeCourse = () => event.tags.find(([name]) => name === 'home_course')?.[1];
    const getStats = () => {
      const statsTag = event.tags.find(([name]) => name === 'stats')?.[1];
      return statsTag ? JSON.parse(statsTag) as GolfStats : createEmptyStats();
    };
    const getBadges = () => {
      const badgesTag = event.tags.find(([name]) => name === 'badges')?.[1];
      return badgesTag ? JSON.parse(badgesTag) as Badge[] : [];
    };
    const getAchievements = () => {
      const achievementsTag = event.tags.find(([name]) => name === 'achievements')?.[1];
      return achievementsTag ? JSON.parse(achievementsTag) as Achievement[] : [];
    };

    const profile: GolfProfile = {
      pubkey: event.pubkey,
      name: getName(),
      handicap: getHandicap(),
      homeCourse: getHomeCourse(),
      joinedAt: event.created_at * 1000,
      stats: getStats(),
      badges: getBadges(),
      achievements: getAchievements(),
      preferences: {
        preferredTees: 'white',
        favoriteFormat: 'stroke-play',
        privacyLevel: 'public',
        shareScores: true,
        shareAchievements: true,
      },
      socialStats: {
        followers: 0,
        following: 0,
        roundsWithFriends: 0,
        matchesWon: 0,
        matchesLost: 0,
      },
    };

    return profile;
  } catch (error) {
    console.error('Failed to parse golf profile from event:', error);
    return null;
  }
};

// Hook for managing golf profiles
export function useGolfProfile(pubkey?: string) {
  const { nostr } = useNostr();
  const _queryClient = useQueryClient();

  return useQuery({
    queryKey: ['golf-profile', pubkey],
    queryFn: async ({ signal }) => {
      if (!pubkey) return null;

      try {
        const events = await nostr.query([
          {
            kinds: [NOSTR_KINDS.GOLF_PROFILE],
            authors: [pubkey],
            '#d': ['golf-profile'],
            limit: 1,
          }
        ], { signal });

        if (events.length > 0) {
          const profile = parseGolfProfileFromEvent(events[0] as GolfProfileEvent);
          return profile;
        }

        // Return null if no profile found - don't auto-create
        return null;
      } catch (error) {
        console.error('Error fetching golf profile:', error);
        return null;
      }
    },
    enabled: !!pubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for creating/updating golf profiles
export function useGolfProfileMutation() {
  const { nostr: _nostr } = useNostr();
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  const createProfileMutation = useMutation({
    mutationFn: async (profileData: { pubkey: string; name?: string } & Partial<GolfProfile>) => {
      const profile = createDefaultProfile(profileData.pubkey, profileData.name);
      
      // Merge any additional data
      Object.assign(profile, profileData);

      publishEvent({
        kind: NOSTR_KINDS.GOLF_PROFILE,
        content: '',
        tags: [
          ['d', 'golf-profile'],
          ['name', profile.name || ''],
          ['handicap', profile.handicap.toString()],
          ['home_course', profile.homeCourse || ''],
          ['stats', JSON.stringify(profile.stats)],
          ['badges', JSON.stringify(profile.badges)],
          ['achievements', JSON.stringify(profile.achievements)],
          ['t', 'golf-profile'],
        ],
      });

      return profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(['golf-profile', profile.pubkey], profile);
      queryClient.invalidateQueries({ queryKey: ['golf-profile'] });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ pubkey, updates }: { pubkey: string; updates: ProfileUpdateData }) => {
      // Get current profile
      const currentProfile = queryClient.getQueryData(['golf-profile', pubkey]) as GolfProfile | null;
      
      if (!currentProfile) {
        throw new Error('Profile not found');
      }

      // Merge updates
      const updatedProfile = { ...currentProfile, ...updates };

      publishEvent({
        kind: NOSTR_KINDS.GOLF_PROFILE,
        content: '',
        tags: [
          ['d', 'golf-profile'],
          ['name', updatedProfile.name || ''],
          ['handicap', updatedProfile.handicap.toString()],
          ['home_course', updatedProfile.homeCourse || ''],
          ['stats', JSON.stringify(updatedProfile.stats)],
          ['badges', JSON.stringify(updatedProfile.badges)],
          ['achievements', JSON.stringify(updatedProfile.achievements)],
          ['t', 'golf-profile'],
        ],
      });

      return updatedProfile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(['golf-profile', profile.pubkey], profile);
      queryClient.invalidateQueries({ queryKey: ['golf-profile'] });
    },
  });

  return {
    createProfile: createProfileMutation.mutateAsync,
    updateProfile: updateProfileMutation.mutateAsync,
    isCreating: createProfileMutation.isPending,
    isUpdating: updateProfileMutation.isPending,
    createError: createProfileMutation.error,
    updateError: updateProfileMutation.error,
  };
}

// Hook for managing profile stats updates
export function useGolfStatsUpdate() {
  const { updateProfile } = useGolfProfileMutation();
  const queryClient = useQueryClient();

  const updateStats = async (pubkey: string, newRoundData: {
    score: number;
    par: number;
    holes: Array<{ score: number; par: number; putts?: number; fairwayHit?: boolean; greenInRegulation?: boolean }>;
  }) => {
    const currentProfile = queryClient.getQueryData(['golf-profile', pubkey]) as GolfProfile | null;
    
    if (!currentProfile) {
      throw new Error('Profile not found');
    }

    const stats = { ...currentProfile.stats };
    
    // Update basic stats
    stats.roundsPlayed += 1;
    stats.totalStrokes += newRoundData.score;
    stats.averageScore = stats.totalStrokes / stats.roundsPlayed;
    
    // Update best/worst scores
    if (stats.bestScore === 0 || newRoundData.score < stats.bestScore) {
      stats.bestScore = newRoundData.score;
    }
    if (newRoundData.score > stats.worstScore) {
      stats.worstScore = newRoundData.score;
    }

    // Calculate hole-by-hole stats
    let fairwaysHit = 0;
    let fairwayAttempts = 0;
    let greensInRegulation = 0;
    let totalPutts = 0;
    let puttsRecorded = 0;

    newRoundData.holes.forEach(hole => {
      // Score tracking
      const scoreToPar = hole.score - hole.par;
      if (scoreToPar <= -3) {
        // Albatross or better (very rare, but possible)
        stats.eagles += 1;
      } else if (scoreToPar === -2) {
        stats.eagles += 1;
      } else if (scoreToPar === -1) {
        stats.birdies += 1;
      } else if (scoreToPar === 0) {
        stats.pars += 1;
      } else if (scoreToPar === 1) {
        stats.bogeys += 1;
      } else if (scoreToPar === 2) {
        stats.doubleBogeys += 1;
      } else if (scoreToPar >= 3) {
        stats.tripleBogeyOrWorse += 1;
      }

      // Hole in one detection
      if (hole.par >= 3 && hole.score === 1) {
        stats.holesInOne += 1;
      }

      // Fairway stats (exclude par 3s)
      if (hole.par > 3) {
        fairwayAttempts += 1;
        if (hole.fairwayHit) fairwaysHit += 1;
      }

      // GIR stats
      if (hole.greenInRegulation) greensInRegulation += 1;

      // Putting stats
      if (hole.putts !== undefined) {
        totalPutts += hole.putts;
        puttsRecorded += 1;
      }
    });

    // Update percentages
    if (fairwayAttempts > 0) {
      const newFairwayPct = (fairwaysHit / fairwayAttempts) * 100;
      stats.fairwayHitPercentage = ((stats.fairwayHitPercentage * (stats.roundsPlayed - 1)) + newFairwayPct) / stats.roundsPlayed;
    }

    const newGirPct = (greensInRegulation / newRoundData.holes.length) * 100;
    stats.greenInRegulationPercentage = ((stats.greenInRegulationPercentage * (stats.roundsPlayed - 1)) + newGirPct) / stats.roundsPlayed;

    if (puttsRecorded > 0) {
      const avgPuttsThisRound = totalPutts / puttsRecorded;
      stats.averagePutts = ((stats.averagePutts * (stats.roundsPlayed - 1)) + avgPuttsThisRound) / stats.roundsPlayed;
    }

    stats.lastUpdated = Date.now();

    // Check for new achievements
    const achievements = [...currentProfile.achievements];
    const badges = [...currentProfile.badges];

    // Update achievements and award badges
    achievements.forEach(achievement => {
      if (!achievement.completed) {
        switch (achievement.id) {
          case 'first-round':
            achievement.progress = Math.min(stats.roundsPlayed, achievement.target);
            break;
          case 'ten-rounds':
          case 'fifty-rounds':
          case 'hundred-rounds':
            achievement.progress = Math.min(stats.roundsPlayed, achievement.target);
            break;
          case 'hole-in-one':
            achievement.progress = Math.min(stats.holesInOne, achievement.target);
            break;
          case 'eagle':
            achievement.progress = Math.min(stats.eagles, achievement.target);
            break;
          case 'under-par':
            if (newRoundData.score < newRoundData.par) {
              achievement.progress = Math.min(achievement.progress + 1, achievement.target);
            }
            break;
        }

        // Check if achievement is completed
        if (achievement.progress >= achievement.target && !achievement.completed) {
          achievement.completed = true;
          achievement.completedAt = Date.now();

          // Award corresponding badge
          const badgeMapping = {
            'first-round': 'first-round-badge',
            'hole-in-one': 'hole-in-one-badge',
            'eagle': 'eagle-badge',
            'under-par': 'under-par-badge',
            'hundred-rounds': 'hundred-rounds-badge',
          } as const;

          const badgeId = badgeMapping[achievement.id as keyof typeof badgeMapping];
          if (badgeId) {
            const badgeTemplate = DEFAULT_BADGES.find(b => b.id === badgeId);
            if (badgeTemplate && !badges.some(b => b.id === badgeId)) {
              badges.push({
                ...badgeTemplate,
                earnedAt: Date.now(),
              });
            }
          }
        }
      }
    });

    // Update profile with new stats, achievements, and badges
    await updateProfile({ 
      pubkey, 
      updates: {
        stats,
        achievements,
        badges,
      }
    });

    return { stats, achievements, badges };
  };

  return { updateStats };
}

// Helper hook to decode pubkey from npub
export function usePubkeyFromNpub(npub?: string) {
  if (!npub) return null;
  
  try {
    if (npub.startsWith('npub')) {
      const decoded = nip19.decode(npub);
      if (decoded.type === 'npub') {
        return decoded.data;
      }
    }
    // If it's already a hex pubkey, return it
    if (npub.length === 64 && /^[a-f0-9]+$/i.test(npub)) {
      return npub;
    }
    return null;
  } catch {
    return null;
  }
}