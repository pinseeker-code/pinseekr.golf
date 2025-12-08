import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GolfProfile } from '@/components/profile/GolfProfile';
import { useGolfProfile } from '@/hooks/useGolfProfile';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';

function ProfileSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      {/* Profile Header Skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <Skeleton className="h-24 w-24 sm:h-32 sm:w-32 rounded-full" />
              <div className="flex-1 text-center sm:text-left space-y-3">
                <Skeleton className="h-8 w-48 mx-auto sm:mx-0" />
                <Skeleton className="h-4 w-64 mx-auto sm:mx-0" />
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:ml-auto">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats and Badges Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-6 w-24" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center p-3 rounded-lg border space-y-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfileNotFound() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Card className="text-center py-12">
        <CardContent>
          <h2 className="text-2xl font-semibold mb-2">Profile Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This golf profile doesn't exist or hasn't been set up yet.
          </p>
          <a 
            href="/"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Return Home
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProfilePage() {
  const { nip19Id } = useParams<{ nip19Id: string }>();
  const { user: currentUser } = useCurrentUser();

  // Decode the NIP-19 identifier to get the pubkey
  const pubkeyQuery = useQuery({
    queryKey: ['decode-nip19', nip19Id],
    queryFn: () => {
      if (!nip19Id) throw new Error('No NIP-19 identifier provided');
      
      try {
        const decoded = nip19.decode(nip19Id);
        
        if (decoded.type === 'npub') {
          return decoded.data as string;
        } else if (decoded.type === 'nprofile') {
          return decoded.data.pubkey;
        } else {
          throw new Error('Invalid identifier type for profile');
        }
      } catch {
        throw new Error('Invalid NIP-19 identifier');
      }
    },
    enabled: !!nip19Id,
    retry: false,
  });

  // Get the golf profile data
  const { 
    data: profile, 
    isLoading: profileLoading, 
    error: _profileError 
  } = useGolfProfile(pubkeyQuery.data);

  // Get the Nostr metadata
  const author = useAuthor(pubkeyQuery.data || '');
  const metadata = author.data?.metadata;

  // Handle loading states
  if (!nip19Id) {
    return <Navigate to="/404" replace />;
  }

  if (pubkeyQuery.isLoading || profileLoading) {
    return <ProfileSkeleton />;
  }

  if (pubkeyQuery.error || _profileError || !profile) {
    return <ProfileNotFound />;
  }

  // Determine if this is the current user's profile
  const isOwnProfile = currentUser?.pubkey === pubkeyQuery.data;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <GolfProfile 
        profile={profile}
        metadata={metadata}
        isOwn={isOwnProfile}
      />
    </div>
  );
};

export default ProfilePage;