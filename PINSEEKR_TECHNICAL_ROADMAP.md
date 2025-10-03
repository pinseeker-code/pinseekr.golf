# Pinseekr.golf Technical Roadmap

## Overview

Pinseekr.golf is a comprehensive golf scoring application with Lightning Network integration and Nostr social features. This roadmap outlines the technical architecture, implementation phases, and best practices for building this decentralized golf platform.

## 1. Architecture Overview

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   Scoring UI   │  │  Lightning UI  │  │   Nostr UI      │      │
│  │                 │  │                 │  │                 │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                          Core Services                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │  Scoring Engine │  │ Lightning SDK  │  │   Nostr SDK     │      │
│  │                 │  │                 │  │                 │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
├─────────────────────────────────────────────────────────────────────┤
│                          Data Layer                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   Local Cache   │  │   IndexedDB    │  │   Nostr Events  │      │
│  │                 │  │                 │  │                 │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

- **Frontend**: React 18.x, TypeScript, TailwindCSS 3.x
- **Build Tool**: Vite
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui with Radix UI
- **Nostr Integration**: @nostrify/nostrify, nostr-tools
- **Lightning Network**: @getalby/sdk, webln
- **Routing**: React Router DOM
- **Form Handling**: React Hook Form with Zod validation
- **Testing**: Vitest, React Testing Library

## 2. Core Feature Implementation

### 2.1 Golf Scoring System

#### 2.1.1 Event Schema Design

We'll create custom Nostr event kinds for golf scoring:

```typescript
// Golf Scoring Event Kind: 30000-39999 (Addressable)
export const GOLF_EVENT_KINDS = {
  ROUND: 30001,        // Golf round metadata
  HOLE: 30002,        // Individual hole scores
  PLAYER: 30003,      // Player profile in round
  GAME: 30004,        // Game mode configuration
  RESULT: 30005,      // Final round results
} as const;
```

#### 2.1.2 Event Structure Examples

**Round Event (Kind 30001):**
```json
{
  "kind": 30001,
  "pubkey": "player_pubkey",
  "created_at": 1640995200,
  "tags": [
    ["d", "round-123"],
    ["t", "golf"],
    ["t", "stroke-play"],
    ["title", "Sunday Round at Pine Valley"],
    ["course", "Pine Valley Golf Club"],
    ["date", "2023-01-01"],
    ["players", "player1_pubkey,player2_pubkey,player3_pubkey,player4_pubkey"]
  ],
  "content": "",
  "sig": "signature"
}
```

**Hole Score Event (Kind 30002):**
```json
{
  "kind": 30002,
  "pubkey": "player_pubkey",
  "created_at": 1640995260,
  "tags": [
    ["d", "round-123-hole-5"],
    ["t", "golf"],
    ["t", "hole-score"],
    ["round", "round-123"],
    ["hole", "5"],
    ["par", "4"],
    ["strokes", "5"],
    ["player", "player_pubkey"]
  ],
  "content": "Approach shot landed short of green, chipped to 3 feet and made putt",
  "sig": "signature"
}
```

#### 2.1.3 Game Modes Implementation

```typescript
export enum GameMode {
  STROKE_PLAY = 'stroke-play',
  SKINS = 'skins',
  NASSAU = 'nassau',
  MATCH_PLAY = 'match-play',
  WOLF = 'wolf',
  POINTS = 'points',
  VEGAS = 'vegas',
  SIXES = 'sixes',
  DOTS = 'dots',
  ROLLING_STROKES = 'rolling-strokes',
  SNAKE = 'snake'
}

export interface GameConfig {
  mode: GameMode;
  players: Player[];
  handicaps: Record<string, number>;
  settings: GameSettings;
}
```

#### 2.1.4 Scoring Engine

```typescript
class ScoringEngine {
  calculateHandicap(playerStrokes: number, courseRating: number, slope: number): number {
    // USGA handicap calculation
    return (playerStrokes - courseRating) * 113 / slope;
  }

  calculateNetScore(grossScore: number, handicap: number): number {
    return Math.max(0, grossScore - handicap);
  }

  determineWinner(scores: PlayerScore[]): PlayerScore[] {
    // Logic for different game modes
    switch (this.gameMode) {
      case GameMode.STROKE_PLAY:
        return scores.sort((a, b) => a.netScore - b.netScore);
      case GameMode.MATCH_PLAY:
        return this.calculateMatchPlayResults(scores);
      // ... other game modes
    }
  }
}
```

### 2.2 Lightning Network Integration

#### 2.2.1 Payment Flow Architecture

```typescript
interface PaymentRequest {
  amount: number; // in satoshis
  description: string;
  metadata: PaymentMetadata;
  expiresAt: number;
}

interface PaymentMetadata {
  roundId: string;
  playerId: string;
  purpose: 'green-fee' | 'cart-rental' | 'wager' | 'split';
  gameId?: string;
}

class LightningService {
  private alby: AlbySdk;

  async createPaymentRequest(metadata: PaymentMetadata): Promise<string> {
    const invoice = await this.alby.createInvoice({
      amount: metadata.amount,
      description: this.generateDescription(metadata),
      metadata: metadata,
      expiresAt: Date.now() + 3600000 // 1 hour
    });
    return invoice.paymentRequest;
  }

  async processPayment(paymentHash: string): Promise<boolean> {
    const payment = await this.alby.getPayment(paymentHash);
    return payment.status === 'paid';
  }

  splitCosts(totalAmount: number, players: string[]): Promise<PaymentRequest[]> {
    const amountPerPlayer = Math.floor(totalAmount / players.length);
    return players.map(player => ({
      amount: amountPerPlayer,
      description: `Split payment for round`,
      metadata: { roundId: this.currentRoundId, playerId: player, purpose: 'split' },
      expiresAt: Date.now() + 3600000
    }));
  }
}
```

#### 2.2.2 Wager System

```typescript
interface Wager {
  id: string;
  gameId: string;
  players: string[];
  amount: number;
  currency: 'satoshis';
  conditions: WagerConditions;
  status: 'pending' | 'active' | 'settled' | 'cancelled';
  createdAt: number;
  settledAt?: number;
  winner?: string;
}

interface WagerConditions {
  gameMode: GameMode;
  scoringType: 'gross' | 'net';
  target?: number; // for target-based wagers
  conditions: string[]; // custom conditions
}

class WagerService {
  createWager(gameId: string, players: string[], amount: number, conditions: WagerConditions): Wager {
    return {
      id: generateId(),
      gameId,
      players,
      amount,
      currency: 'satoshis',
      conditions,
      status: 'pending',
      createdAt: Date.now()
    };
  }

  settleWager(wagerId: string, winner: string): void {
    // Update wager status and distribute winnings
  }
}
```

### 2.3 Badge System

#### 2.3.1 Badge Event Schema

We'll use NIP-58 Badge events with custom extensions:

```json
{
  "kind": 8, // Badge Award
  "pubkey": "issuer_pubkey",
  "created_at": 1640995200,
  "tags": [
    ["a", "30009:golf:hole-in-one:1"],
    ["d", "hole-in-one-1"],
    ["t", "golf"],
    ["t", "achievement"],
    ["name", "Hole in One"],
    ["description", "Score a hole in one"],
    ["image", "https://example.com/badges/hole-in-one.png"],
    ["thumb", "https://example.com/badges/hole-in-one-thumb.png"],
    ["amount", "1000"],
    ["currency", "satoshis"]
  ],
  "content": "Congratulations on your amazing hole in one!",
  "sig": "signature"
}
```

#### 2.3.2 Badge Categories

```typescript
export enum BadgeCategory {
  SCORING = 'scoring',
  PARTICIPATION = 'participation',
  SOCIAL = 'social',
  MILESTONES = 'milestones'
}

export interface BadgeDefinition {
  id: string;
  category: BadgeCategory;
  name: string;
  description: string;
  icon: string;
  criteria: BadgeCriteria;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface BadgeCriteria {
  type: 'hole-score' | 'round-score' | 'streak' | 'participation';
  conditions: Record<string, any>;
}
```

#### 2.3.3 Badge Achievement Logic

```typescript
class BadgeService {
  private badgeDefinitions: Map<string, BadgeDefinition> = new Map();

  checkAchievements(round: GolfRound, player: Player): BadgeAward[] {
    const awards: BadgeAward[] = [];
    
    // Check hole-in-one
    if (this.checkHoleInOne(round, player)) {
      awards.push(this.createBadgeAward('hole-in-one', player));
    }
    
    // Check breaking 90
    if (this.checkBreaking90(round, player)) {
      awards.push(this.createBadgeAward('breaking-90', player));
    }
    
    // Check eagle or better
    if (this.checkEagleOrBetter(round, player)) {
      awards.push(this.createBadgeAward('eagle-or-better', player));
    }
    
    return awards;
  }

  private checkHoleInOne(round: GolfRound, player: Player): boolean {
    return round.holes.some(hole => 
      hole.playerId === player.id && hole.strokes === 1
    );
  }
}
```

### 2.4 Nostr Social Integration

#### 2.4.1 Post Templates

```typescript
interface PostTemplate {
  id: string;
  name: string;
  category: 'score' | 'achievement' | 'wager' | 'social';
  template: string;
  variables: string[];
}

const POST_TEMPLATES: PostTemplate[] = [
  {
    id: 'score-template',
    name: 'Round Score',
    category: 'score',
    template: 'Just completed a round at {course}! Score: {score} ({handicap} handicap). Playing {gameMode} with {players}.',
    variables: ['course', 'score', 'handicap', 'gameMode', 'players']
  },
  {
    id: 'achievement-template',
    name: 'Achievement Unlocked',
    category: 'achievement',
    template: '🏆 Achievement unlocked: {badgeName}! {description}',
    variables: ['badgeName', 'description']
  }
];
```

#### 2.4.2 Social Features

```typescript
class SocialService {
  async shareAchievement(badge: BadgeAward, template: PostTemplate): Promise<void> {
    const content = this.renderTemplate(template, {
      badgeName: badge.name,
      description: badge.description
    });
    
    await this.nostrPublish({
      kind: 1,
      content,
      tags: [
        ['t', 'golf'],
        ['t', 'achievement'],
        ['badge', badge.id]
      ]
    });
  }

  async createComment(rootEvent: NostrEvent, content: string): Promise<void> {
    await this.nostrPublish({
      kind: 1111,
      content,
      tags: [
        ['e', rootEvent.id],
        ['p', rootEvent.pubkey],
        ['a', `30001:${rootEvent.tags.find(t => t[0] === 'd')?.[1]}`]
      ]
    });
  }

  async boostEvent(eventId: string): Promise<void> {
    await this.nostrPublish({
      kind: 7,
      content: '+',
      tags: [['e', eventId]]
    });
  }
}
```

## 3. Implementation Phases

### Phase 1: MVP (Minimum Viable Product)

**Timeline:** 4-6 weeks

**Core Features:**
- Basic scoring interface for stroke play
- Simple player management
- Local score tracking
- Basic Nostr integration for posting scores
- Profile display with basic stats

**Technical Tasks:**
1. Set up project structure and development environment
2. Implement basic scoring UI components
3. Create Nostr event kinds for golf data
4. Implement local storage for offline functionality
5. Create basic profile display
6. Set up Nostr publishing for score updates

**Deliverables:**
- Working golf scoring app
- Basic Nostr integration
- User profile system
- Local score tracking

### Phase 2: Enhanced Scoring & Lightning Integration

**Timeline:** 6-8 weeks

**Core Features:**
- Multiple game modes (Skins, Match Play, etc.)
- Handicap calculation
- Lightning Network integration for wagers
- Cost splitting functionality
- Badge system foundation

**Technical Tasks:**
1. Implement scoring engine for different game modes
2. Add handicap calculation logic
3. Integrate Lightning Network SDK
4. Create wager system
5. Implement cost splitting UI
6. Build badge achievement tracking

**Deliverables:**
- Complete scoring engine
- Lightning payment integration
- Wager system
- Badge tracking system

### Phase 3: Social Features & Advanced Badges

**Timeline:** 4-6 weeks

**Core Features:**
- Nostr social posting with templates
- Badge system with multiple categories
- Social interactions (comments, boosts)
- Achievement sharing
- Profile showcase

**Technical Tasks:**
1. Implement post template system
2. Create social interaction features
3. Build badge showcase UI
4. Add achievement notifications
5. Implement social feed

**Deliverables:**
- Complete social features
- Badge showcase system
- Social interaction capabilities
- Enhanced profile system

### Phase 4: Advanced Features & Optimization

**Timeline:** 4-6 weeks

**Core Features:**
- Advanced analytics
- Tournament support
- Mobile optimization
- Performance optimization
- Testing and documentation

**Technical Tasks:**
1. Add round analytics and statistics
2. Implement tournament functionality
3. Optimize for mobile devices
4. Add comprehensive testing
5. Create documentation

**Deliverables:**
- Advanced analytics dashboard
- Tournament system
- Mobile-optimized UI
- Complete test suite
- Documentation

## 4. UI/UX Design Guidelines

### 4.1 Design Principles

- **Clean & Minimal**: Focus on golf data with minimal distractions
- **Mobile-First**: Ensure all features work well on mobile devices
- **Accessibility**: Follow WCAG guidelines for accessibility
- **Performance**: Fast loading and responsive interactions

### 4.2 Component Structure

```
src/
├── components/
│   ├── scoring/
│   │   ├── ScoreCard.tsx
│   │   ├── HoleScore.tsx
│   │   ├── GameModeSelector.tsx
│   │   └── HandicapCalculator.tsx
│   ├── lightning/
│   │   ├── PaymentRequest.tsx
│   │   ├── WagerDialog.tsx
│   │   ├── CostSplitter.tsx
│   │   └── WalletBalance.tsx
│   ├── badges/
│   │   ├── BadgeDisplay.tsx
│   │   ├── BadgeGrid.tsx
│   │   ├── AchievementNotification.tsx
│   │   └── BadgeDetails.tsx
│   ├── social/
│   │   ├── PostTemplate.tsx
│   │   ├── SocialFeed.tsx
│   │   ├── CommentSection.tsx
│   │   └── ShareDialog.tsx
│   └── common/
│       ├── GolfCourseSelector.tsx
│       ├── PlayerSelector.tsx
│       ├── RoundSummary.tsx
│       └── StatsDisplay.tsx
```

### 4.3 Wireframes

#### Scoring Interface
```
┌─────────────────────────────────────────────────────────────┐
│                     Pine Valley Golf Club                    │
├─────────────────────────────────────────────────────────────┤
│ Hole  | Par | Score | Strokes | Putts | Fairways | Greens    │
│───────┼─────┼───────┼────────┼───────┼─────────┼───────────│
│   1   |  4  |   5   |    5   |   2   |    ✓    |    ✗      │
│   2   |  4  |   4   |    4   |   2   |    ✗    |    ✓      │
│   3   |  5  |   6   |    6   |   3   |    ✓    |    ✗      │
│   4   |  3  |   3   |    3   |   2   |    ✓    |    ✓      │
│   5   |  4  |   5   |    5   |   1   |    ✗    |    ✗      │
├─────────────────────────────────────────────────────────────┤
│ Total: 23 | Par: 20 | +3 | Handicap: 12.5                 │
├─────────────────────────────────────────────────────────────┤
│ [Game Mode] [Save Round] [Share to Nostr] [Lightning]      │
└─────────────────────────────────────────────────────────────┘
```

#### Lightning Payment Interface
```
┌─────────────────────────────────────────────────────────────┐
│                     Payment Request                         │
├─────────────────────────────────────────────────────────────┤
│ Description: Green Fee - Pine Valley Golf Club             │
│ Amount: 5,000 satoshis ($0.25)                             │
│ Players: 4 (1,250 satoshis each)                          │
│                                                         │
│ QR Code: [Payment Request QR]                             │
│                                                         │
│ Status: Pending                                            │
│                                                         │
│ [Copy Invoice] [View Details] [Split Costs]                │
└─────────────────────────────────────────────────────────────┘
```

#### Badge Display
```
┌─────────────────────────────────────────────────────────────┐
│                      My Achievements                        │
├─────────────────────────────────────────────────────────────┤
│ 🏆 Hole in One (Legendary)                                  │
│   Achieved: January 1, 2023 at Hole 7                      │
│   Description: Scored a hole in one on par 3               │
│                                                             │
│ 🥈 Breaking 90 (Rare)                                       │
│   Achieved: December 15, 2022                             │
│   Description: Shot 89 at Pine Valley Golf Club            │
│                                                             │
│ 🥉 Eagle (Common)                                          │
│   Achieved: December 10, 2022                             │
│   Description: Scored eagle on par 5                       │
│                                                             │
│ [View All] [Share Achievement] [Create Custom Badge]       │
└─────────────────────────────────────────────────────────────┘
```

## 5. API & Data Models

### 5.1 Nostr Event Kinds

```typescript
// Custom event kinds for golf
export const GOLF_KINDS = {
  ROUND: 30001,           // Golf round metadata
  HOLE: 30002,            // Individual hole scores
  PLAYER: 30003,          // Player profile in round
  GAME: 30004,           // Game mode configuration
  RESULT: 30005,         // Final round results
  BADGE_AWARD: 30006,    // Badge achievement awards
  TOURNAMENT: 30007,     // Tournament events
  COURSE: 30008,         // Golf course metadata
} as const;
```

### 5.2 Data Models

```typescript
interface GolfRound {
  id: string;
  courseId: string;
  date: number;
  players: PlayerInRound[];
  gameMode: GameMode;
  holes: HoleScore[];
  status: 'active' | 'completed' | 'cancelled';
  metadata: RoundMetadata;
}

interface PlayerInRound {
  playerId: string;
  name: string;
  handicap: number;
  scores: number[];
  total: number;
  netTotal: number;
}

interface HoleScore {
  holeNumber: number;
  par: number;
  strokes: number;
  putts: number;
  fairways: boolean;
  greens: boolean;
  sandTraps: number;
  penalties: number;
  notes?: string;
}

interface BadgeAward {
  id: string;
  badgeId: string;
  playerId: string;
  issuedAt: number;
  metadata: Record<string, any>;
}
```

### 5.3 Lightning Integration Models

```typescript
interface LightningPayment {
  id: string;
  amount: number;
  currency: 'satoshis';
  status: 'pending' | 'paid' | 'failed' | 'expired';
  metadata: PaymentMetadata;
  createdAt: number;
  paidAt?: number;
  paymentHash?: string;
  invoice?: string;
}

interface Wager {
  id: string;
  gameId: string;
  players: string[];
  amount: number;
  conditions: WagerConditions;
  status: 'pending' | 'active' | 'settled' | 'cancelled';
  createdAt: number;
  settledAt?: number;
  winner?: string;
}
```

## 6. Security & Privacy

### 6.1 Data Security

- **Nostr Encryption**: Use NIP-44 for sensitive data
- **Local Storage**: Store sensitive data only in encrypted form
- **Key Management**: Use secure key derivation for Lightning keys
- **Data Validation**: Validate all user inputs and Nostr events

### 6.2 Privacy Considerations

- **User Control**: Allow users to control what data is shared
- **Selective Sharing**: Enable sharing of specific achievements vs. full rounds
- **Anonymization**: Option to share achievements anonymously
- **Data Minimization**: Only collect necessary data

## 7. Testing Strategy

### 7.1 Unit Testing

- Scoring engine calculations
- Badge achievement logic
- Lightning payment processing
- Nostr event validation

### 7.2 Integration Testing

- End-to-end scoring workflows
- Lightning payment flows
- Nostr publishing and retrieval
- Social interactions

### 7.3 Performance Testing

- Load testing for concurrent users
- Mobile device performance
- Network resilience testing

## 8. Deployment & Scaling

### 8.1 Deployment Strategy

- **Frontend**: Static hosting on Vercel/Netlify
- **Nostr**: Integration with existing relay networks
- **Lightning**: Use Alby SDK for wallet integration
- **Database**: Local storage with Nostr for persistence

### 8.2 Scaling Considerations

- **Caching**: Implement efficient caching for frequently accessed data
- **Relay Selection**: Use multiple relays for redundancy
- **Payment Processing**: Handle high-volume Lightning payments
- **Social Features**: Optimize Nostr event publishing

## 9. Recommended Libraries & Tools

### 9.1 Core Libraries

```json
{
  "dependencies": {
    "@nostrify/nostrify": "npm:@jsr/nostrify__nostrify@^0.46.4",
    "@nostrify/react": "npm:@jsr/nostrify__react@^0.2.8",
    "nostr-tools": "^2.13.0",
    "@getalby/sdk": "^5.1.1",
    "webln": "^0.3.2",
    "zod": "^3.25.71",
    "react-hook-form": "^7.53.0",
    "@tanstack/react-query": "^5.56.2"
  }
}
```

### 9.2 Development Tools

- **Testing**: Vitest, React Testing Library
- **Linting**: ESLint with React rules
- **Type Checking**: TypeScript strict mode
- **Build**: Vite for fast development and builds

### 9.3 UI Components

- **shadcn/ui**: For consistent, accessible components
- **TailwindCSS**: For utility-first styling
- **Lucide React**: For consistent iconography

## 10. Future Enhancements

### 10.1 Phase 5: Advanced Features

- **AI-powered insights**: Course recommendations, swing analysis
- **Wearable integration**: Smartwatch data sync
- **Tournament management**: Multi-round tournaments
- **Sponsorship integration**: Brand partnerships and sponsorships

### 10.2 Phase 6: Ecosystem Expansion

- **Mobile app**: Native iOS/Android applications
- **Web3 integration**: NFT badges, tokenized achievements
- **API marketplace**: Third-party integrations
- **Pro features**: Subscription-based premium features

## 11. Conclusion

This technical roadmap provides a comprehensive plan for building Pinseekr.golf as a decentralized golf scoring platform with Lightning Network integration and Nostr social features. The modular architecture allows for incremental development and future expansion while maintaining focus on core golf functionality.

The implementation follows best practices for Nostr integration, Lightning payments, and React development, ensuring a robust and scalable solution that can grow with the platform's user base.