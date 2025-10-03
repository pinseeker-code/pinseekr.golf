import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { GameModeSelector } from '@/components/scoring/GameModeSelector';
import { ScoreCard } from '@/components/scoring/ScoreCard';
import { GameMode, GolfRound, PlayerInRound } from '@/lib/golf/types';
import { generateRoundId, createRoundEvent, createGameEvent } from '@/lib/golf/nostrEvents';
import {
  createPinseekrCup,
  type PinseekrCupPlayer,
  type PinseekrCupConfig
} from '@/lib/golf/pinseekrCupEngine';
import { Plus, Users, Calendar, QrCode, Trophy, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CourseSearch } from '@/components/course/CourseSearch';
import { Layout } from '@/components/Layout';
import { genUserName } from '@/lib/genUserName';
import { AddPlayerDialog } from '@/components/AddPlayerDialog';
import QRCode from 'qrcode';

// Pinseekr Cup Types
type PinseekrCupFormat = 'foursomes' | 'fourballs' | 'singles' | 'stroke' | 'stableford' | 'scramble';

// Format descriptions for UI
const formatDescriptions: Record<PinseekrCupFormat, string> = {
  foursomes: 'Two players per team, alternate shots on same ball',
  fourballs: 'Two players per team, each plays own ball, best score counts',
  singles: 'Individual match play between players',
  stroke: 'Traditional stroke play counting total strokes',
  stableford: 'Points-based system (par=2, birdie=3, eagle=4, etc.)',
  scramble: 'Team format where all players tee off, play best shot'
};

// Format display names with clarifications
const formatDisplayNames: Record<PinseekrCupFormat, string> = {
  foursomes: 'Foursome (Alternate Shot)',
  fourballs: 'Fourballs (Best Ball)',
  singles: 'Singles (Match)',
  stroke: 'Stroke',
  stableford: 'Stableford',
  scramble: 'Scramble'
};

// Fixed tournament preset configurations
const presetConfigurations = {
  'ryder-cup': {
    name: 'Pinseekr Cup',
    description: 'Classic Ryder Cup format: team-based progression from Foursome (Alternate Shot) to Fourballs (Best Ball) to Singles',
    formatOrder: ['foursomes', 'fourballs', 'singles'] as PinseekrCupFormat[]
  },
  'trad-golf': {
    name: 'Trad-Golf', 
    description: 'Traditional golf progression: objective scoring to points-based to head-to-head competition',
    formatOrder: ['stroke', 'stableford', 'singles'] as PinseekrCupFormat[]
  },
  'duffers-delight': {
    name: 'Duffers Delight',
    description: 'Fun progression: collaborative Scramble to challenging Foursome (Alternate Shot) to strategic Fourballs (Best Ball)', 
    formatOrder: ['scramble', 'foursomes', 'fourballs'] as PinseekrCupFormat[]
  },
  'custom': {
    name: 'Custom',
    description: 'Build your own 3-format tournament with complete customization',
    formatOrder: [] as PinseekrCupFormat[]
  }
};

interface GameModes {
  strokePlay: boolean;
  matchPlay: boolean;
  nassau: boolean;
  skins: boolean;
  dots: boolean;
  snake: boolean;
  points: boolean;
  wolf: boolean;
  pinseekrCup: boolean;
}

export const NewRoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { mutate: publishEvent } = useNostrPublish();
  const { toast } = useToast();
  const { user, metadata } = useCurrentUser();

  const [step, setStep] = useState<'setup' | 'scoring'>('setup');
  const [round, setRound] = useState<Partial<GolfRound>>({
    id: generateRoundId(),
    date: Date.now(),
    players: [],
    gameMode: GameMode.STROKE_PLAY,
    holes: [],
    status: 'active',
    metadata: {
      courseName: '',
      courseLocation: '',
      teeBox: '',
      weather: '',
      notes: ''
    }
  });

  const [selectedCourse, setSelectedCourse] = useState<{ id: string; name: string; location: string } | null>(null);
  const [selectedMode, setSelectedMode] = useState<GameMode>(GameMode.STROKE_PLAY);
  const [roundCode, setRoundCode] = useState<string>('');
  const [showRoundCode, setShowRoundCode] = useState<boolean>(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState<boolean>(false);

  // Game mode states
  const [selectedGameModes, setSelectedGameModes] = useState<GameModes>({
    strokePlay: true,
    matchPlay: false,
    nassau: false,
    skins: false,
    dots: false,
    snake: false,
    points: false,
    wolf: false,
    pinseekrCup: false
  });

  // Pinseekr Cup state
  const [tournament, setTournament] = useState<PinseekrCupConfig | null>(null);
  const [teamAssignments, setTeamAssignments] = useState<{ [playerId: string]: 'Team A' | 'Team B' }>({});
  const [pinseekrCupSettings, setPinseekrCupSettings] = useState({
    formatOrder: ['foursomes', 'fourballs', 'singles'] as PinseekrCupFormat[],
    formatPositions: {} as { [key in PinseekrCupFormat]?: number }, // Track which position each format is assigned to
    cycleLength: 6,
    presetMode: 'ryder-cup' as 'ryder-cup' | 'trad-golf' | 'duffers-delight' | 'custom',
    strokePlayUseNet: true
  });

  // Auto-add logged-in user as first player and 3 additional default players
  useEffect(() => {
    if (user && (!round.players || round.players.length === 0)) {
      const currentUserPlayer: PlayerInRound = {
        playerId: user.pubkey,
        name: metadata?.name || genUserName(user.pubkey),
        handicap: 0,
        scores: [],
        total: 0,
        netTotal: 0
      };

      const defaultPlayers: PlayerInRound[] = [
        currentUserPlayer,
        {
          playerId: 'player-2',
          name: 'Player 2',
          handicap: 0,
          scores: [],
          total: 0,
          netTotal: 0
        },
        {
          playerId: 'player-3',
          name: 'Player 3',
          handicap: 0,
          scores: [],
          total: 0,
          netTotal: 0
        },
        {
          playerId: 'player-4',
          name: 'Player 4',
          handicap: 0,
          scores: [],
          total: 0,
          netTotal: 0
        }
      ];

      setRound(prev => ({
        ...prev!,
        players: defaultPlayers
      }));
    }
  }, [user, metadata, round.players]);

  // Helper function to get player initials
  const getPlayerInitials = (playerName: string) => {
    return playerName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Game mode functions
  const toggleGameMode = (mode: keyof GameModes) => {
    // If enabling Pinseekr Cup, disable other modes
    if (mode === 'pinseekrCup') {
      setSelectedGameModes(prev => ({
        strokePlay: false,
        matchPlay: false,
        nassau: false,
        skins: false,
        dots: false,
        snake: false,
        points: false,
        wolf: false,
        pinseekrCup: !prev.pinseekrCup
      }));
    } else if (selectedGameModes.pinseekrCup) {
      // If any other mode is selected while Pinseekr Cup is active, disable Pinseekr Cup
      setSelectedGameModes(prev => ({
        ...prev,
        pinseekrCup: false,
        [mode]: !prev[mode]
      }));
    } else {
      // Normal toggle for individual game modes
      setSelectedGameModes(prev => ({
        ...prev,
        [mode]: !prev[mode]
      }));
    }
  };

  // Team assignment functions
  const assignPlayerToTeam = (playerId: string, team: 'Team A' | 'Team B') => {
    setTeamAssignments(prev => ({
      ...prev,
      [playerId]: team
    }));
  };

  // Handle preset mode changes
  const handlePresetModeChange = (mode: 'ryder-cup' | 'trad-golf' | 'duffers-delight' | 'custom') => {
    const config = presetConfigurations[mode];
    
    // Build formatPositions mapping from the preset configuration
    const formatPositions: { [key in PinseekrCupFormat]?: number } = {};
    config.formatOrder.forEach((format, index) => {
      formatPositions[format] = index + 1; // Convert to 1-indexed
    });
    
    setPinseekrCupSettings(prev => ({
      ...prev,
      presetMode: mode,
      formatOrder: [...config.formatOrder], // Copy the fixed template or empty for custom
      formatPositions: formatPositions
    }));
  };

  // Handle position assignment for custom tournament formats
  const handleFormatPositionChange = (format: PinseekrCupFormat, position: number) => {
    setPinseekrCupSettings(prev => {
      const newFormatPositions = { ...prev.formatPositions };
      
      // Remove this format from any existing position
      delete newFormatPositions[format];
      
      // Remove any other format that might be at this position
      Object.keys(newFormatPositions).forEach(key => {
        if (newFormatPositions[key as PinseekrCupFormat] === position) {
          delete newFormatPositions[key as PinseekrCupFormat];
        }
      });
      
      // Assign this format to the new position
      newFormatPositions[format] = position;
      
      // Rebuild formatOrder array from position mappings
      const newFormatOrder: PinseekrCupFormat[] = [];
      [1, 2, 3].forEach(pos => {
        const formatAtPosition = Object.keys(newFormatPositions).find(
          f => newFormatPositions[f as PinseekrCupFormat] === pos
        ) as PinseekrCupFormat | undefined;
        
        if (formatAtPosition) {
          newFormatOrder.push(formatAtPosition);
        }
      });
      
      return {
        ...prev,
        formatPositions: newFormatPositions,
        formatOrder: newFormatOrder
      };
    });
  };

  // Get the position of a format in the current order (1-indexed, or null if not selected)
  // Get the position of a format in the current order (1-indexed, or null if not selected)
  const getFormatPosition = (format: PinseekrCupFormat): number | null => {
    return pinseekrCupSettings.formatPositions[format] || null;
  };

  // Create Pinseekr Cup tournament
  const createTournament = () => {
    if (!round.players || round.players.length < 4) {
      toast({
        title: "Not Enough Players",
        description: "Pinseekr Cup requires at least 4 players.",
        variant: "destructive",
      });
      return;
    }

    if (round.players.length % 2 !== 0) {
      toast({
        title: "Uneven Teams",
        description: "Pinseekr Cup requires an even number of players.",
        variant: "destructive",
      });
      return;
    }

    if (pinseekrCupSettings.formatOrder.length !== 3) {
      toast({
        title: "Invalid Format Count",
        description: "Pinseekr Cup requires exactly 3 game formats based on the fractal of golf (9 holes).",
        variant: "destructive",
      });
      return;
    }

    // Create Pinseekr Cup players with team assignments
    const pinseekrPlayers: PinseekrCupPlayer[] = round.players.map(player => ({
      id: player.playerId,
      name: player.name,
      handicap: player.handicap,
      team: teamAssignments[player.playerId] || 'Team A'
    }));

    // Create tournament config
    const tournamentConfig = createPinseekrCup(pinseekrPlayers);
    
    setTournament(tournamentConfig);
    setSelectedMode(GameMode.STROKE_PLAY); // Default to stroke play for Pinseekr Cup
    setRound(prev => ({ ...prev!, gameMode: GameMode.STROKE_PLAY }));

    toast({
      title: "Tournament Created",
      description: `${presetConfigurations[pinseekrCupSettings.presetMode].name} tournament created with ${pinseekrPlayers.length} players and 3 formats.`,
    });
  };

  const generateRoundCode = async () => {
    // Generate a unique 6-character round code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Create the join URL
    const joinUrl = `${window.location.origin}/join/${result}`;
    
    try {
      // Generate QR Code
      const qrDataUrl = await QRCode.toDataURL(joinUrl, {
        width: 128,
        margin: 1,
        color: {
          dark: '#333333',
          light: '#FFFFFF'
        }
      });
      
      setRoundCode(result);
      setQrCodeUrl(qrDataUrl);
      setShowRoundCode(true);

      // Copy to clipboard
      navigator.clipboard.writeText(joinUrl).then(() => {
        toast({
          title: "Round Code Generated",
          description: `Code ${result} generated! Join URL copied to clipboard.`,
        });
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCourseSelect = (courseId: string, courseName: string, courseLocation: string) => {
    setSelectedCourse({ id: courseId, name: courseName, location: courseLocation });
    setRound(prev => ({
      ...prev!,
      metadata: {
        ...prev!.metadata!,
        courseName,
        courseLocation
      }
    }));
  };

  const addPlayer = () => {
    setShowAddPlayerDialog(true);
  };

  const handleAddPlayer = (newPlayer: PlayerInRound) => {
    setRound(prev => ({
      ...prev!,
      players: [...(prev!.players || []), newPlayer]
    }));
  };

  const updatePlayer = (index: number, field: keyof PlayerInRound, value: unknown) => {
    setRound(prev => ({
      ...prev!,
      players: prev!.players?.map((player, i) =>
        i === index ? { ...player, [field]: value } : player
      ) || []
    }));
  };

  const removePlayer = (index: number) => {
    setRound(prev => ({
      ...prev!,
      players: prev!.players?.filter((_, i) => i !== index) || []
    }));
  };

  const initializeHoles = () => {
    const holes = Array.from({ length: 18 }, (_, i) => ({
      holeNumber: i + 1,
      par: 4, // Default par 4
      strokes: 0,
      putts: 0,
      fairways: false,
      greens: false,
      sandTraps: 0,
      penalties: 0,
      notes: ''
    }));

    setRound(prev => ({
      ...prev!,
      holes,
      players: prev!.players?.map(player => ({
        ...player,
        scores: Array(18).fill(0)
      })) || []
    }));
  };

  const saveRound = () => {
    if (!round.metadata?.courseName || !round.players || round.players.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please provide course name and add at least one player.",
        variant: "destructive",
      });
      return;
    }

    // Initialize holes if not already done
    if ((round.holes?.length || 0) === 0) {
      initializeHoles();
    }

    // Create and publish round event
    const roundEvent = createRoundEvent(round as GolfRound);
    publishEvent(roundEvent, {
      onSuccess: () => {
        toast({
          title: "Round Created",
          description: "Your golf round has been created and shared on Nostr.",
        });
        navigate('/round/' + round.id);
      },
      onError: () => {
        toast({
          title: "Error Creating Round",
          description: "Failed to create round. Please try again.",
          variant: "destructive",
        });
      }
    });

    // Create game configuration event
    const gameEvent = createGameEvent(
      round.gameMode || GameMode.STROKE_PLAY,
      round.players || [],
      round.id || ''
    );

    publishEvent(gameEvent, {
      onSuccess: () => {
        console.log('Game event published successfully');
      },
      onError: (error) => {
        console.error('Error publishing game event:', error);
      }
    });
  };

  const startRound = () => {
    if (!round.metadata?.courseName || !round.players || round.players.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please provide course name and add at least one player.",
        variant: "destructive",
      });
      return;
    }
    setStep('scoring');
  };

  if (step === 'setup') {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Round Setup
                  </CardTitle>
                  <CardDescription>
                    Configure your golf round with players, game modes, and course details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-8">
                    {/* Players Setup Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Players Setup
                          </h3>
                          <p className="text-sm text-muted-foreground">Add players and configure their details</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {round.players?.map((player, index) => (
                          <Card key={player.playerId}>
                            <CardContent className="pt-4">
                              <div className="grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-5">
                                  <Label htmlFor={`name-${player.playerId}`}>Name</Label>
                                  <Input
                                    id={`name-${player.playerId}`}
                                    value={player.name}
                                    onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                                    disabled={index === 0 && player.playerId === user?.pubkey}
                                  />
                                  {index === 0 && player.playerId === user?.pubkey && (
                                    <p className="text-xs text-gray-500 mt-1">You (logged in user)</p>
                                  )}
                                </div>
                                <div className="col-span-3">
                                  <Label htmlFor={`handicap-${player.playerId}`}>Handicap</Label>
                                  <Input
                                    id={`handicap-${player.playerId}`}
                                    type="number"
                                    min="0"
                                    max="54"
                                    value={player.handicap}
                                    onChange={(e) => updatePlayer(index, 'handicap', parseInt(e.target.value) || 0)}
                                  />
                                </div>
                                <div className="col-span-3">
                                  <Label>Current Total</Label>
                                    <div className="text-lg font-mono">
                                      {player.total || '--'}
                                    </div>
                                  </div>
                                  <div className="col-span-1">
                                    {round.players!.length > 1 && !(index === 0 && player.playerId === user?.pubkey) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removePlayer(index)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {/* Add Player Button and Round Code Generation */}
                        <div className="space-y-3">
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Button 
                                type="button" 
                                onClick={addPlayer} 
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white border-purple-600 hover:border-purple-700"
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Player
                              </Button>
                              <Button 
                                type="button" 
                                onClick={generateRoundCode} 
                                className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 border-yellow-500 hover:border-yellow-600"
                              >
                                <QrCode className="mr-2 h-4 w-4" />
                                Generate Round Code
                              </Button>
                            </div>
                          </div>

                          {/* Round Code Display */}
                          {showRoundCode && roundCode && (
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Round Code Generated</h4>
                                <div className="text-2xl font-mono font-bold text-yellow-900 dark:text-yellow-100 bg-white dark:bg-gray-800 px-3 py-1 rounded border">
                                  {roundCode}
                                </div>
                              </div>
                              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                                Share this code with other players so they can join your round.
                              </p>
                              <div className="flex justify-center">
                                <div className="bg-white p-4 rounded-lg border">
                                  {qrCodeUrl ? (
                                    <img 
                                      src={qrCodeUrl} 
                                      alt={`QR Code for round ${roundCode}`}
                                      className="w-32 h-32"
                                    />
                                  ) : (
                                    <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                                      <div className="text-center text-gray-500 dark:text-gray-400 text-xs">
                                        <QrCode className="h-8 w-8 mx-auto mb-1" />
                                        Generating...
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center mt-2">
                                Scan to join round or visit: {window.location.origin}/join/{roundCode}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Game Modes Section */}
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Trophy className="h-5 w-5" />
                            Game Modes & Configuration
                          </h3>
                          <p className="text-sm text-muted-foreground">Choose your game formats and tournament options</p>
                        </div>

                        {/* Pinseekr Cup - Featured at top */}
                        <Card className="border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 via-purple-50 to-blue-50 dark:from-yellow-900/20 dark:via-purple-900/20 dark:to-blue-900/20">
                          <CardContent className="pt-4">
                            <div className="flex items-center space-x-2 mb-3">
                              <Checkbox
                                id="pinseekrCup"
                                checked={selectedGameModes.pinseekrCup}
                                onCheckedChange={() => toggleGameMode('pinseekrCup')}
                              />
                              <Label htmlFor="pinseekrCup" className="font-medium text-lg">🏆 Pinseekr Cup</Label>
                            </div>
                            <p className="text-sm text-foreground mb-3">
                              Multi-format tournament requiring an even number of players, 4 minimum. Play over 9, 18, 27, 36, or 54 holes.
                            </p>
                            
                            {selectedGameModes.pinseekrCup && (
                              <div className="space-y-4 mt-4">
                                {/* Tournament Settings */}
                                <div className="space-y-4">
                                  {/* Tournament Style and Holes per Format - Side by Side */}
                                  <div className="flex gap-6 items-start">
                                    {/* Tournament Style */}
                                    <div className="space-y-2 flex-1">
                                      <Label>Tournament Style</Label>
                                      <Select value={pinseekrCupSettings.presetMode} onValueChange={handlePresetModeChange}>
                                        <SelectTrigger className="w-full min-w-[350px]">
                                          <SelectValue className="overflow-visible">
                                            <div className="text-left w-full overflow-visible">
                                              <div className="font-medium flex items-center gap-2 overflow-visible whitespace-nowrap">
                                                {pinseekrCupSettings.presetMode === 'ryder-cup' && '🏆'} 
                                                {pinseekrCupSettings.presetMode === 'trad-golf' && '🎯'} 
                                                {pinseekrCupSettings.presetMode === 'duffers-delight' && '🎉'} 
                                                {pinseekrCupSettings.presetMode === 'custom' && '⚙️'}
                                                {presetConfigurations[pinseekrCupSettings.presetMode].name}
                                              </div>
                                              <div className="text-xs text-muted-foreground whitespace-nowrap overflow-visible">
                                                {presetConfigurations[pinseekrCupSettings.presetMode].formatOrder
                                                  .map(f => f.charAt(0).toUpperCase() + f.slice(1))
                                                  .join(' → ')}
                                              </div>
                                            </div>
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="w-[600px]">
                                          <SelectItem value="ryder-cup" className="py-3">
                                            <div className="space-y-1">
                                              <div className="font-medium">🏆 Pinseekr Cup</div>
                                              <div className="text-xs text-muted-foreground">
                                                Classic Ryder Cup format: team-based progression from Foursome (Alternate Shot) to Fourballs (Best Ball) to Singles
                                              </div>
                                              <div className="text-xs text-blue-600 dark:text-blue-400">
                                                Format Order: Foursomes (Alternate Shot) → Fourballs (Best Ball) → Singles (Match)
                                              </div>
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="trad-golf" className="py-3">
                                            <div className="space-y-1">
                                              <div className="font-medium">🎯 Trad-Golf</div>
                                              <div className="text-xs text-muted-foreground">
                                                Traditional golf progression: objective scoring to points-based to head-to-head competition
                                              </div>
                                              <div className="text-xs text-blue-600 dark:text-blue-400">
                                                Format Order: Stroke → Stableford → Singles (Match)
                                              </div>
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="duffers-delight" className="py-3">
                                            <div className="space-y-1">
                                              <div className="font-medium">🎉 Duffers Delight</div>
                                              <div className="text-xs text-muted-foreground">
                                                Fun-focused tournament: points games to team play to individual competition
                                              </div>
                                              <div className="text-xs text-blue-600 dark:text-blue-400">
                                                Format Order: Scramble → Foursomes (Alternate Shot) → Fourballs (Best Ball)
                                              </div>
                                            </div>
                                          </SelectItem>
                                          <SelectItem value="custom" className="py-3">
                                            <div className="space-y-1">
                                              <div className="font-medium">⚙️ Custom</div>
                                              <div className="text-xs text-muted-foreground">
                                                Create your own tournament format with custom position assignments
                                              </div>
                                            </div>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Holes per Format */}
                                    <div className="space-y-2 flex-1">
                                      <Label>Holes per Format</Label>
                                      <div className="flex gap-2">
                                        {[3, 6, 9, 12, 18].map((holes) => (
                                          <Button
                                            key={holes}
                                            type="button"
                                            variant={pinseekrCupSettings.cycleLength === holes ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setPinseekrCupSettings(prev => ({ ...prev, cycleLength: holes }))}
                                            className={`text-center ${
                                              pinseekrCupSettings.cycleLength === holes 
                                                ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-600" 
                                                : "hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
                                            }`}
                                          >
                                            {holes}
                                          </Button>
                                        ))}
                                      </div>
                                      <div className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                                        {pinseekrCupSettings.cycleLength * 3} Hole Tournament
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Format Order Selection - Only show for Custom mode */}
                                {pinseekrCupSettings.presetMode === 'custom' && (
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <Label>Custom Tournament Format Order</Label>
                                      <Badge variant="outline" className="text-xs">
                                        {pinseekrCupSettings.formatOrder.length}/3 formats
                                      </Badge>
                                    </div>
                                    
                                    {pinseekrCupSettings.formatOrder.length < 3 && (
                                      <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded">
                                        <p className="text-sm text-amber-800 dark:text-amber-200">
                                          Select exactly 3 formats and assign their order (1st, 2nd, 3rd). Click the position buttons to assign.
                                        </p>
                                      </div>
                                    )}
                                    
                                    {/* All Format Options with Position Selectors */}
                                    <div className="space-y-3">
                                      {(['foursomes', 'fourballs', 'singles', 'stroke', 'stableford', 'scramble'] as PinseekrCupFormat[]).map((format) => {
                                        const currentPosition = getFormatPosition(format);
                                        const isSelected = currentPosition !== null;
                                        
                                        return (
                                          <div 
                                            key={format} 
                                            className={`flex items-center gap-3 p-3 border rounded transition-colors ${
                                              isSelected 
                                                ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' 
                                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                            }`}
                                          >
                                            <div className="flex-1">
                                              <div className="text-sm font-medium">
                                                {formatDisplayNames[format]}
                                              </div>
                                              <div className="text-xs text-foreground">
                                                {formatDescriptions[format]}
                                              </div>
                                            </div>
                                            
                                            {/* Position Selector Buttons */}
                                            <div className="flex gap-1">
                                              {[1, 2, 3].map((position) => {
                                                const isThisPosition = currentPosition === position;
                                                
                                                // Define colors: dark unselected with purple hover, thematic when selected
                                                const getButtonClasses = () => {
                                                  if (isThisPosition) {
                                                    // Selected state - thematic colors
                                                    switch (position) {
                                                      case 1: return 'bg-yellow-500 text-white hover:bg-yellow-600 border-yellow-500';
                                                      case 2: return 'bg-green-500 text-white hover:bg-green-600 border-green-500';
                                                      case 3: return 'bg-red-500 text-white hover:bg-red-600 border-red-500';
                                                      default: return '';
                                                    }
                                                  } else {
                                                    // Unselected state - dark with purple hover
                                                    return 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-purple-500 hover:text-white hover:border-purple-500';
                                                  }
                                                };
                                                
                                                return (
                                                  <Button
                                                    key={position}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                      if (isThisPosition) {
                                                        // Remove from this position by filtering out
                                                        const newOrder = pinseekrCupSettings.formatOrder.filter(f => f !== format);
                                                        setPinseekrCupSettings(prev => ({ ...prev, formatOrder: newOrder }));
                                                      } else {
                                                        // Assign to this position
                                                        handleFormatPositionChange(format, position);
                                                      }
                                                    }}
                                                    className={`h-8 w-8 p-0 text-xs transition-all duration-200 ${getButtonClasses()}`}
                                                    title={
                                                      isThisPosition 
                                                        ? `Remove from position ${position}` 
                                                        : `Assign to position ${position}`
                                                    }
                                                  >
                                                    {position}
                                                  </Button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Show fixed format preview for preset modes */}
                                {pinseekrCupSettings.presetMode !== 'custom' && (
                                  <div className="space-y-2">
                                    <Label>Tournament Format Preview</Label>
                                    <div className="space-y-2">
                                      {presetConfigurations[pinseekrCupSettings.presetMode].formatOrder.map((format, index) => {
                                        const startHole = (index * pinseekrCupSettings.cycleLength) + 1;
                                        const endHole = (index + 1) * pinseekrCupSettings.cycleLength;
                                        
                                        return (
                                          <div key={`${format}-${index}`} className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded">
                                            <Badge variant="secondary" className="min-w-[60px] h-6 rounded-full px-2 flex items-center justify-center text-xs bg-purple-600 text-white">
                                              Holes {startHole}-{endHole}
                                            </Badge>
                                            <div className="flex-1">
                                              <div className="text-sm font-medium text-purple-800 dark:text-purple-200">
                                                {formatDisplayNames[format]}
                                              </div>
                                              <div className="text-xs text-purple-600 dark:text-purple-400">
                                                {formatDescriptions[format]}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Team Assignment */}
                                {round.players && round.players.length >= 4 && (
                                  <div className="space-y-3">
                                    <Label>Team Assignments</Label>
                                    <div className="space-y-2">
                                      {round.players.map((player) => (
                                        <div key={`${player.playerId}-team-select`} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                                          <div className="flex items-center space-x-3">
                                            <Avatar className="h-8 w-8">
                                              <AvatarFallback className="text-sm">
                                                {getPlayerInitials(player.name)}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div>
                                              <div className="text-sm font-medium">{player.name}</div>
                                              <div className="text-xs text-muted-foreground">Handicap: {player.handicap}</div>
                                            </div>
                                          </div>
                                          <div className="flex space-x-1">
                                            <Button
                                              type="button"
                                              variant={teamAssignments[player.playerId] === 'Team A' ? 'default' : 'outline'}
                                              size="sm"
                                              onClick={() => assignPlayerToTeam(player.playerId, 'Team A')}
                                              className={`h-7 px-2 text-xs ${
                                                teamAssignments[player.playerId] === 'Team A' 
                                                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                                  : 'hover:bg-blue-50 hover:text-blue-600'
                                              }`}
                                            >
                                              Team A
                                            </Button>
                                            <Button
                                              type="button"
                                              variant={teamAssignments[player.playerId] === 'Team B' ? 'default' : 'outline'}
                                              size="sm"
                                              onClick={() => assignPlayerToTeam(player.playerId, 'Team B')}
                                              className={`h-7 px-2 text-xs ${
                                                teamAssignments[player.playerId] === 'Team B' 
                                                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                                                  : 'hover:bg-red-50 hover:text-red-600'
                                              }`}
                                            >
                                              Team B
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    
                                    {round.players.length >= 4 && (
                                      <Button
                                        type="button"
                                        onClick={createTournament}
                                        disabled={pinseekrCupSettings.formatOrder.length !== 3}
                                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50"
                                      >
                                        <Trophy className="h-4 w-4 mr-2" />
                                        Create {presetConfigurations[pinseekrCupSettings.presetMode].name} Tournament
                                      </Button>
                                    )}
                                    
                                    {round.players.length >= 4 && pinseekrCupSettings.formatOrder.length !== 3 && (
                                      <p className="text-sm text-muted-foreground text-center">
                                        {pinseekrCupSettings.presetMode === 'custom' 
                                          ? 'Select exactly 3 formats to create tournament'
                                          : 'Tournament template will have 3 formats'
                                        }
                                      </p>
                                    )}
                                  </div>
                                )}

                                {round.players && round.players.length < 4 && (
                                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                      Add at least 4 players to enable Pinseekr Cup tournament mode.
                                    </p>
                                  </div>
                                )}

                                {tournament && (
                                  <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
                                    <h4 className="font-semibold text-green-800 dark:text-green-200 mb-1">Tournament Created!</h4>
                                    <p className="text-sm text-green-700 dark:text-green-300">
                                      {tournament.name} with {tournament.players.length} players, {tournament.rounds.length} rounds
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Individual Game Modes */}
                        {!selectedGameModes.pinseekrCup && (
                          <Card>
                            <CardContent className="pt-4">
                              <div className="space-y-3">
                                <h4 className="font-medium">Individual Game Modes</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="strokePlay"
                                      checked={selectedGameModes.strokePlay}
                                      onCheckedChange={() => toggleGameMode('strokePlay')}
                                    />
                                    <Label htmlFor="strokePlay" className="font-medium">Stroke Play</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="matchPlay"
                                      checked={selectedGameModes.matchPlay}
                                      onCheckedChange={() => toggleGameMode('matchPlay')}
                                    />
                                    <Label htmlFor="matchPlay" className="font-medium">Match Play</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="skins"
                                      checked={selectedGameModes.skins}
                                      onCheckedChange={() => toggleGameMode('skins')}
                                    />
                                    <Label htmlFor="skins" className="font-medium">Skins</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="nassau"
                                      checked={selectedGameModes.nassau}
                                      onCheckedChange={() => toggleGameMode('nassau')}
                                    />
                                    <Label htmlFor="nassau" className="font-medium">Nassau</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="points"
                                      checked={selectedGameModes.points}
                                      onCheckedChange={() => toggleGameMode('points')}
                                    />
                                    <Label htmlFor="points" className="font-medium">Stableford Points</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="wolf"
                                      checked={selectedGameModes.wolf}
                                      onCheckedChange={() => toggleGameMode('wolf')}
                                    />
                                    <Label htmlFor="wolf" className="font-medium">Wolf</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="dots"
                                      checked={selectedGameModes.dots}
                                      onCheckedChange={() => toggleGameMode('dots')}
                                    />
                                    <Label htmlFor="dots" className="font-medium">Dots</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="snake"
                                      checked={selectedGameModes.snake}
                                      onCheckedChange={() => toggleGameMode('snake')}
                                    />
                                    <Label htmlFor="snake" className="font-medium">Snake</Label>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Tournament Mode Alert */}
                        {selectedGameModes.pinseekrCup && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              ⚡ Tournament Mode Active - Other game modes are disabled during tournament play
                            </p>
                          </div>
                        )}

                        {/* Selected Game Modes Summary */}
                        <div className="flex flex-wrap gap-2">
                          {selectedGameModes.pinseekrCup && (
                            <Badge variant="default" className="bg-yellow-600 text-white">
                              🏆 Pinseekr Cup Tournament
                            </Badge>
                          )}
                          {!selectedGameModes.pinseekrCup && Object.entries(selectedGameModes)
                            .filter(([key, isSelected]) => key !== 'pinseekrCup' && isSelected)
                            .map(([gameType]) => (
                              <Badge key={gameType} variant="secondary">
                                {gameType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    
                    {/* Course Information Section */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Course Information
                        </h3>
                        <p className="text-sm text-muted-foreground">Select your golf course and add round details</p>
                      </div>
                      
                      <div>
                        <Label className="text-base font-medium">Select Course *</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          Search for a golf course or add course details manually
                        </p>
                      </div>

                      <CourseSearch
                        onSelectCourse={handleCourseSelect}
                        selectedCourse={selectedCourse}
                        className="mb-6"
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedCourse ? (
                          <>
                            <div className="space-y-2">
                              <Label>Selected Course</Label>
                              <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
                                <div className="font-medium text-yellow-800 dark:text-yellow-200">
                                  {selectedCourse.name}
                                </div>
                                <div className="text-sm text-yellow-600 dark:text-yellow-400">
                                  {selectedCourse.location}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="teeBox">Tee Box</Label>
                              <Select onValueChange={(value) => setRound(prev => ({
                                ...prev!,
                                metadata: { ...prev!.metadata!, teeBox: value }
                              }))}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select tee box" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="forward">Forward Tees</SelectItem>
                                  <SelectItem value="middle">Middle Tees</SelectItem>
                                  <SelectItem value="back">Back Tees</SelectItem>
                                  <SelectItem value="championship">Championship</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="courseName">Course Name (Manual Entry)</Label>
                              <Input
                                id="courseName"
                                value={round.metadata?.courseName || ''}
                                onChange={(e) => setRound(prev => ({
                                  ...prev!,
                                  metadata: { ...prev!.metadata!, courseName: e.target.value }
                                }))}
                                placeholder="Pine Valley Golf Club"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="courseLocation">Location (Manual Entry)</Label>
                              <Input
                                id="courseLocation"
                                value={round.metadata?.courseLocation || ''}
                                onChange={(e) => setRound(prev => ({
                                  ...prev!,
                                  metadata: { ...prev!.metadata!, courseLocation: e.target.value }
                                }))}
                                placeholder="City, State"
                              />
                            </div>
                          </>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="weather">Weather Conditions</Label>
                          <Input
                            id="weather"
                            value={round.metadata?.weather || ''}
                            onChange={(e) => setRound(prev => ({
                              ...prev!,
                              metadata: { ...prev!.metadata!, weather: e.target.value }
                            }))}
                            placeholder="Sunny, 72°F"
                          />
                        </div>

                        {!selectedCourse && (
                          <div className="space-y-2">
                            <Label htmlFor="teeBox">Tee Box</Label>
                            <Select onValueChange={(value) => setRound(prev => ({
                              ...prev!,
                              metadata: { ...prev!.metadata!, teeBox: value }
                            }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select tee box" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="forward">Forward Tees</SelectItem>
                                <SelectItem value="middle">Middle Tees</SelectItem>
                                <SelectItem value="back">Back Tees</SelectItem>
                                <SelectItem value="championship">Championship</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Additional Notes</Label>
                        <Input
                          id="notes"
                          value={round.metadata?.notes || ''}
                          onChange={(e) => setRound(prev => ({
                            ...prev!,
                            metadata: { ...prev!.metadata!, notes: e.target.value }
                          }))}
                          placeholder="Course conditions, special rules, etc."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-6 border-t mt-6">
                    <div className="flex justify-center">
                      <Button 
                        onClick={startRound}
                        disabled={!round.metadata?.courseName || !round.players || round.players.length === 0}
                        size="lg"
                        className="px-12 py-4 text-xl"
                      >
                        🏌️ Start Round
                      </Button>
                    </div>
                    {(!round.metadata?.courseName || !round.players || round.players.length === 0) && (
                      <p className="text-center text-sm text-muted-foreground mt-2">
                        Add course information and at least one player to start the round
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Add Player Dialog */}
        <AddPlayerDialog
          open={showAddPlayerDialog}
          onOpenChange={setShowAddPlayerDialog}
          onAddPlayer={handleAddPlayer}
          existingPlayers={round.players || []}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {round.metadata?.courseName} - {selectedMode.replace('-', ' ').toUpperCase()}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {round.players?.length} players • {new Date(round.date!).toLocaleDateString()}
              </p>
            </div>

            <GameModeSelector
              selectedMode={selectedMode}
              onModeSelect={(mode) => {
                setSelectedMode(mode);
                setRound(prev => ({ ...prev!, gameMode: mode }));
              }}
            />

            <div className="mt-8">
              <ScoreCard
                round={round as GolfRound}
                onUpdateRound={setRound}
                onSaveRound={saveRound}
                onShareRound={() => {
                  toast({
                    title: "Round Shared",
                    description: "Your round has been shared with your Nostr network.",
                  });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Add Player Dialog */}
      <AddPlayerDialog
        open={showAddPlayerDialog}
        onOpenChange={setShowAddPlayerDialog}
        onAddPlayer={handleAddPlayer}
        existingPlayers={round.players || []}
      />
    </Layout>
  );
};
