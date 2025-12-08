# Golf Betting Games Framework

This document outlines a comprehensive framework for implementing additional golf betting games based on industry-standard formats. Use this as a reference for expanding the game library.

## Game Categories

### 1. Match Play Games
Games where players compete hole-by-hole rather than total strokes.

### 2. Stroke Play Games
Traditional scoring based on total strokes taken.

### 3. Points-Based Games
Games that award points for achievements or scores.

### 4. Dots Games
Games that award "dots" or tokens for specific accomplishments.

### 5. Side Bet Games
Additional competitions that run alongside the main game.

---

## Comprehensive Game List

### Currently Implemented Games
✅ **Stroke Play** (Medal Play) - Traditional stroke counting
✅ **Match Play** - Hole-by-hole competition
✅ **Stableford** - Points based on score vs par
✅ **Nassau** - Three matches (front 9, back 9, total)
✅ **Skins** - Lowest score wins the hole
✅ **Dots** - Points for achievements (fairways, greens, birdies)
✅ **Snake** - Penalty for three-putting
✅ **Wolf** - Rotating partnerships
✅ **Vegas** - Team scoring with concatenated scores
✅ **Sixes** - Rotating partnerships every 6 holes

---

## Games to Implement

### High Priority (Common/Popular Games)

#### 1. **Bingo Bango Bongo**
- **Players**: 2-6
- **Type**: Dots
- **Variants**: None commonly used
- **Rules**: 
  - Three points available per hole
  - First player on green = 1 point (Bingo)
  - Closest to pin once all on green = 1 point (Bango)
  - First player to hole out = 1 point (Bongo)
  - Player with most points wins
- **Key Features**: 
  - Great for mixed skill levels
  - Order matters - farthest from hole plays first
  - No handicap adjustments typically

#### 2. **Scotch** (Foursomes/Alternate Shot)
- **Players**: 4 (two teams of 2)
- **Type**: Points/Strokes
- **Variants**: 
  - 5-Point Scotch
  - 6-Point Scotch
  - Umbriago
- **Rules**:
  - Partners alternate shots with same ball
  - Alternate who tees off on odd/even holes
  - Can be match play or stroke play
- **5-Point Scotch Scoring**:
  - Birdie or better on par 3 = 5 points
  - Birdie or better on par 4 = 4 points
  - Par on par 5 = 5 points
  - Birdie on par 5 = 10 points
  - Eagle on par 5 = 15 points

#### 3. **Best Ball** (Better Ball)
- **Players**: 4 (two teams of 2)
- **Type**: Match/Strokes
- **Variants**: 
  - Chapman (alternate shot after drives)
  - Shamble (all drive, best ball from there)
- **Rules**:
  - Each player plays own ball
  - Best score on team counts for hole
  - Can be match play or stroke play
- **Chapman Variant**:
  - Both players drive
  - Select best drive
  - Alternate shots from there
  - Best score counts

#### 4. **Rabbit** (Capturing the Rabbit)
- **Players**: 2-6
- **Type**: Side bet
- **Variants**: None
- **Rules**:
  - One player "holds" the rabbit to start
  - Player with lowest score on hole "captures" rabbit
  - If tied, previous holder keeps rabbit
  - Player holding rabbit at end wins
  - Can have multiple rabbits (front 9, back 9)

#### 5. **Nines** (Baseball, 5-3-1)
- **Players**: 3
- **Type**: Points
- **Variants**: 
  - Baseball
  - 5-3-1
- **Rules**:
  - 9 points available per hole
  - Low score = 5 points
  - Middle score = 3 points
  - High score = 1 point
  - If tied, points split equally
  - Most points after 18 wins

#### 6. **Banker**
- **Players**: 2-6
- **Type**: Points
- **Variants**: None
- **Rules**:
  - One player is designated "Banker"
  - Banker plays against everyone else
  - Banker pays/receives from each player individually
  - Banker rotates (usually every 6 holes)
  - Points awarded for winning holes

#### 7. **Aces and Deuces** (Acey Deucey)
- **Players**: 2-6
- **Type**: Points
- **Variants**: Acey Deucey
- **Rules**:
  - Points awarded for specific scores:
    - Eagle (Ace) = +2 points
    - Birdie = +1 point
    - Par = 0 points
    - Bogey = -1 point
    - Double bogey or worse (Deuce) = -2 points
  - Highest point total wins

#### 8. **Trouble** (Disaster)
- **Players**: 2-6
- **Type**: Dots (negative points)
- **Variants**: Disaster
- **Rules**:
  - Penalty points for trouble:
    - Hit water = -1 point
    - Hit sand = -1 point
    - Out of bounds = -2 points
    - Lost ball = -2 points
    - 3-putt = -1 point
  - Lowest negative score wins (or closest to zero)

#### 9. **Arnies** (Seves)
- **Players**: 2-6
- **Type**: Side bet
- **Variants**: Seves
- **Rules**:
  - Point awarded for making par or better without hitting fairway
  - Named after Arnold Palmer's scrambling ability
  - Seves variant: making par from bunker/sand
  - Can combine both for more points

#### 10. **Closest to the Pin**
- **Players**: 2-6
- **Type**: Side bet
- **Variants**: None
- **Rules**:
  - Designated par 3 holes (or all par 3s)
  - Player closest to pin in regulation wins
  - Ball must be on green to qualify
  - Can have separate bets for each par 3

---

### Medium Priority (Less Common but Interesting)

#### 11. **Quota**
- **Players**: 2-120
- **Type**: Points
- **Variants**: None
- **Rules**:
  - Each player has target quota based on handicap
  - Quota = 36 - (handicap * 0.8)
  - Points for scores:
    - Double eagle = 8 points
    - Eagle = 4 points
    - Birdie = 2 points
    - Par = 0 points
    - Bogey = -1 point
    - Double bogey or worse = -3 points
  - Try to beat your quota

#### 12. **Three Ball**
- **Players**: 3
- **Type**: Match
- **Variants**: None
- **Rules**:
  - Each player competes against the other two
  - Three separate matches simultaneously
  - Each match scored independently
  - Player winning most matches wins overall

#### 13. **Four Ball**
- **Players**: 4 (two teams of 2)
- **Type**: Match
- **Variants**: None
- **Rules**:
  - Each player plays own ball
  - Best score on team counts
  - Match play format
  - Standard match play scoring (1 up, all square, etc.)

#### 14. **Skins Group**
- **Players**: 2-60
- **Type**: Points
- **Variants**: None
- **Rules**:
  - Larger group skins game
  - Lowest score wins skin for that hole
  - Ties carry over to next hole
  - Can use handicaps for net scoring
  - Great for tournaments

#### 15. **Stableford Group**
- **Players**: 2-60
- **Type**: Points
- **Variants**: None
- **Rules**:
  - Standard Stableford scoring
  - Designed for tournament/group play
  - Can use modified scoring tables
  - Works well with handicaps

#### 16. **Medal Play Group**
- **Players**: 2-60
- **Type**: Strokes
- **Variants**: None
- **Rules**:
  - Traditional stroke play
  - Designed for larger groups/tournaments
  - Lowest total score wins
  - Can use gross or net scoring

---

## Implementation Framework

### Data Structure for Each Game

```typescript
interface GolfGame {
  id: string;
  name: string;
  variants: string[];
  playerCount: {
    min: number;
    max: number;
    optimal?: number;
  };
  category: 'match' | 'stroke' | 'points' | 'dots' | 'sidebet';
  description: string;
  shortDescription: string;
  rules: {
    setup: string;
    scoring: string;
    winning: string;
    specialRules?: string[];
  };
  scoringDetails: {
    type: 'individual' | 'team';
    handicapAdjustment: boolean;
    carries: boolean; // if points/skins carry over
    perHole?: boolean; // scored per hole or cumulative
  };
  complexity: 'beginner' | 'intermediate' | 'advanced';
  popularity: number; // 1-5 rating
  pairings?: 'fixed' | 'rotating' | 'individual';
  icon?: string;
}
```

### UI Components Needed

1. **Game Selection Card** - Display game with key info
2. **Game Rules Dialog** - Detailed rules and variants
3. **Game Setup Wizard** - Configure players, teams, settings
4. **Scoring Interface** - Game-specific scoring UI
5. **Leaderboard Component** - Real-time standings
6. **History/Stats View** - Past games and statistics

### Scoring Engine Architecture

```typescript
interface ScoringEngine {
  gameId: string;
  calculateHole: (holeData: HoleData) => HoleResult;
  calculateTotal: (allHoles: HoleData[]) => GameResult;
  validateScore: (score: Score) => boolean;
  getLeaderboard: () => Leaderboard;
  handleCarryover?: () => void; // for skins/carries
  handlePairings?: () => void; // for rotating games
}
```

### Priority Implementation Order

**Phase 1 - Core Popular Games** (High engagement)
1. Bingo Bango Bongo
2. Scotch (5-point)
3. Best Ball
4. Nines

**Phase 2 - Side Bets** (Easy to implement)
1. Rabbit
2. Arnies/Seves
3. Closest to Pin
4. Trouble/Disaster

**Phase 3 - Point Systems** (Medium complexity)
1. Aces and Deuces
2. Banker
3. Quota

**Phase 4 - Tournament Formats** (Lower priority)
1. Skins Group
2. Stableford Group
3. Medal Play Group
4. Three Ball
5. Four Ball

---

## Key Implementation Considerations

### 1. Handicap Integration
- Many games support both gross and net scoring
- Need flexible handicap calculation system
- Some games allocate strokes per hole differently

### 2. Team Management
- Fixed teams vs rotating partnerships
- Automatic team balancing options
- Team selection UI

### 3. Scoring Validation
- Prevent impossible scores
- Validate game-specific rules
- Handle edge cases (ties, carries, etc.)

### 4. Mobile-First Design
- Quick score entry during play
- Minimal taps for common actions
- Offline support for course play

### 5. Social Features
- Share results to Nostr
- Challenge friends to specific games
- Historical statistics per game type

### 6. Wagering/Stakes
- Lightning integration for real-money games
- Track betting history
- Automatic settlement calculations

---

## Testing Strategy

For each new game:
1. Unit tests for scoring engine
2. Integration tests for multi-round scenarios
3. Edge case testing (ties, carries, penalties)
4. User acceptance testing with real golfers
5. Performance testing with max player counts

---

## Documentation Requirements

For each game implementation:
- [ ] Rules explanation (written for beginners)
- [ ] Scoring examples with sample rounds
- [ ] Strategy tips
- [ ] Common variants
- [ ] Historical context/naming origin
- [ ] Best player count recommendation
- [ ] Suggested bet amounts/stakes

---

## Future Enhancements

1. **Custom Game Builder** - Let users create hybrid games
2. **Game Recommendations** - Suggest games based on group size/skill
3. **Video Tutorials** - Visual explanations of complex games
4. **Game Statistics** - Track which games are most popular
5. **Seasonal Challenges** - Featured game of the week/month
6. **AI Opponents** - Practice games with computer players

---

## Notes

- This framework prioritizes games that are commonly played and have clear rules
- Some games have regional variations - document most common version first
- Consider adding "quick start" guides for complex games
- Mobile scorecard entry is critical - optimize for one-handed use
- Lightning payments integration should be seamless for wagering games

