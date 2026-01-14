import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { useAuthor } from '@/hooks/useAuthor';
import { nip19 } from 'nostr-tools';
import { useNostr } from '@nostrify/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ScoreCard } from '@/components/scoring/ScoreCard';
import { GameMode, GolfRound, PlayerInRound, HoleScore } from '@/lib/golf/types';
import { GOLF_KINDS } from '@/lib/golf/types';
import { generateRoundId, createRoundEvent, createGameEvent, createPlayerEvent } from '@/lib/golf/nostrEvents';
import { parseRoundEvent, parseHoleScoreEvent } from '@/lib/golf/nostrEvents';
import { processRoundWagers, netting, type Payable } from '@/lib/golf/scoringEngine';
import { convertToRoundData } from '@/lib/golf/strokeEngine';
import { dotsEngine, convertToDotsData } from '@/lib/golf/dotsEngine';
import { snakeEngine, convertToSnakeData } from '@/lib/golf/snakeEngine';
import {
  createPinseekrCup,
  type PinseekrCupPlayer,
  type PinseekrCupConfig
} from '@/lib/golf/pinseekrCupEngine';
import { Plus, Users, Calendar, QrCode, Trophy, Trash2, Loader2, CheckCircle, Target, Zap } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { CourseSelection } from '@/components/golf/CourseSelection';
import { Layout } from '@/components/Layout';
import MobileContainer from '@/components/MobileContainer';
import { genUserName } from '@/lib/genUserName';
import { AddPlayerDialog } from '@/components/AddPlayerDialog';
import { useNWC } from '@/hooks/useNWCContext';
import { LN } from '@getalby/sdk';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { type GolfCourse } from '@/hooks/useGolfCourses';
import { getGolfHandicap } from '@/lib/golf/nostrTypes';
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
  vegas: boolean;
  sixes: boolean;
  pinseekrCup: boolean;
}

export const NewRoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { mutate: publishEvent } = useNostrPublish();
  const { toast } = useToast();
  const { user, metadata } = useCurrentUser();

  const [step, setStep] = useState<'setup' | 'scoring'>('setup');
  const [showSettlementPreview, setShowSettlementPreview] = useState(false);
  type AggregatedInvoice = { recipient: string; amount: number; payers: string[]; memo?: string };
  const [settlementPreview, setSettlementPreview] = useState<AggregatedInvoice[]>([]);
  const [isCreatingInvoices, setIsCreatingInvoices] = useState(false);

  // Check for roundId in URL — if present, use it instead of generating a new one (join flow)
  const urlRoundId = new URLSearchParams(window.location.search).get('roundId');
  const urlAutoJoin = new URLSearchParams(window.location.search).get('autoJoin') === '1';

  const [round, setRound] = useState<Partial<GolfRound>>(() => ({
    id: urlRoundId || generateRoundId(),
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
  }));

  const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null);
  const [holeCountChoice, setHoleCountChoice] = useState<number>(18); // 9, 18, or custom (+)
  const [holeButtonMode, setHoleButtonMode] = useState<'standard' | 'extended'>('standard');
  const [showHolePicker, setShowHolePicker] = useState<boolean>(false);
  const [customHoleInput, setCustomHoleInput] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [activeGameModeTab, setActiveGameModeTab] = useState<string>('strokePlay');
  const [roundCode, setRoundCode] = useState<string>('');
  const [showRoundCode, setShowRoundCode] = useState<boolean>(false);
  
  // Wager states
  const [wagersEnabled, setWagersEnabled] = useState<boolean>(false);
  const [wagerAmounts, setWagerAmounts] = useState<{[key: string]: '111' | '1111' | 'custom'}>({});
  const [customWagerAmounts, setCustomWagerAmounts] = useState<{[key: string]: string}>({});
  const [editingCustom, setEditingCustom] = useState<{[key: string]: boolean}>({});
  // Pinseekr Cup-specific wagers toggle
  const [pinseekrWagersEnabled, setPinseekrWagersEnabled] = useState<boolean>(false);
  // Persist tournament wagers (include in published Nostr tournament event)
  const [persistTournamentWagers, setPersistTournamentWagers] = useState<boolean>(false);
  // Persist normal wagers for regular game modes
  const [persistWagers, setPersistWagers] = useState<boolean>(false);
  const [snakeVariant, setSnakeVariant] = useState<'fixed' | 'progressive'>('fixed');
  const [progressiveMultiplier, setProgressiveMultiplier] = useState<number>(1.1);
  const [selectedGameModeOrder, setSelectedGameModeOrder] = useState<string[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [hasGeneratedRoundCode, setHasGeneratedRoundCode] = useState<boolean>(false);
  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [showAutoJoinConfirm, setShowAutoJoinConfirm] = useState<boolean>(false);
  const [showJoinInput, setShowJoinInput] = useState<boolean>(false);

  const { nostr } = useNostr();

  // If the URL contains ?roundId=..., attempt to load that round from Nostr relays
  useEffect(() => {
    if (!urlRoundId) return;

    // If the current round already matches the requested id and has players, skip
    if (round.id === urlRoundId && (round.players?.length || 0) > 0) return;

    let aborted = false;
    const controller = new AbortController();

    (async () => {
      // starting remote load

      try {
        if (!nostr) throw new Error('Nostr interface not available');

        const filters = [
          { kinds: [GOLF_KINDS.ROUND], '#d': [urlRoundId], limit: 1 },
          { kinds: [GOLF_KINDS.PLAYER, GOLF_KINDS.HOLE, GOLF_KINDS.GAME], '#round': [urlRoundId], limit: 500 }
        ];

        const events = (await nostr.query(filters, { signal: controller.signal })) as NostrEvent[];

        if (aborted) return;

        const roundEvent = events.find((e: NostrEvent) => e.kind === GOLF_KINDS.ROUND && Array.isArray(e.tags) && (e.tags as string[][]).find((t: string[]) => t[0] === 'd' && t[1] === urlRoundId));

        if (!roundEvent) {
          console.warn('Round not found on relays');
          return;
        }

        const parsed = parseRoundEvent(roundEvent);
        if (!parsed) {
          console.warn('Failed to parse round event');
          return;
        }

        // Collect player events (if any) and build players list
        const playerEvents = events.filter((e: NostrEvent) => e.kind === GOLF_KINDS.PLAYER);
        const players: PlayerInRound[] = [];

        if (playerEvents.length === 0) {
          // Fallback to players tag on the round event (created by createRoundEvent)
          const playersTag = (roundEvent.tags as string[][]).find((t: string[]) => t[0] === 'players');
          if (playersTag && playersTag.length > 1) {
            for (let i = 1; i < playersTag.length; i++) {
              const pub = playersTag[i];
              players.push({ playerId: pub, name: genUserName(pub), handicap: 0, scores: [], total: 0, netTotal: 0 });
            }
          }
        } else {
          for (const pe of playerEvents) {
            const playerId = ((pe.tags as string[][]).find((t: string[]) => t[0] === 'player') || [])[1] || pe.pubkey;
            const name = ((pe.tags as string[][]).find((t: string[]) => t[0] === 'name') || [])[1] || genUserName(playerId);
            const handicap = parseInt(((pe.tags as string[][]).find((t: string[]) => t[0] === 'handicap') || [])[1] || '0', 10) || 0;
            players.push({ playerId, name, handicap, scores: [], total: 0, netTotal: 0 });
          }
        }

        // Parse hole score events and assign strokes into player scores arrays
        const holeEvents = events.filter((e: NostrEvent) => e.kind === GOLF_KINDS.HOLE);
        for (const he of holeEvents) {
          const hole = parseHoleScoreEvent(he as NostrEvent);
          if (!hole) continue;
          const playerId = (((he.tags as string[][]).find((t: string[]) => t[0] === 'player') || [])[1]) || he.pubkey;
          let p = players.find(pl => pl.playerId === playerId);
          if (!p) {
            p = { playerId, name: genUserName(playerId), handicap: 0, scores: [], total: 0, netTotal: 0 } as PlayerInRound;
            players.push(p);
          }
          if (!p.scores) p.scores = [];
          p.scores[hole.holeNumber - 1] = hole.strokes;
        }

        // Build final round object
        const newRound: Partial<GolfRound> = {
          ...parsed,
          players,
          holes: holeEvents.map((h: NostrEvent) => parseHoleScoreEvent(h)).filter(Boolean) as HoleScore[]
        };

        setRound(newRound);
        setSelectedCourse(null);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Failed to load round from Nostr', err);
        }
      }
    })();

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [nostr, round.id, round.players?.length, user?.pubkey, urlRoundId]);

  // If redirected with autoJoin=1, prompt the user to confirm joining
  useEffect(() => {
    if (!urlAutoJoin || !urlRoundId) return;

    // If user not logged in, ask them to log in first
    if (!user) {
      toast({ title: 'Login required', description: 'Please log in to join this round', variant: 'destructive' });
      return;
    }

    // Show confirmation dialog
    setShowAutoJoinConfirm(true);
  }, [urlAutoJoin, urlRoundId, user, toast]);

  // Poll for player events so hosts see joiners in near-real-time
  useEffect(() => {
    if (!nostr || !round.id) return;

    let mounted = true;
    const controller = new AbortController();

    const fetchPlayers = async () => {
      try {
        const filter: NostrFilter = { kinds: [GOLF_KINDS.PLAYER], '#round': [round.id as string], limit: 200 } as NostrFilter;
        const events = await nostr.query([filter], { signal: controller.signal }) as NostrEvent[];
        if (!mounted) return;

        const players: PlayerInRound[] = [];
        for (const ev of events as NostrEvent[]) {
          const playerId = (((ev.tags as string[][]).find((t: string[]) => t[0] === 'player') || [])[1]) || ev.pubkey;
          const name = (((ev.tags as string[][]).find((t: string[]) => t[0] === 'name') || [])[1]) || genUserName(playerId);
          const handicap = parseInt((((ev.tags as string[][]).find((t: string[]) => t[0] === 'handicap') || [])[1]) || '0', 10) || 0;
          if (!players.find(p => p.playerId === playerId)) {
            players.push({ playerId, name, handicap, scores: [], total: 0, netTotal: 0 });
          }
        }

        if (players.length > 0) {
          setRound(prev => {
            const entries: Array<[string, PlayerInRound]> = [
              ...((prev!.players || []).map(p => [p.playerId, p] as [string, PlayerInRound])),
              ...players.map(p => [p.playerId, p] as [string, PlayerInRound])
            ];
            const merged = new Map<string, PlayerInRound>(entries);
            return { ...prev!, players: Array.from(merged.values()) };
          });
        }
      } catch {
        // ignore aborts and transient errors
      }
    };

    fetchPlayers();
    const id = setInterval(fetchPlayers, 4000);

    return () => {
      mounted = false;
      controller.abort();
      clearInterval(id);
    };
  }, [nostr, round.id]);

  const acceptInvite = async () => {
    if (!user || !round.id) {
      toast({ title: 'Login required', description: 'Please log in to accept the invite', variant: 'destructive' });
      return;
    }

    try {
      const player: PlayerInRound = {
        playerId: user.pubkey,
        name: metadata?.name || genUserName(user.pubkey),
        handicap: getGolfHandicap(metadata) || 0,
        scores: [],
        total: 0,
        netTotal: 0
      };

      // Publish a player event so all clients see the new player
      const playerEvent = createPlayerEvent(player, round.id);
      await publishEvent(playerEvent);

      // Also publish an explicit invite-accept event
      try {
        await publishEvent({
          kind: GOLF_KINDS.INVITE_ACCEPT,
          created_at: Math.floor(Date.now() / 1000),
          tags: [['d', round.id], ['player', user.pubkey]],
          content: ''
        });
      } catch {
        // non-fatal
      }

      // Optimistic local update
      setRound(prev => ({ ...prev!, players: [...(prev!.players || []), player] }));
      toast({ title: 'Joined', description: 'You have joined the round' });
    } catch (err) {
      console.error('Failed to accept invite', err);
      toast({ title: 'Error', description: (err as Error)?.message || 'Failed to join round', variant: 'destructive' });
    }
  };

  // Player input validation states - track for each player by index
  const [validatedPubkeys, setValidatedPubkeys] = useState<{ [index: number]: string | null }>({});
  const [pubkeyErrors, setPubkeyErrors] = useState<{ [index: number]: string | null }>({});
  const [validatingPlayers, setValidatingPlayers] = useState<{ [index: number]: boolean }>({});
  
  // Fallback player input state
  const [fallbackPlayerInput, setFallbackPlayerInput] = useState<string>('');
  const [fallbackValidatedPubkey, setFallbackValidatedPubkey] = useState<string | null>(null);
  const [fallbackPubkeyError, setFallbackPubkeyError] = useState<string | null>(null);
  const [fallbackValidating, setFallbackValidating] = useState<boolean>(false);

  // Create individual hook calls for each validated pubkey - dynamic approach
  const pubkeyEntries = Object.entries(validatedPubkeys);
  
  // Use individual hooks for up to 8 players (expandable)
  const profileData0 = useAuthor(pubkeyEntries[0]?.[1] || '');
  const profileData1 = useAuthor(pubkeyEntries[1]?.[1] || '');
  const profileData2 = useAuthor(pubkeyEntries[2]?.[1] || '');
  const profileData3 = useAuthor(pubkeyEntries[3]?.[1] || '');
  const profileData4 = useAuthor(pubkeyEntries[4]?.[1] || '');
  const profileData5 = useAuthor(pubkeyEntries[5]?.[1] || '');
  const profileData6 = useAuthor(pubkeyEntries[6]?.[1] || '');
  const profileData7 = useAuthor(pubkeyEntries[7]?.[1] || '');
  
  // Memoize profile data map to prevent unnecessary re-renders
  const profileDataMap = useMemo(() => {
    const map: { [index: number]: ReturnType<typeof useAuthor>['data'] } = {};
    
    pubkeyEntries.forEach(([index, pubkey], arrayIndex) => {
      if (pubkey) {
        switch(arrayIndex) {
          case 0: map[parseInt(index)] = profileData0.data; break;
          case 1: map[parseInt(index)] = profileData1.data; break;
          case 2: map[parseInt(index)] = profileData2.data; break;
          case 3: map[parseInt(index)] = profileData3.data; break;
          case 4: map[parseInt(index)] = profileData4.data; break;
          case 5: map[parseInt(index)] = profileData5.data; break;
          case 6: map[parseInt(index)] = profileData6.data; break;
          case 7: map[parseInt(index)] = profileData7.data; break;
        }
      }
    });
    
    return map;
  }, [pubkeyEntries, profileData0.data, profileData1.data, profileData2.data, profileData3.data, 
      profileData4.data, profileData5.data, profileData6.data, profileData7.data]);

  // Reset round-code generation when the setup panel is opened
  useEffect(() => {
    if (step === 'setup') {
      setHasGeneratedRoundCode(false);
      setRoundCode('');
      setQrCodeUrl('');
      setShowRoundCode(false);
    }
  }, [step]);
  
  // Fetch profile data for fallback input
  const { data: fallbackProfileData } = useAuthor(fallbackValidatedPubkey || '');

  // Game mode states
  const [selectedGameModes, setSelectedGameModes] = useState<GameModes>({
    strokePlay: false,
    matchPlay: false,
    nassau: false,
    skins: false,
    dots: false,
    snake: false,
    points: false,
    wolf: false,
    vegas: false,
    sixes: false,
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

  // Additional UI state
  const [modifiedStableford, setModifiedStableford] = useState(false);
  const [useHandicaps] = useState<boolean>(() => (round.players || []).some(p => (p.handicap || 0) > 0));
  const [netScoring] = useState<boolean>(false);
  const [wolfSettingsOpen, setWolfSettingsOpen] = useState(false);
  const [wolfPartners, setWolfPartners] = useState<Record<string, string | null>>({});
  
  // Vegas teams state
  const [vegasTeams, setVegasTeams] = useState<{ teamA: string[]; teamB: string[] }>({ teamA: [], teamB: [] });

  // Game mode data for tabs
  const gameModeData = {
    strokePlay: { key: 'strokePlay', name: 'Stroke Play', description: 'Traditional scoring - lowest total score wins', rules: 'Count every stroke taken throughout the round. Add up all strokes across 18 holes - lowest total score wins. Most common format for tournaments and casual play. Can use gross scores or net scores (handicap adjustments).' },
    matchPlay: { key: 'matchPlay', name: 'Match Play', description: 'Head-to-head competition - hole-by-hole scoring', rules: 'Win, lose, or tie each individual hole. Winner of each hole wins that hole (1 up). If tied, hole is halved. First player to be more holes "up" than holes remaining wins the match. Example: 3 up with 2 holes to play = match won.' },
    skins: { key: 'skins', name: 'Skins', description: 'Win individual holes - lowest score on each hole wins', rules: 'Each hole has a monetary value ("skin"). Player with lowest score on a hole wins that skin. If tied, the skin carries over to the next hole (making it worth more). Continue until someone wins a hole outright. All skins must be won - if the last holes tie, those skins push to a playoff or next round.' },
    nassau: { key: 'nassau', name: 'Nassau', description: 'Three matches in one: front nine, back nine, and total', rules: 'Three separate bets: Front 9, Back 9, and Overall 18-hole match. Each is worth equal money. You can win, lose, or push each bet independently. Typically played as match play (hole-by-hole) for each segment. A player could lose the front 9, win the back 9, and tie overall - resulting in winning 1 out of 3 bets.' },
    points: { key: 'points', name: 'Stableford', description: 'Stableford', rules: "Earn points based on score relative to par. Highest point total wins. Standard rewards aggressive play and reduces the impact of disaster holes since you can't score negative points. Modified rewards good scores and punishes going over par." },
    wolf: { key: 'wolf', name: 'Wolf', description: 'Strategic game with rotating roles and partnerships', rules: 'Players rotate being the "Wolf" each hole. Wolf tees off last and chooses a partner after seeing everyone\'s drive, or plays alone ("Lone Wolf") for double points. Wolf & partner vs other two players. Points awarded: Win = +2pts each, Lose = -1pt each. Lone Wolf wins = +4pts, Lone Wolf loses = -2pts. Most points after 18 holes wins.' },
    vegas: { key: 'vegas', name: 'Vegas', description: 'Two-person teams with combined scoring', rules: 'Two teams of 2 players each. Combine teammates\' scores by concatenating them (not adding). Lower score goes first. Example: Team A scores 4 and 5 = 45, Team B scores 3 and 6 = 36. Team B wins the hole. If a player shoots 10+, flip the scores (45 vs 63 becomes 54 vs 36). Play for points per hole.' },
    sixes: { key: 'sixes', name: 'Sixes', description: 'Rotating partnerships every 6 holes', rules: 'Players rotate partnerships every 6 holes, creating different team matchups throughout the round. Partners play best ball (take the better score) against the remaining players. Each 6-hole segment awards points to the winning team. Individual scores tracked separately. Works well with 3+ players for competitive team play with changing alliances.' },
    // 'Dots' game removed from visible UI for initial launch (engine retained)
    snake: { key: 'snake', name: 'Snake', description: 'Progressive Wager (penalty increases as more three-putts are made by the group)', rules: 'One player holds the "Snake". When a player three-putts, the Snake is passed to them. The player holding the Snake at the end of the round pays a penalty to other players. In Fixed mode, penalty is a set amount. In Progressive mode, the penalty multiplies with each transfer (default 1.1x). Most three-putts = biggest penalty.' }
  };

  // Get list of selected game modes for tabs in selection order
  const selectedGameModeList = selectedGameModeOrder
    .filter(key => selectedGameModes[key] && key !== 'pinseekrCup')
    .map(key => gameModeData[key as keyof typeof gameModeData])
    .filter(Boolean);

  // Update active tab when game modes change
  useEffect(() => {
    if (selectedGameModeList.length > 0 && !selectedGameModeList.some(mode => mode.key === activeGameModeTab)) {
      setActiveGameModeTab(selectedGameModeList[0].key);
    }
  }, [selectedGameModes, activeGameModeTab, selectedGameModeList]);

  // Initialize/update logged-in user as Player 1
  // This handles initial load, login after page load, and metadata updates
  // Note: Only sets handicap on INITIAL add - user edits to handicap are preserved
  useEffect(() => {
    if (!user) return;
    
    setRound(prev => {
      const currentPlayers = prev?.players || [];
      const existingUserIndex = currentPlayers.findIndex(p => p.playerId === user.pubkey);
      
      const userHandicapFromNostr = getGolfHandicap(metadata) || 0;
      const userName = metadata?.name || genUserName(user.pubkey);
      
      if (existingUserIndex >= 0) {
        // User already exists - only update NAME (preserve user-edited handicap)
        const existing = currentPlayers[existingUserIndex];
        if (existing.name === userName) {
          // No change needed
          return prev;
        }
        // Update only the name, keep handicap as-is
        const updatedPlayers = [...currentPlayers];
        updatedPlayers[existingUserIndex] = { ...existing, name: userName };
        return { ...prev!, players: updatedPlayers };
      } else {
        // Add user as Player 1 (at the beginning) - use Nostr handicap as initial value
        const currentUserPlayer: PlayerInRound = {
          playerId: user.pubkey,
          name: userName,
          handicap: userHandicapFromNostr,
          scores: [],
          total: 0,
          netTotal: 0
        };
        return {
          ...prev!,
          players: [currentUserPlayer, ...currentPlayers]
        };
      }
    });
  }, [user, metadata]);

  // Update player names when profile data becomes available
  // Note: Only updates names, NOT handicaps (to preserve user edits)
  useEffect(() => {
    round.players?.forEach((player, index) => {
      const validatedPubkey = validatedPubkeys[index];
      const profileData = profileDataMap[index];
      
      if (validatedPubkey && profileData?.metadata && player.playerId === validatedPubkey) {
        const actualName = profileData.metadata.name || 
                          profileData.metadata.display_name || 
                          genUserName(validatedPubkey);
        
        // Only update name if it's different (preserve user-edited handicaps)
        if (player.name !== actualName) {
          setRound(prev => ({
            ...prev!,
            players: prev!.players?.map((p, i) =>
              i === index ? { 
                ...p, 
                name: actualName
              } : p
            ) || []
          }));
        }
      }
    });
  }, [profileDataMap, validatedPubkeys, round.players]);

  // Helper function to get player initials
  const getPlayerInitials = (playerName: string) => {
    return playerName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Helper function to validate npub and extract pubkey
  const validateNpubInput = async (input: string, playerIndex: number) => {
    const trimmedValue = input.trim();
    
    if (!trimmedValue) {
      setValidatedPubkeys(prev => ({ ...prev, [playerIndex]: null }));
      setPubkeyErrors(prev => ({ ...prev, [playerIndex]: null }));
      setValidatingPlayers(prev => ({ ...prev, [playerIndex]: false }));
      return;
    }

    setValidatingPlayers(prev => ({ ...prev, [playerIndex]: true }));
    setPubkeyErrors(prev => ({ ...prev, [playerIndex]: null }));

    try {
      let pubkey: string;

      if (trimmedValue.startsWith('npub1')) {
        // Decode npub using nip19
        const decoded = nip19.decode(trimmedValue);
        if (decoded.type !== 'npub') {
          throw new Error('Invalid npub format');
        }
        pubkey = decoded.data;
      } else if (/^[a-fA-F0-9]{64}$/.test(trimmedValue)) {
        // Valid hex pubkey
        pubkey = trimmedValue.toLowerCase();
      } else {
        // Regular name input - no validation needed
        setValidatedPubkeys(prev => ({ ...prev, [playerIndex]: null }));
        setValidatingPlayers(prev => ({ ...prev, [playerIndex]: false }));
        return;
      }

      setValidatedPubkeys(prev => ({ ...prev, [playerIndex]: pubkey }));
    } catch {
      setPubkeyErrors(prev => ({ 
        ...prev, 
        [playerIndex]: 'Invalid Nostr public key format' 
      }));
      setValidatedPubkeys(prev => ({ ...prev, [playerIndex]: null }));
    } finally {
      setValidatingPlayers(prev => ({ ...prev, [playerIndex]: false }));
    }
  };

  // Helper function to validate fallback npub input
  const validateFallbackNpubInput = async (input: string) => {
    const trimmedValue = input.trim();
    
    if (!trimmedValue) {
      setFallbackValidatedPubkey(null);
      setFallbackPubkeyError(null);
      setFallbackValidating(false);
      return;
    }

    setFallbackValidating(true);
    setFallbackPubkeyError(null);

    try {
      let pubkey: string;

      if (trimmedValue.startsWith('npub1')) {
        // Decode npub using nip19
        const decoded = nip19.decode(trimmedValue);
        if (decoded.type !== 'npub') {
          throw new Error('Invalid npub format');
        }
        pubkey = decoded.data;
      } else if (/^[a-fA-F0-9]{64}$/.test(trimmedValue)) {
        // Valid hex pubkey
        pubkey = trimmedValue.toLowerCase();
      } else {
        // Regular name input - no validation needed
        setFallbackValidatedPubkey(null);
        setFallbackValidating(false);
        return;
      }

      setFallbackValidatedPubkey(pubkey);
    } catch {
      setFallbackPubkeyError('Invalid Nostr public key format');
      setFallbackValidatedPubkey(null);
    } finally {
      setFallbackValidating(false);
    }
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
        vegas: false,
        sixes: false,
        pinseekrCup: !prev.pinseekrCup
      }));
      // Clear order when enabling Pinseekr Cup
      if (!selectedGameModes.pinseekrCup) {
        setSelectedGameModeOrder([mode]);
      } else {
        setSelectedGameModeOrder([]);
      }
    } else if (selectedGameModes.pinseekrCup) {
      // If any other mode is selected while Pinseekr Cup is active, disable Pinseekr Cup
      setSelectedGameModes(prev => ({
        ...prev,
        pinseekrCup: false,
        [mode]: !prev[mode]
      }));
      // Update order
      const isCurrentlySelected = selectedGameModes[mode];
      if (!isCurrentlySelected) {
        setSelectedGameModeOrder([mode]);
      } else {
        setSelectedGameModeOrder([]);
      }
    } else {
      // Normal toggle for individual game modes
      const isCurrentlySelected = selectedGameModes[mode];
      setSelectedGameModes(prev => ({
        ...prev,
        [mode]: !prev[mode]
      }));
      
      // Update order tracking
      if (!isCurrentlySelected) {
        // Adding a new mode - append to order
        setSelectedGameModeOrder(prev => [...prev, mode]);
      } else {
        // Removing a mode - remove from order
        setSelectedGameModeOrder(prev => prev.filter(m => m !== mode));
      }
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

    // If user opted to persist tournament wagers, build and publish a tournament event
    if (persistTournamentWagers && pinseekrWagersEnabled) {
      try {
        // Build wagers mapping
        const wagers: Record<string, number> = {};
        (pinseekrCupSettings.formatOrder || []).forEach(format => {
          const key = format;
          const current = wagerAmounts[key] || '111';
          const custom = customWagerAmounts[key] || '';
          wagers[key] = current === 'custom' ? (parseInt(custom) || 0) : parseInt(current);
        });

        const tournamentTotal = Object.values(wagers).reduce((s, v) => s + v, 0);

        // Generate invoice placeholders - evenly split placeholder per player (settlement occurs after results)
        const invoicePlaceholders = pinseekrPlayers.map(p => ({
          playerId: p.id,
          amount: Math.round(tournamentTotal / pinseekrPlayers.length),
          invoice: '' // to be filled by settlement process after results
        }));

        // Publish tournament event with wagers and invoice placeholders
        const tournamentEvent = {
          kind: GOLF_KINDS.TOURNAMENT,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['d', `${round.id}-tournament`],
            ['t', 'golf'],
            ['t', 'tournament'],
            ['t', 'pinseekr-cup']
          ],
          content: JSON.stringify({
            tournament: tournamentConfig,
            wagers,
            tournamentTotal,
            invoicePlaceholders,
            note: 'Persisted tournament wagers (placeholders). Actual invoices are generated after results and sent via connected wallet.'
          })
        };

        publishEvent(tournamentEvent, {
          onSuccess: () => {
            toast({
              title: 'Tournament Published',
              description: 'Tournament and wagers published to Nostr.'
            });
          },
          onError: () => {
            toast({ title: 'Publish Failed', description: 'Failed to publish tournament wagers.', variant: 'destructive' });
          }
        });
      } catch (err) {
        console.error('Error publishing tournament wagers', err);
        toast({ title: 'Error', description: 'Could not publish wagers.', variant: 'destructive' });
      }
    }
    toast({
      title: "Tournament Created",
      description: `${presetConfigurations[pinseekrCupSettings.presetMode].name} tournament created with ${pinseekrPlayers.length} players and 3 formats.`,
    });
  };

  // NWC helper: get active connection/client
  const nwc = useNWC();
  const getNwcClient = () => {
    try {
      const active = nwc.getActiveConnection();
      if (!active || !active.connectionString) return null;
      return new LN(active.connectionString);
    } catch (err) {
      console.error('Failed to construct NWC LN client', err);
      return null;
    }
  };

  // Generate settlement invoices (simple even-split example) and publish settlement event
  const generateAndPublishSettlement = async () => {
    if (!user) {
      toast({ title: 'Login required', description: 'You must be logged in to generate invoices.', variant: 'destructive' });
      return;
    }

    const players = round.players || [];
    if (players.length === 0) {
      toast({ title: 'No players', description: 'Add players before settling wagers.', variant: 'destructive' });
      return;
    }

    // Determine total to invoice depending on tournament or normal wagers
    let totalToCollect = 0;
    if (selectedGameModes.pinseekrCup && pinseekrWagersEnabled) {
      totalToCollect = (pinseekrCupSettings.formatOrder || []).reduce((sum, format) => {
        const current = wagerAmounts[format] || '111';
        const custom = customWagerAmounts[format] || '';
        return sum + (current === 'custom' ? (parseInt(custom) || 0) : parseInt(current));
      }, 0);
    } else if (wagersEnabled) {
      // sum selected game mode wagers
      totalToCollect = selectedGameModeList.reduce((sum, gameMode) => {
        const currentAmount = wagerAmounts[gameMode.key] || '111';
        const customAmount = customWagerAmounts[gameMode.key] || '';
        const wagerValue = currentAmount === 'custom' ? (parseInt(customAmount) || 0) : parseInt(currentAmount);
        return sum + wagerValue;
      }, 0);
    }

    if (totalToCollect <= 0) {
      toast({ title: 'No wagers', description: 'No wagers configured to settle.', variant: 'destructive' });
      return;
    }

    // (per-player split removed — we compute game-specific net settlements)

    const client = getNwcClient();
    if (!client) {
      toast({ title: 'Wallet not connected', description: 'No active NWC connection available to create invoices.', variant: 'destructive' });
      return;
    }

      // Compute detailed payments using game-specific engines
      const payables: Payable[] = [];

      // Convert round players to core data for engines
      const coreData = convertToRoundData((round.players || []).map(p => ({ playerId: p.playerId, scores: p.scores || [], handicap: p.handicap || 0 })));

      // Build gameConfigs for processRoundWagers (Nassau & Skins)
      const gameConfigs: { [gameName: string]: import('@/lib/golf/scoringEngine').WagerConfig } = {};
      selectedGameModeList.forEach(gm => {
        if (!wagersEnabled && !(selectedGameModes.pinseekrCup && pinseekrWagersEnabled)) return;
        const key = gm.key;
        const current = wagerAmounts[key] || '111';
        const custom = customWagerAmounts[key] || '';
        const unit = current === 'custom' ? (parseInt(custom) || 0) : parseInt(current);

        if (key === 'nassau') gameConfigs['Nassau'] = { useNet: true, unitSats: unit };
        if (key === 'skins') gameConfigs['Skins'] = { useNet: true, unitSats: unit, carryCap: 4 };
      });

      if (Object.keys(gameConfigs).length > 0) {
        const results = processRoundWagers(round.players || [], gameConfigs);
        for (const r of Object.values(results)) {
          payables.push(...r.ledger);
        }
      }

      // Dots game
      if ((selectedGameModes.dots && wagersEnabled) || (selectedGameModes.pinseekrCup && pinseekrWagersEnabled && wagerAmounts['dots'])) {
        const dotsCfg = { wagerPerDot: parseInt(customWagerAmounts['dots'] || (wagerAmounts['dots'] === 'custom' ? '0' : (wagerAmounts['dots'] || '100'))) || 100 };
        const dotsData = convertToDotsData(coreData);
        const dotsResult = dotsEngine(dotsData, dotsCfg);
        // transform dotsResult.payments to Payable
        for (const p of dotsResult.payments) {
          payables.push({ from: p.from, to: p.to, amount: p.amount, memo: p.reason });
        }
      }

      // Snake game
      if ((selectedGameModes.snake && wagersEnabled) || (selectedGameModes.pinseekrCup && pinseekrWagersEnabled && wagerAmounts['snake'])) {
        const snakeData = convertToSnakeData(coreData);
        const snakeResult = snakeEngine(snakeData, { penaltyAmount: parseInt(customWagerAmounts['snake'] || (wagerAmounts['snake'] === 'custom' ? '0' : (wagerAmounts['snake'] || '100'))) || 500 });
        if (snakeResult.penalty && snakeResult.penalty.loser) {
          // recipients is array of {playerId, amount}
          for (const rec of snakeResult.penalty.recipients || []) {
            const from = snakeResult.penalty.loser;
            const to = rec.playerId;
            payables.push({ from, to, amount: rec.amount, memo: 'Snake penalty' });
          }
        }
      }

      // Net the payments
      const netted = netting(payables);

      // Aggregate netted payments by recipient (one invoice per recipient)
      const aggregateByRecipient = (items: Payable[]): AggregatedInvoice[] => {
        const m = new Map<string, { amount: number; payers: Set<string>; memo?: string }>();
        for (const it of items) {
          if (it.amount <= 0) continue;
          const cur = m.get(it.to) || { amount: 0, payers: new Set<string>(), memo: it.memo };
          cur.amount += it.amount;
          cur.payers.add(it.from);
          m.set(it.to, cur);
        }
        return Array.from(m.entries()).map(([recipient, v]) => ({ recipient, amount: v.amount, payers: Array.from(v.payers), memo: v.memo }));
      };

      const aggregated = aggregateByRecipient(netted);

      // Prepare aggregated preview and show modal for confirmation
      setSettlementPreview(aggregated);
      setShowSettlementPreview(true);
  };

    const confirmSettlementAndCreateInvoices = async () => {
      if (!user) {
        toast({ title: 'Login required', description: 'You must be logged in to generate invoices.', variant: 'destructive' });
        return;
      }

      const client = getNwcClient();
      if (!client) {
        toast({ title: 'Wallet not connected', description: 'No active NWC connection available to create invoices.', variant: 'destructive' });
        return;
      }

      setIsCreatingInvoices(true);

      const clientAny = client as unknown as Record<string, unknown>;
      const tryFn = async (fnName: string, ...args: unknown[]) => {
        const fn = clientAny[fnName];
        if (typeof fn === 'function') {
          try {
            const res = (fn as (...a: unknown[]) => Promise<unknown> | unknown)(...args);
            return await Promise.resolve(res);
          } catch {
            return null;
          }
        }
        return null;
      };

      const extractBolt11 = (resp: unknown): string => {
        if (!resp || typeof resp !== 'object') return '';
        const r = resp as Record<string, unknown>;
        const candidates = ['invoice', 'payment_request', 'pr', 'bolt11', 'paymentRequest'];
        for (const key of candidates) {
          const val = r[key];
          if (typeof val === 'string' && val.length > 0) return val;
        }
        return '';
      };

      const invoicesResult: Array<{ recipient: string; amount: number; bolt11: string }> = [];

      // settlementPreview is now aggregated per recipient
      for (const agg of settlementPreview) {
        const recipient = agg.recipient;
        const amount = agg.amount;

        if (recipient === user.pubkey) {
          try {
            const response = await tryFn('createInvoice', { amount, memo: `Wager settlement: collect ${amount} sats` })
              ?? await tryFn('invoice', amount, `Wager settlement: collect ${amount} sats`)
              ?? await tryFn('requestInvoice', amount, `Wager settlement: collect ${amount} sats`);

            const bolt11 = extractBolt11(response);
            invoicesResult.push({ recipient, amount, bolt11 });
          } catch (err) {
            console.error('Invoice creation failed for recipient', recipient, err);
            invoicesResult.push({ recipient, amount, bolt11: '' });
            toast({ title: 'Invoice error', description: `Failed to create invoice for ${recipient}`, variant: 'destructive' });
          }
        } else {
          // Placeholder - recipient must create invoice themselves or host-collect option used
          invoicesResult.push({ recipient, amount, bolt11: '' });
        }
      }

      // Publish settlement event with payments and invoices (some may be placeholders)
      try {
        const settlementEvent: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'> = {
          kind: GOLF_KINDS.RESULT,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['d', `${round.id}-result`],
            ['t', 'golf'],
            ['t', 'settlement'],
            ['round', `${round.id ?? ''}`]
          ],
          content: JSON.stringify({ payments: settlementPreview, invoices: invoicesResult, note: 'Net settlement (some invoices may be placeholders)' })
        };

        await publishEvent(settlementEvent);
        toast({ title: 'Settlement published', description: 'Settlement published with invoices/placeholders.' });
        setShowSettlementPreview(false);
      } catch (err) {
        console.error('Failed to publish settlement event', err);
        toast({ title: 'Publish failed', description: 'Could not publish settlement event.', variant: 'destructive' });
      } finally {
        setIsCreatingInvoices(false);
      }
    };

  const generateRoundCode = async () => {
    if (hasGeneratedRoundCode) {
      toast({ title: 'Round code already generated', description: 'A round code has already been created for this setup.' });
      return;
    }

    if (!user) {
      toast({ title: 'Login required', description: 'Please log in to generate a round code', variant: 'destructive' });
      return;
    }

    // Generate a unique 6-character round code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Create the join URL
    const joinUrl = `${window.location.origin}/join/${code}`;
    
    try {
      // Publish the round to Nostr so others can find it by round-code
      const roundToPublish: GolfRound = {
        id: round.id || generateRoundId(),
        courseId: selectedCourse?.id || '',
        date: round.date || Date.now(),
        players: round.players || [],
        gameMode: round.gameMode || GameMode.STROKE_PLAY,
        holes: round.holes || [],
        status: 'active',
        metadata: {
          courseName: round.metadata?.courseName || selectedCourse?.name || 'Unknown Course',
          courseLocation: round.metadata?.courseLocation || selectedCourse?.location || '',
          teeBox: round.metadata?.teeBox || '',
          weather: round.metadata?.weather || '',
          notes: round.metadata?.notes || ''
        }
      };

      const roundEvent = createRoundEvent(roundToPublish, code);
      await publishEvent(roundEvent);

      // Also publish the current user as a player
      const hostPlayer: PlayerInRound = {
        playerId: user.pubkey,
        name: metadata?.name || genUserName(user.pubkey),
        handicap: getGolfHandicap(metadata) || 0,
        scores: [],
        total: 0,
        netTotal: 0
      };
      const playerEvent = createPlayerEvent(hostPlayer, roundToPublish.id);
      await publishEvent(playerEvent);

      // Generate QR Code
      const qrDataUrl = await QRCode.toDataURL(joinUrl, {
        width: 128,
        margin: 1,
        color: {
          dark: '#333333',
          light: '#FFFFFF'
        }
      });
      
      setRoundCode(code);
      setQrCodeUrl(qrDataUrl);
      setShowRoundCode(true);

      // Copy to clipboard
      navigator.clipboard.writeText(joinUrl).then(() => {
        toast({
          title: "Round Published",
          description: `Code ${code} generated! Join URL copied to clipboard. Share it with your playing partners.`,
        });
      });
    } catch (error) {
      console.error('Error generating round code:', error);
      toast({
        title: "Error",
        description: "Failed to publish round. Please try again.",
        variant: "destructive",
      });
    }
    // mark as generated to prevent further generation for this open setup
    setHasGeneratedRoundCode(true);
  };

  const handleCourseSelect = (course: GolfCourse) => {
    setSelectedCourse(course);
    setRound(prev => ({
      ...prev!,
      metadata: {
        ...prev!.metadata!,
        courseName: course.name,
        courseLocation: course.location
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
    // Handle name field with npub validation
    if (field === 'name') {
      const nameValue = value as string;
      
      // Validate input for npub format
      validateNpubInput(nameValue, index);
      
      // Check if we have validated profile data to use
      const validatedPubkey = validatedPubkeys[index];
      const profileData = profileDataMap[index];
      
      let actualName = nameValue;
      let playerId = `player-${index + 1}`;
      
      if (validatedPubkey && profileData?.metadata) {
        // Use profile data if available
        actualName = profileData.metadata.name || 
                    profileData.metadata.display_name || 
                    genUserName(validatedPubkey);
        playerId = validatedPubkey;
        
        // Also get handicap from profile
        const profileHandicap = getGolfHandicap(profileData.metadata) || 0;
        
        setRound(prev => ({
          ...prev!,
          players: prev!.players?.map((player, i) =>
            i === index ? { 
              ...player, 
              name: actualName,
              playerId: playerId,
              handicap: profileHandicap
            } : player
          ) || []
        }));
      } else if (validatedPubkey) {
        // Use generated name for valid pubkey without profile data
        actualName = genUserName(validatedPubkey);
        playerId = validatedPubkey;
        
        setRound(prev => ({
          ...prev!,
          players: prev!.players?.map((player, i) =>
            i === index ? { 
              ...player, 
              name: actualName,
              playerId: playerId
            } : player
          ) || []
        }));
      } else {
        // No valid pubkey, just update name and playerId
        setRound(prev => ({
          ...prev!,
          players: prev!.players?.map((player, i) =>
            i === index ? { 
              ...player, 
              name: actualName,
              playerId: playerId
            } : player
          ) || []
        }));
      }
      return;
    }
    
    // Handle other fields normally
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
    
    // Also clean up validation state for removed player index
    setValidatedPubkeys(prev => {
      const newState = { ...prev };
      delete newState[index];
      
      // Reindex remaining players to maintain consistency
      const reindexed: { [index: number]: string | null } = {};
      Object.entries(newState).forEach(([key, value]) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = value;
        } else {
          reindexed[oldIndex] = value;
        }
      });
      
      return reindexed;
    });
    
    setPubkeyErrors(prev => {
      const newState = { ...prev };
      delete newState[index];
      
      // Reindex remaining errors
      const reindexed: { [index: number]: string | null } = {};
      Object.entries(newState).forEach(([key, value]) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = value;
        } else {
          reindexed[oldIndex] = value;
        }
      });
      
      return reindexed;
    });
    
    setValidatingPlayers(prev => {
      const newState = { ...prev };
      delete newState[index];
      
      // Reindex remaining validation states
      const reindexed: { [index: number]: boolean } = {};
      Object.entries(newState).forEach(([key, value]) => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = value;
        } else {
          reindexed[oldIndex] = value;
        }
      });
      
      return reindexed;
    });
    
    // NOTE: Deliberately NOT clearing fallbackPlayerInput to keep text entry persistent
  };

  const initializeHoles = () => {
    // Determine hole numbers based on user's choice: 9, 18, or full (+)
    const totalCourseHoles = selectedCourse?.holes ? Math.max(...Object.keys(selectedCourse.holes).map(Number)) : 18;

    const holeNumbers: number[] = [];
    if (holeCountChoice === 9) {
      // If course provides named sections and a selectedSection is set, use that 9-hole block
      const selectedSectionKey = round.metadata?.selectedSection;
      if (selectedCourse?.sections && selectedSectionKey && typeof selectedSectionKey !== 'undefined') {
        const sectionIndex = parseInt(String(selectedSectionKey), 10) || 0;
        const sectionStart = sectionIndex * 9 + 1;
        const sectionEnd = Math.min(sectionStart + 8, totalCourseHoles);
        for (let h = sectionStart; h <= sectionEnd; h++) holeNumbers.push(h);
      } else {
        // Default to front 9
        for (let h = 1; h <= Math.min(9, totalCourseHoles); h++) holeNumbers.push(h);
      }
    } else if (holeCountChoice === 18) {
      for (let h = 1; h <= Math.min(18, totalCourseHoles); h++) holeNumbers.push(h);
    } else {
      // Custom / + — use requested holeCountChoice but cap at course total
      const desired = Math.max(1, Math.min(holeCountChoice || totalCourseHoles, totalCourseHoles));
      for (let h = 1; h <= desired; h++) holeNumbers.push(h);
    }

    const holes = holeNumbers.map((holeNumber) => {
      const par = selectedCourse?.holes?.[holeNumber] || 4;
      return {
        holeNumber,
        par,
        strokes: 0,
        putts: 0,
        fairways: false,
        greens: false,
        chips: 0,
        sandTraps: 0,
        penalties: 0,
        notes: ''
      };
    });

    setRound(prev => ({
      ...prev!,
      holes,
      players: prev!.players?.map(player => ({
        ...player,
        scores: Array(holes.length).fill(0)
      })) || []
    }));
  };

  const saveRound = () => {
    if (!selectedCourse || !round.players || round.players.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a course and add at least one player.",
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
    // Build a minimal GameSettings object for persistence. Default to net scoring off.
    const settings = {
      useHandicaps,
      netScoring,
      modifiedStableford,
      // Optionally persist whether wagers are included for this game
      allowWagers: persistWagers && wagersEnabled,
    };

    const gameEvent = createGameEvent(
      round.gameMode || GameMode.STROKE_PLAY,
      round.players || [],
      round.id || '',
      settings
    );

    // If user selected to persist wagers for normal modes, attach wagers into game event tags/content
    if (persistWagers && wagersEnabled) {
      try {
        const wagersData: Record<string, number> = {};
        selectedGameModeList.forEach(gm => {
          const current = wagerAmounts[gm.key] || '111';
          const custom = customWagerAmounts[gm.key] || '';
          wagersData[gm.key] = current === 'custom' ? (parseInt(custom) || 0) : parseInt(current);
        });

        (gameEvent.tags as string[][]).push(['wagers', JSON.stringify(wagersData)]);
      } catch (err) {
        console.error('Failed to attach wagers to game event', err);
      }
    }

    publishEvent(gameEvent, {
      onError: (error) => {
        console.error('Error publishing game event:', error);
      }
    });
  };

  const startRound = () => {
    if (!selectedCourse || !round.players || round.players.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a course and add at least one player.",
        variant: "destructive",
      });
      return;
    }
    setStep('scoring');
  };

  if (step === 'setup') {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-4">
          <div className="container mx-auto px-2">
            <div className="max-w-4xl mx-auto">
              <Card className="bg-transparent border-0 shadow-none">
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
                    {/* Streamlined Players Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Who's Playing?
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {user ? 'Add friends to track scores together' : 'Connect your Nostr identity to save scores and compete'}
                          </p>
                        </div>
                      </div>

                      {/* If we loaded this page via a join link and the current user is not in the round, show Join CTA */}
                      {round.id && user && !((round.players || []).some(p => p.playerId === user.pubkey)) && (
                        <div className="p-3 mb-3 rounded-md bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium">You've been invited to join this round</p>
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  Invited
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">Join now to appear for other players in the lobby</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button onClick={acceptInvite} className="bg-purple-600 hover:bg-purple-700 text-white">Join Round</Button>
                            </div>
                          </div>
                        </div>
                      )}



                      {/* Players List */}
                      <div className="space-y-2">
                        {round.players && round.players.length > 0 ? (
                          round.players.map((player, index) => {
                            // Check if this player has a verified profile or is the logged-in user
                            const isCurrentUser = player.playerId === user?.pubkey;
                            const hasNostrProfile = (validatedPubkeys[index] || (player.playerId.length === 64 && /^[a-fA-F0-9]{64}$/.test(player.playerId))) && profileDataMap[index]?.metadata;
                            
                            // Get display name
                            const displayName = isCurrentUser 
                              ? (player.name || metadata?.name || metadata?.display_name || genUserName(user.pubkey))
                              : hasNostrProfile
                                ? (profileDataMap[index]?.metadata?.name || profileDataMap[index]?.metadata?.display_name || genUserName(validatedPubkeys[index] || player.playerId))
                                : player.name;
                            
                            // Get avatar picture
                            const avatarPicture = isCurrentUser 
                              ? metadata?.picture 
                              : profileDataMap[index]?.metadata?.picture;
                            
                            return (
                              <div 
                                key={player.playerId} 
                                className={`p-3 rounded-lg border ${
                                  isCurrentUser 
                                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                                    : 'bg-card border-border'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Avatar */}
                                  <Avatar className="h-10 w-10 flex-shrink-0">
                                    {avatarPicture && <AvatarImage src={avatarPicture} />}
                                    <AvatarFallback className={`${isCurrentUser ? "bg-green-600" : "bg-blue-600"} text-white text-sm`}>
                                      {getPlayerInitials(displayName || player.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  
                                  {/* Name Section */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">
                                        Player {index + 1}{isCurrentUser && ' (You)'}
                                      </span>
                                      {(isCurrentUser || hasNostrProfile) && (
                                        <CheckCircle className="h-3 w-3 text-green-600" />
                                      )}
                                    </div>
                                    {isCurrentUser || hasNostrProfile ? (
                                      <p className="font-medium truncate">{displayName}</p>
                                    ) : (
                                      <div className="relative">
                                        <Input
                                          id={`name-${player.playerId}`}
                                          placeholder="Name or npub"
                                          value={player.name}
                                          onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                                          className={`h-8 ${pubkeyErrors[index] ? "border-destructive" : ""}`}
                                        />
                                        {validatingPlayers[index] && (
                                          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                        )}
                                      </div>
                                    )}
                                    {pubkeyErrors[index] && (
                                      <p className="text-xs text-destructive mt-1">{pubkeyErrors[index]}</p>
                                    )}
                                  </div>
                                  
                                  {/* HCP Input */}
                                  <div className="w-16 flex-shrink-0">
                                    <Label htmlFor={`handicap-${player.playerId}`} className="text-xs text-muted-foreground">HCP</Label>
                                    <Input
                                      id={`handicap-${player.playerId}`}
                                      type="tel"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      min="0"
                                      max="54"
                                      value={player.handicap || ''}
                                      onChange={(e) => {
                                        const digits = e.target.value.replace(/[^0-9]/g, '');
                                        const value = digits === '' ? 0 : parseInt(digits);
                                        updatePlayer(index, 'handicap', isNaN(value) ? 0 : value);
                                      }}
                                      onContextMenu={(e) => e.preventDefault()}
                                      className="h-8 text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                                    />
                                  </div>
                                  
                                  {/* Delete Button */}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => removePlayer(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-6 text-center text-muted-foreground border border-dashed rounded-lg">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No players added yet</p>
                            <p className="text-sm">Add players below to get started</p>
                          </div>
                        )}
                      </div>

                      {/* Add Player Input */}
                      {(round.players?.length || 0) < 4 && (
                        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              {fallbackValidatedPubkey && fallbackProfileData?.metadata?.picture && (
                                <AvatarImage src={fallbackProfileData.metadata.picture} />
                              )}
                              <AvatarFallback className="bg-yellow-500 text-white text-sm">
                                {fallbackPlayerInput ? getPlayerInitials(fallbackProfileData?.metadata?.name || fallbackPlayerInput) : '+'}
                              </AvatarFallback>
                            </Avatar>
                            
                            {/* Name Input / Profile Display */}
                            <div className="flex-1 min-w-0">
                              <span className="text-xs text-muted-foreground">Add Player {(round.players?.length || 0) + 1}</span>
                              {fallbackValidatedPubkey && fallbackProfileData?.metadata ? (
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">
                                    {fallbackProfileData.metadata.name || fallbackProfileData.metadata.display_name || genUserName(fallbackValidatedPubkey)}
                                  </p>
                                  <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                                </div>
                              ) : (
                                <div className="relative">
                                  <Input
                                    id="quick-add-player"
                                    placeholder="Name or npub"
                                    value={fallbackPlayerInput}
                                    onChange={(e) => {
                                      setFallbackPlayerInput(e.target.value);
                                      validateFallbackNpubInput(e.target.value);
                                    }}
                                    className={`h-8 ${fallbackPubkeyError ? "border-destructive" : "border-yellow-300 focus:border-yellow-500"}`}
                                  />
                                  {fallbackValidating && (
                                    <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                  )}
                                </div>
                              )}
                              {fallbackPubkeyError && (
                                <p className="text-xs text-destructive mt-1">{fallbackPubkeyError}</p>
                              )}
                            </div>
                            
                            {/* HCP Input */}
                            <div className="w-16 flex-shrink-0">
                              <Label htmlFor="quick-handicap" className="text-xs text-muted-foreground">HCP</Label>
                              <Input
                                id="quick-handicap"
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min="0"
                                max="54"
                                defaultValue={0}
                                onContextMenu={(e) => e.preventDefault()}
                                className="h-8 text-center border-yellow-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 focus:outline-none"
                              />
                            </div>
                            
                            {/* Add Button */}
                            <Button
                              variant="default"
                              size="sm"
                              disabled={!fallbackPlayerInput.trim()}
                              className="h-8 px-3 bg-yellow-500 hover:bg-yellow-600 text-black flex-shrink-0"
                              onClick={() => {
                                if (!fallbackPlayerInput.trim()) return;
                                
                                const playerId = fallbackValidatedPubkey || `player-${(round.players?.length || 0) + 1}`;
                                
                                // Check if player already exists
                                if (round.players?.find(p => p.playerId === playerId)) {
                                  setFallbackPlayerInput('');
                                  setFallbackValidatedPubkey(null);
                                  setFallbackPubkeyError(null);
                                  setFallbackValidating(false);
                                  return;
                                }
                                
                                const actualName = fallbackValidatedPubkey && fallbackProfileData?.metadata
                                  ? (fallbackProfileData.metadata.name || fallbackProfileData.metadata.display_name || genUserName(fallbackValidatedPubkey))
                                  : fallbackValidatedPubkey 
                                    ? genUserName(fallbackValidatedPubkey) 
                                    : fallbackPlayerInput.trim();
                                
                                const newPlayer: PlayerInRound = {
                                  playerId,
                                  name: actualName,
                                  handicap: 0,
                                  scores: [],
                                  total: 0,
                                  netTotal: 0
                                };
                                
                                setRound(prev => ({
                                  ...prev!,
                                  players: [...(prev!.players || []), newPlayer]
                                }));
                                
                                if (fallbackValidatedPubkey) {
                                  const newPlayerIndex = round.players?.length || 0;
                                  setValidatedPubkeys(prev => ({ ...prev, [newPlayerIndex]: fallbackValidatedPubkey }));
                                }
                                
                                setFallbackPlayerInput('');
                                setFallbackValidatedPubkey(null);
                                setFallbackPubkeyError(null);
                                setFallbackValidating(false);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Button 
                            type="button" 
                            onClick={addPlayer} 
                            variant="outline"
                            className="w-full"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Another Player
                          </Button>
                          <Button 
                            type="button" 
                            onClick={generateRoundCode} 
                            disabled={hasGeneratedRoundCode}
                            variant="outline"
                            className="w-full"
                          >
                            <QrCode className="mr-2 h-4 w-4" />
                            {hasGeneratedRoundCode ? 'Round Code Generated' : 'Share Round Code'}
                          </Button>
                          {showJoinInput ? (
                            <div className="relative">
                              <Input
                                type="text"
                                placeholder="Enter round code"
                                value={joinCodeInput}
                                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                                className="w-full font-mono uppercase"
                                maxLength={8}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && joinCodeInput.trim()) {
                                    navigate(`/join/${joinCodeInput.trim()}`);
                                    setShowJoinInput(false);
                                    setJoinCodeInput('');
                                  } else if (e.key === 'Escape') {
                                    setShowJoinInput(false);
                                    setJoinCodeInput('');
                                  }
                                }}
                                onBlur={() => {
                                  // Delay hiding to allow for button clicks
                                  setTimeout(() => {
                                    setShowJoinInput(false);
                                    setJoinCodeInput('');
                                  }, 150);
                                }}
                              />
                            </div>
                          ) : (
                            <Button 
                              type="button" 
                              onClick={() => setShowJoinInput(true)}
                              variant="outline"
                              className="w-full"
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Join Round
                            </Button>
                          )}
                        </div>
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

                    {/* Auto-Join Confirmation Dialog (when redirected with autoJoin=1) */}
                    <Dialog open={showAutoJoinConfirm} onOpenChange={setShowAutoJoinConfirm}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Join Round</DialogTitle>
                          <DialogDescription>
                            You were redirected here to join this round. Do you want to join as <strong>{metadata?.name ?? (user?.pubkey ? genUserName(user.pubkey) : 'yourself')}</strong>?
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 flex justify-end gap-2">
                          <Button variant="ghost" onClick={() => setShowAutoJoinConfirm(false)}>Cancel</Button>
                          <Button
                            onClick={async () => {
                              // Ensure signer is available
                              if (!user) {
                                toast({ title: 'Login required', description: 'Please log in to join this round', variant: 'destructive' });
                                return;
                              }

                              if (!user.signer || typeof (user.signer as unknown as { signEvent?: unknown }).signEvent !== 'function') {
                                toast({
                                  title: 'Wallet not available',
                                  description: 'Your wallet/extension does not support in-page signing for this site. Please use a browser wallet (Alby) or enable signing in KeyChat and try again.',
                                  variant: 'destructive'
                                });
                                return;
                              }

                              try {
                                await acceptInvite();
                                setShowAutoJoinConfirm(false);
                                toast({ title: 'Joined', description: 'You have joined the round.' });
                              } catch (err) {
                                console.error('Auto-join failed', err);
                                toast({ title: 'Error', description: 'Failed to join the round', variant: 'destructive' });
                              }
                            }}
                            variant="default"
                          >
                            Confirm Join
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                      {/* Game Modes Section */}
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Trophy className="h-5 w-5" />
                            What games?
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
                            {/* Pinseekr Cup wagers UI moved below format preview as requested. */}
                            
                            {selectedGameModes.pinseekrCup && (
                              <div className="space-y-4 mt-4">
                                {/* Tournament Settings */}
                                <div className="space-y-4">
                                  {/* Tournament Style and Holes per Format - Side by Side */}
                                  <div className="flex flex-col md:flex-row gap-6 items-start">
                                    {/* Tournament Style */}
                                    <div className="space-y-2 flex-1">
                                      <Label>Tournament Style</Label>
                                      <Select value={pinseekrCupSettings.presetMode} onValueChange={handlePresetModeChange}>
                                        <SelectTrigger className="w-full md:min-w-[350px]">
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

                                {/* Pinseekr Cup Wagers (visible after Pinseekr Cup selected) */}
                                {selectedGameModes.pinseekrCup && (
                                  <div className="mb-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <Switch
                                          id="pinseekr-wagers-toggle"
                                          checked={pinseekrWagersEnabled}
                                          onCheckedChange={setPinseekrWagersEnabled}
                                          className="data-[state=checked]:bg-yellow-600"
                                        />
                                        <div className="flex items-center gap-2">
                                          <Zap className="h-4 w-4 text-yellow-600" />
                                          <Label htmlFor="pinseekr-wagers-toggle" className="text-sm font-semibold text-yellow-700">Wagers for Pinseekr Cup</Label>
                                        </div>
                                      </div>
                                      {pinseekrWagersEnabled && (
                                        <div className="flex items-center gap-3">
                                          <Checkbox
                                            id="persist-tournament-wagers"
                                            checked={persistTournamentWagers}
                                            onCheckedChange={(v) => setPersistTournamentWagers(!!v)}
                                          />
                                          <div>
                                            <Label htmlFor="persist-tournament-wagers" className="text-sm font-medium">Publish wagers with tournament</Label>
                                            <div className="text-xs text-muted-foreground">Include per-format wagers in the published tournament event (optional)</div>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {pinseekrWagersEnabled && (
                                      <div className="mt-3 space-y-3">
                                        {(pinseekrCupSettings.formatOrder || []).map((format) => {
                                          const key = format;
                                          const currentWagerAmount = wagerAmounts[key] || '111';
                                          const currentCustomAmount = customWagerAmounts[key] || '';
                                          const isEditingCustom = editingCustom[key] || false;

                                          const setFormatWagerAmount = (amount: '111' | '1111' | 'custom') => {
                                            setWagerAmounts(prev => ({ ...prev, [key]: amount }));
                                            if (amount === 'custom') setEditingCustom(prev => ({ ...prev, [key]: true }));
                                            else setEditingCustom(prev => ({ ...prev, [key]: false }));
                                          };

                                          const setFormatCustomAmount = (amount: string) => {
                                            setCustomWagerAmounts(prev => ({ ...prev, [key]: amount }));
                                          };

                                          const finishEditingCustom = () => {
                                            setEditingCustom(prev => ({ ...prev, [key]: false }));
                                          };

                                          return (
                                            <div key={key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                              <div className="flex-1">
                                                <div className="text-sm font-medium">{formatDisplayNames[format]}</div>
                                                <div className="text-xs text-muted-foreground">Sats per format</div>
                                              </div>
                                              <div className="flex items-center space-x-2 ml-4">
                                                <Button
                                                  variant={currentWagerAmount === '111' ? 'default' : 'outline'}
                                                  size="sm"
                                                  onClick={() => setFormatWagerAmount('111')}
                                                  className={`h-7 px-3 text-xs ${currentWagerAmount === '111' ? 'bg-yellow-600 hover:bg-yellow-700' : 'border-yellow-300 text-yellow-700'}`}
                                                >
                                                  <Zap className="h-3 w-3 mr-1" />111
                                                </Button>
                                                <Button
                                                  variant={currentWagerAmount === '1111' ? 'default' : 'outline'}
                                                  size="sm"
                                                  onClick={() => setFormatWagerAmount('1111')}
                                                  className={`h-7 px-3 text-xs ${currentWagerAmount === '1111' ? 'bg-yellow-600 hover:bg-yellow-700' : 'border-yellow-300 text-yellow-700'}`}
                                                >
                                                  <Zap className="h-3 w-3 mr-1" />1.1k
                                                </Button>
                                                {currentWagerAmount === 'custom' && isEditingCustom ? (
                                                  <Input
                                                    type="number"
                                                    placeholder="Enter sats"
                                                    value={currentCustomAmount}
                                                    onChange={(e) => setFormatCustomAmount(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                                                    onBlur={() => {
                                                      finishEditingCustom();
                                                      if (!currentCustomAmount.trim()) setFormatWagerAmount('111');
                                                    }}
                                                    className="h-7 w-20 px-2 text-xs border-yellow-300"
                                                    autoFocus
                                                  />
                                                ) : (
                                                  <Button
                                                    variant={currentWagerAmount === 'custom' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => {
                                                      if (currentWagerAmount === 'custom' && currentCustomAmount) {
                                                        setFormatCustomAmount('');
                                                        setFormatWagerAmount('custom');
                                                      } else {
                                                        setFormatWagerAmount('custom');
                                                      }
                                                    }}
                                                    className={`h-7 px-3 text-xs ${currentWagerAmount === 'custom' ? 'bg-yellow-600 hover:bg-yellow-700' : 'border-yellow-300 text-yellow-700'}`}
                                                  >
                                                    {currentWagerAmount === 'custom' && currentCustomAmount && !isEditingCustom ? (
                                                      <><Zap className="h-3 w-3 mr-1" />{currentCustomAmount}</>
                                                    ) : 'Custom'}
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}

                                        {/* Tournament Wager Total */}
                                        <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Tournament Pot</span>
                                            <span className="text-lg font-bold text-blue-900 dark:text-blue-100">{(() => {
                                              const total = (pinseekrCupSettings.formatOrder || []).reduce((sum, format) => {
                                                const current = wagerAmounts[format] || '111';
                                                const custom = customWagerAmounts[format] || '';
                                                const val = current === 'custom' ? (parseInt(custom) || 0) : parseInt(current);
                                                return sum + val;
                                              }, 0);
                                              return `${total.toLocaleString()} sats`;
                                            })()}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
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

                        {/* Game Mode Selection Interface */}
                        {!selectedGameModes.pinseekrCup && (
                          <div className="space-y-4">
                            <div className="text-center">
                              <h4 className="text-xl font-semibold mb-2">Select Game Mode(s)</h4>
                              <p className="text-muted-foreground">Choose how you want to score your round</p>
                            </div>
                            
                            <div data-hide-badges className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {/* Stroke Play */}
                              <div 
                                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                                  selectedGameModes.strokePlay 
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-950 shadow-lg shadow-purple-200 dark:shadow-purple-900' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 bg-white dark:bg-gray-800'
                                }`}
                                onClick={() => toggleGameMode('strokePlay')}
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                    <span className="text-purple-600 dark:text-purple-400 font-bold">⭕</span>
                                  </div>
                                  <h3 className="font-semibold text-lg">Stroke Play</h3>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  Traditional scoring - lowest total score wins
                                </p>
                                {selectedGameModes.strokePlay && (
                                  <div className="absolute top-2 right-2">
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-600 text-white rounded-full">
                                      Selected
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Match Play */}
                              <div 
                                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                                  selectedGameModes.matchPlay 
                                    ? 'border-red-500 bg-red-50 dark:bg-red-950 shadow-lg shadow-red-200 dark:shadow-red-900' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-600 bg-white dark:bg-gray-800'
                                }`}
                                onClick={() => toggleGameMode('matchPlay')}
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                                    <span className="text-red-600 dark:text-red-400 font-bold">👥</span>
                                  </div>
                                  <h3 className="font-semibold text-lg">Match Play</h3>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  Head-to-head competition - hole-by-hole scoring
                                </p>
                                {selectedGameModes.matchPlay && (
                                  <div className="absolute top-2 right-2">
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-600 text-white rounded-full">
                                      Selected
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Skins */}
                              <div 
                                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                                  selectedGameModes.skins 
                                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950 shadow-lg shadow-yellow-200 dark:shadow-yellow-900' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-600 bg-white dark:bg-gray-800'
                                }`}
                                onClick={() => toggleGameMode('skins')}
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                                    <span className="text-yellow-600 dark:text-yellow-400 font-bold">💰</span>
                                  </div>
                                  <h3 className="font-semibold text-lg">Skins</h3>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  Win individual holes - lowest score on each hole wins
                                </p>
                                {selectedGameModes.skins && (
                                  <div className="absolute top-2 right-2">
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-yellow-600 text-white rounded-full">
                                      Selected
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Nassau */}
                              <div 
                                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                                  selectedGameModes.nassau 
                                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950 shadow-lg shadow-amber-200 dark:shadow-amber-900' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 bg-white dark:bg-gray-800'
                                }`}
                                onClick={() => toggleGameMode('nassau')}
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                                    <span className="text-amber-600 dark:text-amber-400 font-bold">✓</span>
                                  </div>
                                  <h3 className="font-semibold text-lg">Nassau</h3>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  Three matches in one: front nine, back nine, and total
                                </p>
                                {selectedGameModes.nassau && (
                                  <div className="absolute top-2 right-2">
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-amber-600 text-white rounded-full">
                                      Selected
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Points (Stableford) */}
                              <div 
                                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                                  selectedGameModes.points 
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 shadow-lg shadow-indigo-200 dark:shadow-indigo-900' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 bg-white dark:bg-gray-800'
                                }`}
                                onClick={() => toggleGameMode('points')}
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">★</span>
                                  </div>
                                  <h3 className="font-semibold text-lg">Stableford</h3>
                                </div>
                                {!selectedGameModes.points ? (
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                      Points-based Stableford scoring
                                    </p>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center">
                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant={!modifiedStableford ? "default" : "outline"}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setModifiedStableford(false);
                                        }}
                                        className={`font-bold ${!modifiedStableford ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-indigo-600 hover:bg-indigo-50"}`}
                                      >
                                        Standard
                                      </Button>
                                      <Button
                                        variant={modifiedStableford ? "default" : "outline"}
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setModifiedStableford(true);
                                        }}
                                        className={`font-bold ${modifiedStableford ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-indigo-600 hover:bg-indigo-50"}`}
                                      >
                                        Modified
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {/* Stableford rules moved to the Stableford tab below */}
                              </div>

                              {/* Wolf - Hidden for initial launch, will be added back after more iteration
                              <div 
                                  className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                                    selectedGameModes.wolf 
                                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950 shadow-lg shadow-orange-200 dark:shadow-orange-900' 
                                      : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 bg-white dark:bg-gray-800'
                                  }`}
                                  onClick={() => toggleGameMode('wolf')}
                                >
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                                      <span className="text-orange-600 dark:text-orange-400 font-bold">💰</span>
                                    </div>
                                    <h3 className="font-semibold text-lg">Wolf</h3>
                                  </div>
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    Strategic game with rotating roles and partnerships
                                  </p>
                                  {selectedGameModes.wolf && (
                                    <>
                                      <div className="absolute top-2 right-2">
                                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-600 text-white rounded-full">
                                          Selected
                                        </span>
                                      </div>
                                      <div className="mt-3">
                                        <Button size="sm" variant="outline" onClick={() => setWolfSettingsOpen(true)}>
                                          Wolf Settings
                                        </Button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              */}

                              {/* Vegas */}
                              <div 
                                className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${
                                  selectedGameModes.vegas 
                                    ? 'border-pink-500 bg-pink-50 dark:bg-pink-950 shadow-lg shadow-pink-200 dark:shadow-pink-900' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-pink-300 dark:hover:border-pink-600 bg-white dark:bg-gray-800 cursor-pointer hover:shadow-lg hover:scale-105'
                                }`}
                                onClick={() => !selectedGameModes.vegas && toggleGameMode('vegas')}
                              >
                                <div 
                                  className={`flex items-center gap-3 mb-3 ${selectedGameModes.vegas ? 'cursor-pointer' : ''}`}
                                  onClick={() => selectedGameModes.vegas && toggleGameMode('vegas')}
                                >
                                  <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900 flex items-center justify-center">
                                    <span className="text-pink-600 dark:text-pink-400 font-bold">🎲</span>
                                  </div>
                                  <h3 className="font-semibold text-lg">Vegas</h3>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  Two-person teams with combined scoring
                                </p>
                                {selectedGameModes.vegas && (
                                  <>
                                    <div className="absolute top-2 right-2">
                                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-pink-600 text-white rounded-full">
                                        Selected
                                      </span>
                                    </div>
                                    
                                    {/* Inline Team Selection */}
                                    <div className="mt-4 pt-3 border-t border-pink-200 dark:border-pink-800">
                                      <div className="text-xs font-medium text-pink-700 dark:text-pink-300 mb-2">Team Assignment</div>
                                      <div className="space-y-2">
                                        {(round.players || []).map((player) => {
                                          const isTeamA = vegasTeams.teamA.includes(player.playerId);
                                          const isTeamB = vegasTeams.teamB.includes(player.playerId);
                                          return (
                                            <div key={`vegas-inline-${player.playerId}`} className="flex items-center justify-between py-1">
                                              <div className="flex items-center space-x-2">
                                                <Avatar className="h-6 w-6">
                                                  <AvatarFallback className="text-xs">
                                                    {getPlayerInitials(player.name)}
                                                  </AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm">{player.name}</span>
                                              </div>
                                              <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                  type="button"
                                                  variant={isTeamA ? 'default' : 'outline'}
                                                  size="sm"
                                                  onClick={() => {
                                                    if (isTeamA) {
                                                      setVegasTeams(prev => ({
                                                        ...prev,
                                                        teamA: prev.teamA.filter(id => id !== player.playerId)
                                                      }));
                                                    } else {
                                                      setVegasTeams(prev => ({
                                                        teamA: [...prev.teamA.filter(id => id !== player.playerId), player.playerId],
                                                        teamB: prev.teamB.filter(id => id !== player.playerId)
                                                      }));
                                                    }
                                                  }}
                                                  className={`h-6 w-6 p-0 text-xs ${
                                                    isTeamA 
                                                      ? 'bg-pink-600 hover:bg-pink-700 text-white' 
                                                      : 'hover:bg-pink-100 hover:text-pink-600 dark:hover:bg-pink-900'
                                                  }`}
                                                >
                                                  A
                                                </Button>
                                                <Button
                                                  type="button"
                                                  variant={isTeamB ? 'default' : 'outline'}
                                                  size="sm"
                                                  onClick={() => {
                                                    if (isTeamB) {
                                                      setVegasTeams(prev => ({
                                                        ...prev,
                                                        teamB: prev.teamB.filter(id => id !== player.playerId)
                                                      }));
                                                    } else {
                                                      setVegasTeams(prev => ({
                                                        teamA: prev.teamA.filter(id => id !== player.playerId),
                                                        teamB: [...prev.teamB.filter(id => id !== player.playerId), player.playerId]
                                                      }));
                                                    }
                                                  }}
                                                  className={`h-6 w-6 p-0 text-xs ${
                                                    isTeamB 
                                                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                                      : 'hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900'
                                                  }`}
                                                >
                                                  B
                                                </Button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      
                                      {/* Team summary */}
                                      {(vegasTeams.teamA.length > 0 || vegasTeams.teamB.length > 0) && (
                                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                                          <div className="text-center p-1.5 bg-pink-100 dark:bg-pink-900 rounded">
                                            <span className="font-medium text-pink-700 dark:text-pink-300">A: </span>
                                            {vegasTeams.teamA.length > 0 
                                              ? vegasTeams.teamA.map(id => round.players?.find(p => p.playerId === id)?.name?.split(' ')[0]).join(' & ')
                                              : '—'
                                            }
                                          </div>
                                          <div className="text-center p-1.5 bg-blue-100 dark:bg-blue-900 rounded">
                                            <span className="font-medium text-blue-700 dark:text-blue-300">B: </span>
                                            {vegasTeams.teamB.length > 0 
                                              ? vegasTeams.teamB.map(id => round.players?.find(p => p.playerId === id)?.name?.split(' ')[0]).join(' & ')
                                              : '—'
                                            }
                                          </div>
                                        </div>
                                      )}
                                      
                                      {vegasTeams.teamA.length !== 2 || vegasTeams.teamB.length !== 2 ? (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 text-center mt-2">
                                          Each team needs 2 players
                                        </p>
                                      ) : (
                                        <p className="text-xs text-green-600 dark:text-green-400 text-center mt-2 flex items-center justify-center gap-1">
                                          <CheckCircle className="h-3 w-3" /> Teams ready
                                        </p>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Sixes - Hidden for initial launch, will be added back after more iteration
                              <div 
                                  className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                                    selectedGameModes.sixes 
                                      ? 'border-green-500 bg-green-50 dark:bg-green-950 shadow-lg shadow-green-200 dark:shadow-green-900' 
                                      : 'border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 bg-white dark:bg-gray-800'
                                  }`}
                                  onClick={() => toggleGameMode('sixes')}
                                >
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                      <span className="text-green-600 dark:text-green-400 font-bold">👥</span>
                                    </div>
                                    <h3 className="font-semibold text-lg">Sixes</h3>
                                  </div>
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    Rotating partnerships every 6 holes with best ball scoring
                                  </p>
                                  {selectedGameModes.sixes && (
                                    <div className="absolute top-2 right-2">
                                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-600 text-white rounded-full">
                                        Selected
                                      </span>
                                    </div>
                                  )}
                                </div>
                              */}

                              {/* Dots - Hidden for initial launch, will be added back after more iteration
                              <div 
                                  className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                                    selectedGameModes.dots 
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-lg shadow-blue-200 dark:shadow-blue-900' 
                                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800'
                                  }`}
                                  onClick={() => toggleGameMode('dots')}
                                >
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                      <span className="text-blue-600 dark:text-blue-400 font-bold">🎯</span>
                                    </div>
                                    <h3 className="font-semibold text-lg">Dots</h3>
                                  </div>
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    Par-based game with bonus points for birdies
                                  </p>
                                  {selectedGameModes.dots && (
                                    <div className="absolute top-2 right-2">
                                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-full">
                                        Selected
                                      </span>
                                    </div>
                                  )}
                                </div>
                              */}

                              {/* Rolling Strokes removed per configuration */}

                              {/* Snake */}
                              <div 
                                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 ${
                                  selectedGameModes.snake 
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 shadow-lg shadow-emerald-200 dark:shadow-emerald-900' 
                                    : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 bg-white dark:bg-gray-800'
                                }`}
                                onClick={() => toggleGameMode('snake')}
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">🐍</span>
                                  </div>
                                  <h3 className="font-semibold text-lg">Snake</h3>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  Penalty for three-putting
                                </p>
                                {selectedGameModes.snake && (
                                  <div className="absolute top-2 right-2">
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-emerald-600 text-white rounded-full">
                                      Selected
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Tournament Mode Alert */}
                        {selectedGameModes.pinseekrCup && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              ⚡ Tournament Mode Active - Other game modes are disabled during tournament play
                            </p>
                          </div>
                        )}

                      </div>

                      {/* Game Mode Description Box with Tabs */}
                      {!selectedGameModes.pinseekrCup && (
                        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                          {selectedGameModeList.length > 0 ? (
                            <Tabs value={activeGameModeTab} onValueChange={setActiveGameModeTab} className="w-full">
                              {/* Tab Headers */}
                              <TabsList className="flex w-full bg-blue-100 dark:bg-blue-900 overflow-x-auto">
                                {selectedGameModeList.map((gameMode) => (
                                  <TabsTrigger 
                                    key={gameMode.key} 
                                    value={gameMode.key}
                                    className="flex-shrink-0 text-blue-900 dark:text-blue-100 data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap"
                                  >
                                    {gameMode.name}
                                  </TabsTrigger>
                                ))}
                              </TabsList>

                              {/* Tab Content */}
                              {selectedGameModeList.map((gameMode) => (
                                <TabsContent key={gameMode.key} value={gameMode.key}>
                                  <CardHeader>
                                    <CardTitle className="flex items-center space-x-2 text-blue-900 dark:text-blue-100">
                                      <Target className="h-5 w-5 text-blue-600" />
                                      <span>{gameMode.name}</span>
                                    </CardTitle>
                                    <CardDescription className="text-blue-700 dark:text-blue-300">
                                      {gameMode.description}
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-3">
                                      <div>
                                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">How to Play:</h4>
                                        <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">
                                          {gameMode.rules}
                                        </p>
                                      </div>

                                      {gameMode.key === 'points' && (
                                        <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded">
                                          <div className="text-sm font-medium text-indigo-900 dark:text-indigo-100 mb-3">Stableford Rules</div>

                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div
                                              className={`bg-white dark:bg-gray-900 p-3 rounded border cursor-pointer transition-all ${
                                                !modifiedStableford
                                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 shadow-md'
                                                  : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                                            }`}
                                              onClick={() => setModifiedStableford(false)}
                                            >
                                              <div className={`text-sm font-semibold mb-2 ${!modifiedStableford ? 'text-indigo-600' : 'text-gray-700 dark:text-gray-400'}`}>Standard Stableford</div>
                                              <table className="w-full text-sm">
                                                <thead>
                                                  <tr className="text-left"><th>Score vs Par</th><th className="text-right">Points</th></tr>
                                                </thead>
                                                <tbody>
                                                  <tr><td>Albatross (3 under)</td><td className="text-right">5</td></tr>
                                                  <tr><td>Eagle (2 under)</td><td className="text-right">4</td></tr>
                                                  <tr><td>Birdie (1 under)</td><td className="text-right">3</td></tr>
                                                  <tr><td>Par</td><td className="text-right">2</td></tr>
                                                  <tr><td>Bogey</td><td className="text-right">1</td></tr>
                                                  <tr><td>Double bogey or worse</td><td className="text-right">0</td></tr>
                                                </tbody>
                                              </table>
                                            </div>

                                            <div
                                              className={`bg-white dark:bg-gray-900 p-3 rounded border cursor-pointer transition-all ${
                                                modifiedStableford
                                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 shadow-md'
                                                  : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                                            }`}
                                              onClick={() => setModifiedStableford(true)}
                                            >
                                              <div className={`text-sm font-semibold mb-2 ${modifiedStableford ? 'text-indigo-600' : 'text-gray-700 dark:text-gray-400'}`}>Modified Stableford</div>
                                              <table className="w-full text-sm">
                                                <thead>
                                                  <tr className="text-left"><th>Score vs Par</th><th className="text-right">Points</th></tr>
                                                </thead>
                                                <tbody>
                                                  <tr><td>Albatross (3 under)</td><td className="text-right">8</td></tr>
                                                  <tr><td>Eagle (2 under)</td><td className="text-right">5</td></tr>
                                                  <tr><td>Birdie (1 under)</td><td className="text-right">2</td></tr>
                                                  <tr><td>Par</td><td className="text-right">0</td></tr>
                                                  <tr><td>Bogey</td><td className="text-right">-1</td></tr>
                                                  <tr><td>Double bogey or worse</td><td className="text-right">-3</td></tr>
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </TabsContent>
                              ))}
                            </Tabs>
                          ) : (
                            <CardContent>
                              <div className="p-4 text-center text-sm text-muted-foreground">Select a game mode to see detailed rules</div>
                            </CardContent>
                          )}
                        </Card>
                      )}

                      {/* Selected Game Modes Summary */}
                      {!selectedGameModes.pinseekrCup && (
                        <Card>
                          <CardHeader>
                            <div className="flex items-center space-x-4">
                                  <Switch
                                    id="wagers-toggle"
                                    checked={wagersEnabled}
                                    onCheckedChange={setWagersEnabled}
                                    className="data-[state=checked]:bg-yellow-600"
                                  />
                              <div className="flex items-center space-x-2">
                                <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                <Label htmlFor="wagers-toggle" className="text-base font-semibold text-yellow-700 dark:text-yellow-300">Lightning Wagers</Label>
                              </div>
                                  {wagersEnabled && (
                                    <div className="ml-4 flex items-center gap-2">
                                      <Checkbox id="persist-wagers" checked={persistWagers} onCheckedChange={(v) => setPersistWagers(!!v)} />
                                      <div>
                                        <Label htmlFor="persist-wagers" className="text-sm font-medium">Publish wagers</Label>
                                        <div className="text-xs text-muted-foreground">Include wagers in published game event</div>
                                      </div>
                                    </div>
                                  )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {selectedGameModeList.length > 0 ? selectedGameModeList.map((gameMode) => {
                                // Determine wager structure for each game mode
                                const getWagerStructure = (mode: string) => {
                                  switch (mode) {
                                    case 'strokePlay':
                                    case 'points':
                                      return 'round';
                                    case 'matchPlay':
                                      return 'match';
                                    case 'skins':
                                    case 'dots':
                                      return 'hole';
                                    case 'snake':
                                      return snakeVariant === 'fixed' ? 'round (fixed)' : `round (progressive ${progressiveMultiplier.toFixed(1)}x)`;
                                    case 'nassau':
                                      return 'match';
                                    case 'wolf':
                                    case 'vegas':
                                      return 'round';
                                    case 'sixes':
                                      return 'match';
                                    default:
                                      return 'round';
                                  }
                                };

                                const currentWagerAmount = wagerAmounts[gameMode.key] || '111';
                                const currentCustomAmount = customWagerAmounts[gameMode.key] || '';
                                const isEditingCustom = editingCustom[gameMode.key] || false;

                                const setGameModeWagerAmount = (amount: '111' | '1111' | 'custom') => {
                                  setWagerAmounts(prev => ({ ...prev, [gameMode.key]: amount }));
                                  if (amount === 'custom') {
                                    setEditingCustom(prev => ({ ...prev, [gameMode.key]: true }));
                                  } else {
                                    setEditingCustom(prev => ({ ...prev, [gameMode.key]: false }));
                                  }
                                };

                                const setGameModeCustomAmount = (amount: string) => {
                                  setCustomWagerAmounts(prev => ({ ...prev, [gameMode.key]: amount }));
                                };

                                const finishEditingCustom = () => {
                                  setEditingCustom(prev => ({ ...prev, [gameMode.key]: false }));
                                };

                                return (
                                  <div key={gameMode.key} className="space-y-2">
                                    <div className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                      <div className="flex-1 min-w-0 mr-4">
                                        <div className="flex items-center space-x-2 mb-1">
                                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                                          <h4 className="font-medium truncate">{gameMode.name}</h4>
                                        </div>
                                        <div className="text-sm text-muted-foreground pl-4">
                                          Sats per {getWagerStructure(gameMode.key)}
                                          {gameMode.key === 'snake' && snakeVariant === 'progressive' && (
                                            <span className="text-yellow-600 dark:text-yellow-400"> (progressive {progressiveMultiplier.toFixed(1)}x)</span>
                                          )}
                                        </div>
                                        {gameMode.key === 'snake' && wagersEnabled && (
                                          <div className="flex space-x-1 mt-2 pl-4">
                                                <Button
                                                  variant={snakeVariant === 'fixed' ? 'default' : 'outline'}
                                                  size="sm"
                                                  onClick={() => setSnakeVariant('fixed')}
                                                  className="h-7 px-3 text-xs"
                                                >
                                                  Fixed
                                                </Button>
                                                <Button
                                                  variant={snakeVariant === 'progressive' ? 'default' : 'outline'}
                                                  size="sm"
                                                  onClick={() => setSnakeVariant('progressive')}
                                                  className="h-7 px-3 text-xs"
                                                >
                                                  Progressive
                                                </Button>
                                              </div>
                                        )}
                                      </div>
                                    {wagersEnabled && (
                                      <div className="flex items-center space-x-2 flex-shrink-0">
                                        <Button
                                          variant={currentWagerAmount === '111' ? 'default' : 'outline'}
                                          size="sm"
                                          onClick={() => setGameModeWagerAmount('111')}
                                          className={`h-9 px-4 text-sm ${currentWagerAmount === '111' ? 'bg-yellow-600 hover:bg-yellow-700' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-600 dark:text-yellow-300 dark:hover:bg-yellow-950'}`}
                                        >
                                          <Zap className="h-4 w-4 mr-1" />
                                          111
                                        </Button>
                                        <Button
                                          variant={currentWagerAmount === '1111' ? 'default' : 'outline'}
                                          size="sm"
                                          onClick={() => setGameModeWagerAmount('1111')}
                                          className={`h-9 px-4 text-sm ${currentWagerAmount === '1111' ? 'bg-yellow-600 hover:bg-yellow-700' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-600 dark:text-yellow-300 dark:hover:bg-yellow-950'}`}
                                        >
                                          <Zap className="h-4 w-4 mr-1" />
                                          1.1k
                                        </Button>
                                        {currentWagerAmount === 'custom' && isEditingCustom ? (
                                          <Input
                                            type="number"
                                            placeholder="Enter sats"
                                            value={currentCustomAmount}
                                            onChange={(e) => setGameModeCustomAmount(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                              }
                                            }}
                                            onBlur={() => {
                                              finishEditingCustom();
                                              // If no custom amount is entered, revert to default
                                              if (!currentCustomAmount.trim()) {
                                                setGameModeWagerAmount('111');
                                              }
                                            }}
                                            className="h-9 w-24 px-3 text-sm border-yellow-300 focus:border-yellow-500 dark:border-yellow-600 dark:focus:border-yellow-400"
                                            autoFocus
                                          />
                                        ) : (
                                          <Button
                                            variant={currentWagerAmount === 'custom' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => {
                                              if (currentWagerAmount === 'custom' && currentCustomAmount) {
                                                // If clicking on an existing custom button, clear it to allow re-editing
                                                setGameModeCustomAmount('');
                                                setGameModeWagerAmount('custom');
                                              } else {
                                                setGameModeWagerAmount('custom');
                                              }
                                            }}
                                            className={`h-9 px-4 text-sm ${currentWagerAmount === 'custom' ? 'bg-yellow-600 hover:bg-yellow-700' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-600 dark:text-yellow-300 dark:hover:bg-yellow-950'}`}
                                          >
                                            {currentWagerAmount === 'custom' && currentCustomAmount && !isEditingCustom ? (
                                              <>
                                                <Zap className="h-4 w-4 mr-1" />
                                                {currentCustomAmount}
                                              </>
                                            ) : (
                                              'Custom'
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                    </div>

                                    {/* Estimated total for per-hole wagers (e.g., Skins) */}
                                    {wagersEnabled && getWagerStructure(gameMode.key) === 'hole' && (
                                      (() => {
                                        const holesCount = selectedCourse?.holes ? Math.max(...Object.keys(selectedCourse.holes).map(Number)) : 18;
                                        const base = currentWagerAmount === 'custom' ? (parseInt(currentCustomAmount) || 0) : (currentWagerAmount === '111' ? 111 : currentWagerAmount === '1111' ? 1111 : 0);
                                        const totalEst = base * holesCount;
                                        return (
                                          <div className="text-sm text-muted-foreground mt-2 pl-4">
                                            Estimated total: <span className="font-medium">{totalEst.toLocaleString()} sats</span> ({base.toLocaleString()} × {holesCount} holes)
                                          </div>
                                        );
                                      })()
                                    )}
                                    
                                    {/* Snake Variant Selection */}
                                    {gameMode.key === 'snake' && wagersEnabled && snakeVariant === 'progressive' && (
                                      <div className="pl-6 pr-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg space-y-3">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm text-muted-foreground">Multiplier:</span>
                                          <span className="text-sm font-medium">{progressiveMultiplier.toFixed(1)}x</span>
                                        </div>
                                        
                                        <div className="space-y-2">
                                          <input
                                            type="range"
                                            min="1.0"
                                            max="2.0"
                                            step="0.1"
                                            value={progressiveMultiplier}
                                            onChange={(e) => setProgressiveMultiplier(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                            style={{
                                              background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${((progressiveMultiplier - 1.0) / 1.0) * 100}%, #e5e7eb ${((progressiveMultiplier - 1.0) / 1.0) * 100}%, #e5e7eb 100%)`
                                            }}
                                          />
                                          
                                          <div className="text-xs text-muted-foreground">
                                            <div className="font-medium mb-1">Progression example (base {currentWagerAmount === 'custom' ? (currentCustomAmount || '0') : (currentWagerAmount === '111' ? '111' : '1111')} sats):</div>
                                            <div className="space-y-1">
                                              {/* Top row - putt numbers */}
                                              <div className="grid grid-cols-10 gap-1 text-xs">
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pass => (
                                                  <div key={pass} className="text-center text-orange-600 dark:text-orange-400 font-mono">
                                                    {pass}
                                                  </div>
                                                ))}
                                              </div>
                                              
                                              {/* Bottom row - sats amounts */}
                                              <div className="grid grid-cols-10 gap-1 text-xs">
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(pass => {
                                                  const baseSats = currentWagerAmount === 'custom' ? 
                                                    parseInt(currentCustomAmount || '0') : 
                                                    (currentWagerAmount === '111' ? 111 : 1111);
                                                  const amount = Math.round(baseSats * Math.pow(progressiveMultiplier, pass));
                                                  return (
                                                    <div key={pass} className="text-center">
                                                      <div className="flex items-center justify-center gap-1">
                                                        <span className="font-bold text-yellow-500">⚡</span>
                                                        <span>{amount}</span>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              }) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  Select a game mode to enable wagers
                                </div>
                              )}
                              
                              {wagersEnabled && (
                                <>
                                  {/* Wager Total */}
                                  <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                        Total Pot
                                      </span>
                                      <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                                        {(() => {
                                          const total = selectedGameModeList.reduce((sum, gameMode) => {
                                            const currentAmount = wagerAmounts[gameMode.key] || '111';
                                            const customAmount = customWagerAmounts[gameMode.key] || '';
                                            
                                            let wagerValue = 0;
                                            if (currentAmount === 'custom') {
                                              wagerValue = parseInt(customAmount) || 0;
                                            } else {
                                              wagerValue = parseInt(currentAmount);
                                            }
                                            
                                            // Multiply by number of matches for games with multiple components
                                            if (gameMode.key === 'nassau') {
                                              wagerValue *= 3; // Front 9, Back 9, Total 18
                                            }
                                            
                                            return sum + wagerValue;
                                          }, 0);
                                          
                                          return `${total.toLocaleString()} sats`;
                                        })()}
                                      </span>
                                    </div>
                                    {/* Note for games with multiple matches */}
                                    {selectedGameModeList.some(mode => mode.key === 'nassau') && (
                                      <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                                        <span className="font-medium">Note:</span> Nassau includes 3 separate matches (front 9, back 9, total 18). The total pot shown includes all matches combined.
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Lightning Network Settlement Info */}
                                  <div className="mt-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-3">
                                    <p className="text-xs text-yellow-800 dark:text-yellow-200 flex items-center">
                                      <Zap className="h-3 w-3 mr-1 text-yellow-600" />
                                      Wagers will be settled automatically via Lightning Network. LN Invoices are created after the round.
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    
                    {/* Course Information Section */}
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Where?
                          </h3>
                          <p className="text-sm text-muted-foreground">Select your golf course and add round details</p>
                        </div>
                      
                      <div>
                        <Label className="text-base font-medium">Select Course *</Label>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          Search for a golf course or add course details manually
                        </p>
                      </div>

                      <CourseSelection
                        selectedCourse={selectedCourse || undefined}
                        onSelectCourse={handleCourseSelect}
                        className="mb-6"
                        allowAddCourse={false}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="teeBox">Tee Box</Label>
                          {selectedCourse?.tees && selectedCourse.tees.length > 0 ? (
                            <Select
                              onValueChange={(value) => {
                                // value is encoded as "name||yardage"
                                const [name, yardageStr] = value.split('||');
                                const yardage = parseInt(yardageStr) || 0;
                                setRound(prev => ({
                                  ...prev!,
                                  metadata: { ...prev!.metadata!, teeBox: name, teeYardage: yardage }
                                }));
                              }}
                              value={round.metadata?.teeBox}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select tee box" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedCourse.tees.map((teeName) => {
                                  const totalYards = selectedCourse.teeYardages?.[teeName]
                                    ? Object.values(selectedCourse.teeYardages[teeName]).reduce((sum, y) => sum + (y || 0), 0)
                                    : 0;
                                  return (
                                    <SelectItem key={teeName} value={`${teeName}||${totalYards}`}>
                                      {teeName}{totalYards > 0 ? ` • ${totalYards.toLocaleString()} yd` : ''}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          ) : (
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
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="mb-1">Holes</Label>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const leftCount = holeButtonMode === 'standard' ? 9 : 27;
                              const rightCount = holeButtonMode === 'standard' ? 18 : 36;
                              return (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={holeCountChoice === leftCount ? 'default' : 'outline'}
                                    onClick={() => setHoleCountChoice(leftCount)}
                                    className="w-[44%] px-3"
                                  >
                                    {leftCount}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={holeCountChoice === rightCount ? 'default' : 'outline'}
                                    onClick={() => setHoleCountChoice(rightCount)}
                                    className="w-[44%] px-3"
                                  >
                                    {rightCount}
                                  </Button>
                                </>
                              );
                            })()}

                            <Button
                              type="button"
                              size="sm"
                              variant={holeCountChoice > 18 ? 'default' : 'outline'}
                              onClick={() => setShowHolePicker(true)}
                              className="w-[22%] px-2"
                              title="Choose custom hole counts (27, 36, or custom)"
                            >
                              +
                            </Button>
                          </div>

                          {/* When user chooses 9-hole, show the named 9-hole groups (Front 9, Back 9, custom sections) */}
                          {holeCountChoice === 9 && (
                            <div>
                              <Label htmlFor="section">9-Hole Name</Label>
                              {selectedCourse?.sections && Object.keys(selectedCourse.sections).length > 0 ? (
                                <>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  {Object.entries(selectedCourse.sections).map(([index, sectionName]) => (
                                    <Button
                                      key={index}
                                      type="button"
                                      variant={String(round.metadata?.selectedSection) === index ? "default" : "outline"}
                                      onClick={() => setRound(prev => ({
                                        ...prev!,
                                        metadata: { ...prev!.metadata!, selectedSection: index }
                                      }))}
                                      className={`text-center ${
                                        String(round.metadata?.selectedSection) === index
                                          ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                                          : "hover:bg-accent hover:text-accent-foreground"
                                      }`}
                                    >
                                      {sectionName}
                                    </Button>
                                  ))}
                                </div>
                                  {typeof round.metadata?.selectedSection !== 'undefined' && selectedCourse?.sections && (
                                    (() => {
                                      const sectionIndex = parseInt(String(round.metadata?.selectedSection), 10) || 0;
                                      const totalCourseHoles = selectedCourse.holes ? Math.max(...Object.keys(selectedCourse.holes).map(Number)) : 18;
                                      const sectionStart = sectionIndex * 9 + 1;
                                      const sectionEnd = Math.min(sectionStart + 8, totalCourseHoles);
                                      return (
                                        <p className="text-sm text-muted-foreground mt-2">Holes {sectionStart}–{sectionEnd}</p>
                                      );
                                    })()
                                  )}
                                </>
                              ) : (
                                <div className="p-3 text-center text-muted-foreground bg-muted rounded-md mt-2">
                                  {selectedCourse ? 'This course has no named 9-hole groups' : 'Select a course to see 9-hole groups'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
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
                        disabled={!selectedCourse || !round.players || round.players.length === 0}
                        size="lg"
                        className="px-12 py-4 text-xl"
                      >
                        🏌️ Start Round
                      </Button>
                    </div>
                    {(!selectedCourse || !round.players || round.players.length === 0) && (
                      <p className="text-center text-sm text-muted-foreground mt-2">
                        Select a course and add at least one player to start the round
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

        {/* Hole Picker Dialog for + button */}
        <Dialog open={showHolePicker} onOpenChange={setShowHolePicker}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Choose Holes</DialogTitle>
              <DialogDescription>Select a preset or enter a custom hole count</DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setHoleCountChoice(27);
                    setHoleButtonMode('extended');
                    setShowHolePicker(false);
                  }}
                  className="w-1/2"
                >
                  27 Holes
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setHoleCountChoice(36);
                    setHoleButtonMode('extended');
                    setShowHolePicker(false);
                  }}
                  className="w-1/2"
                >
                  36 Holes
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Custom</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Enter number of holes"
                    value={customHoleInput}
                    onChange={(e) => setCustomHoleInput(e.target.value)}
                  />
                  <Button
                    onClick={() => {
                      const n = parseInt(customHoleInput || '', 10);
                      if (!isNaN(n) && n > 0) {
                        setHoleCountChoice(n);
                        if (n > 18) setHoleButtonMode('extended');
                        setShowHolePicker(false);
                        setCustomHoleInput('');
                      } else {
                        toast({ title: 'Invalid number', description: 'Please enter a valid positive integer', variant: 'destructive' });
                      }
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>

              <div className="flex justify-between mt-2">
                <Button variant="ghost" onClick={() => {
                  setHoleButtonMode('standard');
                  setShowHolePicker(false);
                }}>Reset to 9/18</Button>
                <Button variant="outline" onClick={() => setShowHolePicker(false)}>Close</Button>
              </div>
            </div>

          </DialogContent>
        </Dialog>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8">
        <MobileContainer>
          <div>
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {round.metadata?.courseName || selectedCourse?.name || 'Golf Course'} - {selectedMode?.replace('-', ' ').toUpperCase() || 'STROKE PLAY'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {round.players?.length || 0} players • {new Date(round.date || Date.now()).toLocaleDateString()}
              </p>
            </div>

            <div className="mt-8">
              <ScoreCard
                round={round as GolfRound}
                course={selectedCourse}
                onUpdateRound={setRound}
                onSaveRound={saveRound}
                onShareRound={() => {
                  toast({
                    title: "Round Shared",
                    description: "Your round has been shared with your Nostr network.",
                  });
                }}
              />

              {/* Settlement Actions */}
              {(wagersEnabled || (selectedGameModes.pinseekrCup && pinseekrWagersEnabled)) && (
                <div className="mt-4 flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={generateAndPublishSettlement}
                  >
                    Generate Settlement Invoices (NWC)
                  </Button>
                </div>
              )}
            </div>
          </div>
          </div>
        </MobileContainer>
      </div>

      {/* Add Player Dialog */}
      <AddPlayerDialog
        open={showAddPlayerDialog}
        onOpenChange={setShowAddPlayerDialog}
        onAddPlayer={handleAddPlayer}
        existingPlayers={round.players || []}
      />

      {/* Settlement Preview Dialog */}
      {/* Wolf Settings Dialog */}
      <Dialog open={wolfSettingsOpen} onOpenChange={setWolfSettingsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Wolf Settings</DialogTitle>
            <DialogDescription>
              Assign default partners for Wolf mode. Players can still pick partners per-hole when playing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {round.players && round.players.length > 0 ? (
              round.players.map((p) => (
                <div key={`wolf-${p.playerId}`} className="flex items-center justify-between">
                  <div className="text-sm">{p.name}</div>
                  <select
                    value={wolfPartners[p.playerId] || ''}
                    onChange={(e) => setWolfPartners(prev => ({ ...prev, [p.playerId]: e.target.value || null }))}
                    className="border px-2 py-1 rounded"
                  >
                    <option value="">No default partner</option>
                    {(round.players || []).filter(x => x.playerId !== p.playerId).map(o => (
                      <option key={o.playerId} value={o.playerId}>{o.name}</option>
                    ))}
                  </select>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Add players to assign partners.</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setWolfSettingsOpen(false)}>Close</Button>
            <Button onClick={() => setWolfSettingsOpen(false)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

<Dialog open={showSettlementPreview} onOpenChange={setShowSettlementPreview}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Settlement Preview</DialogTitle>
            <DialogDescription>
              Review the net payments below. Confirm to create invoices (for recipients who are you) and publish the settlement to Nostr.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3 max-h-72 overflow-auto">
            {settlementPreview.length === 0 ? (
              <div className="text-sm text-muted-foreground">No payments to settle.</div>
            ) : (
              settlementPreview.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded border">
                  <div>
                    <div className="text-sm font-medium">{(p.payers || []).join(', ')} → {p.recipient}</div>
                    <div className="text-xs text-muted-foreground">{p.memo || 'Net settlement'}</div>
                  </div>
                  <div className="text-sm font-mono font-bold">{p.amount.toLocaleString()} sats</div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSettlementPreview(false)}>Cancel</Button>
            <Button onClick={confirmSettlementAndCreateInvoices} disabled={isCreatingInvoices}>
              {isCreatingInvoices ? 'Generating...' : 'Create Invoices & Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default NewRoundPage;
