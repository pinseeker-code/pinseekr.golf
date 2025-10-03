import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, UserPlus, Search, Hash } from 'lucide-react';
import { genUserName } from '@/lib/genUserName';
import { PlayerInRound } from '@/lib/golf/types';

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

  // TODO: Replace with actual contacts hook when available
  // const { data: contacts } = useContacts();
  
  // Mock Nostr friends data - future implementation will use kind 3 contact lists
  const mockNostrFriends = [
    { pubkey: 'npub1abc123def456ghi789', name: 'Alice Cooper', picture: null },
    { pubkey: 'npub1def456ghi789abc123', name: 'Bob Wilson', picture: null },
    { pubkey: 'npub1ghi789abc123def456', name: 'Charlie Brown', picture: null },
    { pubkey: 'npub1jkl012mno345pqr678', name: 'Diana Prince', picture: null },
  ];

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

  const handleAddNostrPlayer = (friend: { pubkey: string; name: string; picture: string | null }) => {
    const newPlayer: PlayerInRound = {
      playerId: friend.pubkey,
      name: friend.name,
      handicap: 0,
      scores: [],
      total: 0,
      netTotal: 0
    };

    onAddPlayer(newPlayer);
    onOpenChange(false);
  };

  const handleAddByPubkey = () => {
    if (!nostrPubkey.trim()) return;

    // Future enhancement: integrate with Nostr profile metadata (kind 0 events)
    const newPlayer: PlayerInRound = {
      playerId: nostrPubkey.trim(),
      name: genUserName(nostrPubkey.trim()),
      handicap: 0,
      scores: [],
      total: 0,
      netTotal: 0
    };

    onAddPlayer(newPlayer);
    setNostrPubkey('');
    onOpenChange(false);
  };

  const filteredFriends = mockNostrFriends.filter(friend =>
    !existingPlayers.some(player => player.playerId === friend.pubkey) &&
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
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
              {filteredFriends.length > 0 ? (
                filteredFriends.map((friend) => (
                  <div key={friend.pubkey} className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={friend.picture || undefined} />
                          <AvatarFallback>{friend.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{friend.name}</p>
                          <p className="text-xs text-gray-500">{friend.pubkey.slice(0, 16)}...</p>
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
                  <p>No friends found</p>
                  <p className="text-sm">Try searching or add friends on Nostr first</p>
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
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-gray-500">
                Enter a Nostr public key to add that user to the round
              </p>
            </div>
            <Button 
              onClick={handleAddByPubkey} 
              disabled={!nostrPubkey.trim()} 
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
