import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, UserPlus, Search, Hash, Loader2, User, CheckCircle } from 'lucide-react';
import { genUserName } from '@/lib/genUserName';
import { PlayerInRound } from '@/lib/golf/types';
import { useContacts } from '@/hooks/useContacts';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useToast } from '@/hooks/useToast';
import { nip19 } from 'nostr-tools';

interface AddPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddPlayer: (player: PlayerInRound) => void;
  existingPlayers: PlayerInRound[];
}

export const AddPlayerDialog: React.FC<AddPlayerDialogProps> = ({
  open,
  onOpenChange,
  onAddPlayer,
  existingPlayers
}) => {
  const [manualName, setManualName] = useState('');
  const [nostrPubkey, setNostrPubkey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [validatedPubkey, setValidatedPubkey] = useState<string | null>(null);
  const [pubkeyError, setPubkeyError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const { user } = useCurrentUser();
  const { data: contacts, isLoading: contactsLoading, error: contactsError } = useContacts();
  const { toast } = useToast();
  
  // Fetch profile data for the validated pubkey
  const { data: profileData } = useAuthor(validatedPubkey || '');

  // Validate npub input and extract pubkey
  useEffect(() => {
    const validateInput = async () => {
      const trimmedValue = nostrPubkey.trim();
      
      if (!trimmedValue) {
        setValidatedPubkey(null);
        setPubkeyError(null);
        setIsValidating(false);
        return;
      }

      setIsValidating(true);
      setPubkeyError(null);

      try {
        let pubkey: string;

        if (trimmedValue.startsWith('npub1')) {
          // Decode npub
          const decoded = nip19.decode(trimmedValue);
          if (decoded.type !== 'npub') {
            throw new Error('Invalid npub format');
          }
          pubkey = decoded.data;
        } else if (trimmedValue.match(/^[a-f0-9]{64}$/i)) {
          // Already a hex pubkey
          pubkey = trimmedValue.toLowerCase();
        } else {
          throw new Error('Please enter a valid npub (npub1...) or hex pubkey');
        }

        // Check if player already exists
        const existingPlayer = existingPlayers.find(p => p.playerId === pubkey);
        if (existingPlayer) {
          throw new Error('This player is already in the round');
        }

        setValidatedPubkey(pubkey);
        setIsValidating(false);

      } catch (error) {
        setPubkeyError(error instanceof Error ? error.message : 'Invalid input');
        setValidatedPubkey(null);
        setIsValidating(false);
      }
    };

    // Debounce validation
    const timeoutId = setTimeout(validateInput, 500);
    return () => clearTimeout(timeoutId);
  }, [nostrPubkey, existingPlayers]);

  const handleAddManualPlayer = () => {
    if (!manualName.trim()) return;

    const newPlayer: PlayerInRound = {
      playerId: `player-${Date.now()}`,
      name: manualName.trim(),
      handicap: 0,
      scores: [],
      total: 0,
      netTotal: 0
    };

    onAddPlayer(newPlayer);
    setManualName('');
    onOpenChange(false);
  };

  const handleAddNostrPlayer = (friend: { pubkey: string; name?: string; picture?: string }) => {
    const newPlayer: PlayerInRound = {
      playerId: friend.pubkey,
      name: friend.name || genUserName(friend.pubkey),
      handicap: 0,
      scores: [],
      total: 0,
      netTotal: 0
    };

    onAddPlayer(newPlayer);
    onOpenChange(false);
  };

  const handleAddByPubkey = () => {
    if (!validatedPubkey) return;

    // Use actual Nostr profile data if available
    const displayName = profileData?.metadata?.name || 
                       profileData?.metadata?.display_name || 
                       genUserName(validatedPubkey);

    const newPlayer: PlayerInRound = {
      playerId: validatedPubkey,
      name: displayName,
      handicap: 0,
      scores: [],
      total: 0,
      netTotal: 0
    };

    onAddPlayer(newPlayer);

    // Player added — share join link manually (QR code / copy link)
    toast({ title: 'Player added', description: `Share the round code or QR with ${displayName} to invite them` });

    setNostrPubkey('');
    setValidatedPubkey(null);
    setPubkeyError(null);
    onOpenChange(false);
  };

  const filteredFriends = (contacts || []).filter(friend =>
    !existingPlayers.some(player => player.playerId === friend.pubkey) &&
    (friend.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Add Player to Round</span>
          </DialogTitle>
          <DialogDescription>
            Add friends from Nostr or enter a name manually
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">Nostr Friends</TabsTrigger>
            <TabsTrigger value="search">By Pubkey</TabsTrigger>
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="friend-search">Search Friends</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="friend-search"
                  placeholder="Search your Nostr friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {!user ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Connect your Nostr identity</p>
                  <p className="text-sm">Login to see your Nostr contacts</p>
                </div>
              ) : contactsLoading ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-8 w-12" />
                  </div>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-8 w-12" />
                  </div>
                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-12" />
                  </div>
                </div>
              ) : contactsError ? (
                <div className="text-center py-8 text-red-500">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Failed to load contacts</p>
                  <p className="text-sm">Check your connection and try again</p>
                </div>
              ) : filteredFriends.length > 0 ? (
                filteredFriends.map((friend) => (
                  <div key={friend.pubkey} className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={friend.picture || undefined} />
                          <AvatarFallback>{(friend.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{friend.name || genUserName(friend.pubkey)}</p>
                          <p className="text-xs text-gray-500">{friend.pubkey.slice(0, 16)}...</p>
                          {friend.nip05 && (
                            <p className="text-xs text-blue-500">✓ {friend.nip05}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddNostrPlayer(friend)}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No contacts found</p>
                  <p className="text-sm">
                    {searchQuery ? 'Try a different search term' : 'Add friends on Nostr to see them here'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pubkey">Nostr Public Key</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="pubkey"
                  placeholder="npub1... or hex pubkey"
                  value={nostrPubkey}
                  onChange={(e) => setNostrPubkey(e.target.value)}
                  className={`pl-10 ${pubkeyError ? "border-destructive" : ""}`}
                />
                {isValidating && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              {pubkeyError && (
                <p className="text-sm text-destructive">{pubkeyError}</p>
              )}
              
              {/* Profile Preview */}
              {validatedPubkey && profileData?.metadata && (
                <div className="flex items-center space-x-3 p-3 bg-muted rounded-md">
                  {profileData.metadata.picture ? (
                    <img 
                      src={profileData.metadata.picture} 
                      alt="Profile" 
                      className="h-8 w-8 rounded-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {profileData.metadata.name || profileData.metadata.display_name || genUserName(validatedPubkey)}
                    </p>
                    {profileData.metadata.about && (
                      <p className="text-xs text-muted-foreground truncate">
                        {profileData.metadata.about}
                      </p>
                    )}
                  </div>
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                </div>
              )}
              
              <p className="text-xs text-gray-500">
                Enter a Nostr public key to add that user to the round
              </p>
            </div>
            <Button 
              onClick={handleAddByPubkey} 
              disabled={!validatedPubkey} 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Player by Pubkey
            </Button>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="player-name">Player Name</Label>
              <Input
                id="player-name"
                placeholder="Enter player name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddManualPlayer()}
              />
            </div>
            <Button 
              onClick={handleAddManualPlayer} 
              disabled={!manualName.trim()} 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-300 disabled:text-gray-500"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Player
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
