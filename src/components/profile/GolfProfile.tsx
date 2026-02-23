import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Trophy,
  UserPlus,
  MessageCircle,
  MoreHorizontal,
  Flag,
  BarChart2,
  Settings,
  CheckCircle2,
  Ban,
  ListChecks,
  X,
} from 'lucide-react';
import { EditGolfProfile } from './EditGolfProfile';
import { EditProfileForm } from '@/components/EditProfileForm';
import { StatsCard } from './StatsCard';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserBadges, useBadgeStats } from '@/hooks/useUserBadges';
import { useRoundHistory } from '@/hooks/useRoundHistory';
import type { RoundHistoryItem } from '@/hooks/useRoundHistory';
import { useRoundMutations } from '@/hooks/useRoundMutations';
import type { GolfProfile as GolfProfileType } from '@/lib/golf/social';
import type { NostrMetadata } from '@nostrify/nostrify';

interface GolfProfileProps {
  profile: GolfProfileType;
  metadata?: NostrMetadata;
  isOwn?: boolean;
  className?: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const ProfileHeader = ({
  profile,
  metadata,
}: {
  profile: GolfProfileType;
  metadata?: NostrMetadata;
}) => {
  const displayName = metadata?.display_name || metadata?.name || profile.displayName || profile.name;
  const bio = metadata?.about || profile.bio;
  const profileImage = metadata?.picture;

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <Avatar className="h-24 w-24 sm:h-28 sm:w-28">
              <AvatarImage src={profileImage} alt={displayName} />
              <AvatarFallback className="text-2xl">
                {displayName?.[0]?.toUpperCase() || 'G'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold">{displayName || 'Golf Player'}</h1>
              {bio && <p className="text-muted-foreground mt-2 max-w-md text-sm">{bio}</p>}

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
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
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Badges section (shown at bottom of Stats tab) ───────────────────────────

const rarityColor: Record<string, string> = {
  legendary: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  epic: 'bg-purple-100 text-purple-800 border-purple-300',
  rare: 'bg-blue-100 text-blue-800 border-blue-300',
  common: 'bg-gray-100 text-gray-700 border-gray-300',
};

const BadgesSection = ({ pubkey }: { pubkey: string }) => {
  const { data: badges, isLoading } = useUserBadges(pubkey);
  const stats = useBadgeStats(pubkey);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!badges || badges.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Badges</h3>
      <div className="flex flex-wrap gap-2">
        {stats.legendary > 0 && <Badge variant="outline" className={rarityColor.legendary}>⭐ {stats.legendary} Legendary</Badge>}
        {stats.epic > 0 && <Badge variant="outline" className={rarityColor.epic}>💎 {stats.epic} Epic</Badge>}
        {stats.rare > 0 && <Badge variant="outline" className={rarityColor.rare}>🔷 {stats.rare} Rare</Badge>}
        {stats.common > 0 && <Badge variant="outline" className={rarityColor.common}>🏅 {stats.common} Common</Badge>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {badges.map((badge) => {
          const rarity = (badge.metadata.rarity as string) ?? 'common';
          const name = (badge.metadata.name as string) ?? badge.badgeId;
          const description = badge.metadata.description as string | undefined;
          return (
            <div
              key={badge.badgeId + badge.issuedAt}
              className={`flex items-center gap-3 p-3 rounded-lg border ${rarityColor[rarity] ?? rarityColor.common}`}
            >
              <Trophy className="h-8 w-8 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{name}</div>
                {description && (
                  <div className="text-xs opacity-75 truncate">{description}</div>
                )}
                <div className="text-xs opacity-60 mt-0.5">
                  {new Date(badge.issuedAt * 1000).toLocaleDateString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Rounds Tab ───────────────────────────────────────────────────────────────

const RoundsTab = ({ pubkey, isOwn }: { pubkey: string; isOwn?: boolean }) => {
  const { data: rounds, isLoading } = useRoundHistory(pubkey);
  const { endRound, cancelRound, isEnding, isCancelling } = useRoundMutations();
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<{
    rounds: RoundHistoryItem[];
    type: 'end' | 'cancel';
  } | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  const allRounds = rounds ?? [];
  const visibleRounds =
    isOwn && !showCancelled
      ? allRounds.filter((r) => r.status !== 'cancelled')
      : allRounds;
  const activeVisible = visibleRounds.filter((r) => r.status === 'active');
  const selectedRounds = visibleRounds.filter((r) => selectedIds.has(r.roundId));
  const allActiveSelected = activeVisible.length > 0 && activeVisible.every((r) => selectedIds.has(r.roundId));

  const toggleSelect = (roundId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(roundId)) next.delete(roundId);
      else next.add(roundId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allActiveSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeVisible.map((r) => r.roundId)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    const { rounds: targets, type } = pendingAction;
    setPendingAction(null);
    exitSelectMode();
    for (const round of targets) {
      if (type === 'end') {
        await endRound({ round, ownerPubkey: pubkey });
      } else {
        await cancelRound({ round, ownerPubkey: pubkey });
      }
    }
  };

  return (
    <>
      {/* Toolbar */}
      {isOwn && (
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2">
            {selectMode && activeVisible.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id="select-all"
                  checked={allActiveSelected}
                  onCheckedChange={toggleSelectAll}
                />
                <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer select-none">
                  {allActiveSelected ? 'Deselect all' : 'Select all active'}
                </label>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {allRounds.some((r) => r.status === 'cancelled') && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setShowCancelled((s) => !s)}
              >
                {showCancelled ? 'Hide cancelled' : 'Show cancelled'}
              </Button>
            )}
            <Button
              variant={selectMode ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            >
              {selectMode ? <X className="h-3.5 w-3.5" /> : <ListChecks className="h-3.5 w-3.5" />}
              {selectMode ? 'Cancel' : 'Select'}
            </Button>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-muted border">
          <span className="text-sm font-medium flex-1">{selectedIds.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-green-700 border-green-400 hover:bg-green-50"
            onClick={() => setPendingAction({ rounds: selectedRounds, type: 'end' })}
            disabled={isEnding || isCancelling}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => setPendingAction({ rounds: selectedRounds, type: 'cancel' })}
            disabled={isEnding || isCancelling}
          >
            <Ban className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      )}

      {visibleRounds.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Flag className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No rounds recorded yet</p>
          <p className="text-sm mt-1">Start a round to see your history</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRounds.map((round) => {
            const isSelected = selectedIds.has(round.roundId);
            const isActive = round.status === 'active';
            return (
              <Card
                key={round.roundId}
                className={`transition-colors ${
                  round.status === 'cancelled' ? 'opacity-60' : ''
                } ${
                  isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {/* Checkbox in select mode (active rounds only) */}
                    {selectMode && isActive && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(round.roundId)}
                        className="shrink-0"
                      />
                    )}
                    {selectMode && !isActive && (
                      <div className="w-4 shrink-0" />
                    )}

                    {/* Card body — link or div depending on select mode */}
                    {selectMode ? (
                      <div
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        onClick={() => isActive && toggleSelect(round.roundId)}
                      >
                        <Flag className="h-5 w-5 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{round.courseName}</div>
                          <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                            <span>{new Date(round.date).toLocaleDateString()}</span>
                            <span>·</span>
                            <span className="capitalize">{round.gameMode.replace(/-/g, ' ')}</span>
                            <span>·</span>
                            <span>{round.playerCount} players</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 mr-1">
                          {round.topGross != null && (
                            <div className="text-sm font-semibold">{round.topGross}</div>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${
                              round.status === 'completed'
                                ? 'border-green-400 text-green-700'
                                : round.status === 'cancelled'
                                  ? 'border-red-300 text-red-600'
                                  : 'border-yellow-400 text-yellow-700'
                            }`}
                          >
                            {round.status}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <Link
                        to={`/round/${round.roundId}`}
                        className="flex items-center gap-3 flex-1 min-w-0"
                      >
                        <Flag className="h-5 w-5 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{round.courseName}</div>
                          <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                            <span>{new Date(round.date).toLocaleDateString()}</span>
                            <span>·</span>
                            <span className="capitalize">{round.gameMode.replace(/-/g, ' ')}</span>
                            <span>·</span>
                            <span>{round.playerCount} players</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 mr-1">
                          {round.topGross != null && (
                            <div className="text-sm font-semibold">{round.topGross}</div>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${
                              round.status === 'completed'
                                ? 'border-green-400 text-green-700'
                                : round.status === 'cancelled'
                                  ? 'border-red-300 text-red-600'
                                  : 'border-yellow-400 text-yellow-700'
                            }`}
                          >
                            {round.status}
                          </Badge>
                        </div>
                      </Link>
                    )}

                    {/* Per-item action menu (not in select mode) */}
                    {!selectMode && isOwn && isActive && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setPendingAction({ rounds: [round], type: 'end' })}
                            className="gap-2"
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Mark as Completed
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setPendingAction({ rounds: [round], type: 'cancel' })}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Ban className="h-4 w-4" />
                            Cancel Round
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === 'end'
                ? `Mark ${(pendingAction?.rounds.length ?? 0) > 1 ? `${pendingAction?.rounds.length} rounds` : 'round'} as completed?`
                : `Cancel ${(pendingAction?.rounds.length ?? 0) > 1 ? `${pendingAction?.rounds.length} rounds` : 'this round'}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === 'end'
                ? 'This will publish updated Nostr events marking each round as completed.'
                : 'This will publish updated Nostr events marking each round as cancelled. They will be hidden by default.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isEnding || isCancelling}
              className={pendingAction?.type === 'cancel' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {pendingAction?.type === 'end' ? 'Mark Completed' : 'Cancel Round(s)'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ─── Settings Tab ────────────────────────────────────────────────────────────

const SettingsTab = ({ profile }: { profile: GolfProfileType }) => (
  <div className="space-y-8">
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Golf Profile &amp; Preferences
      </h3>
      <EditGolfProfile profile={profile} />
    </div>
    <Separator />
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Nostr Profile
      </h3>
      <EditProfileForm />
    </div>
  </div>
);

// ─── Main export ─────────────────────────────────────────────────────────────

export function GolfProfile({ profile, metadata, isOwn, className }: GolfProfileProps) {
  const { user } = useCurrentUser();
  const actualIsOwn = isOwn ?? (user?.pubkey === profile.pubkey);

  return (
    <div className={`space-y-4 ${className || ''}`}>
      <ProfileHeader profile={profile} metadata={metadata} />

      {/* Social action buttons for other users */}
      {!actualIsOwn && (
        <div className="flex gap-2">
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
        </div>
      )}

      <Tabs defaultValue="stats" className="w-full">
        <TabsList className={`grid w-full ${actualIsOwn ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="stats" className="gap-1.5">
            <BarChart2 className="h-4 w-4" />
            <span className="hidden sm:inline">Stats</span>
          </TabsTrigger>
          <TabsTrigger value="rounds" className="gap-1.5">
            <Flag className="h-4 w-4" />
            <span className="hidden sm:inline">Rounds</span>
          </TabsTrigger>
          {actualIsOwn && (
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="stats" className="mt-4 space-y-6">
          <StatsCard profile={profile} />
          <BadgesSection pubkey={profile.pubkey} />
        </TabsContent>

        <TabsContent value="rounds" className="mt-4">
          <RoundsTab pubkey={profile.pubkey} isOwn={actualIsOwn} />
        </TabsContent>

        {actualIsOwn && (
          <TabsContent value="settings" className="mt-4">
            <SettingsTab profile={profile} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}