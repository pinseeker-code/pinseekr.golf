# Format-Specific Handicap Adjustments

## Overview

Different golf game formats require different handicap adjustments for fair competition. This document explains how Pinseekr handles format-specific handicaps.

## Implementation

### Core Utilities

**File:** `src/lib/golf/handicapUtils.ts`

Provides format-specific handicap calculations without requiring slope ratings or course ratings. Uses simplified percentage-based adjustments suitable for decentralized golf.

### Format Adjustments

| Format | Percentage | Rationale |
|--------|------------|-----------|
| **Stroke Play** | 100% | Standard individual competition |
| **Match Play** | 100%* | Head-to-head competition (*see differential below) |
| **Nassau** | 100% | Stroke play in 3 sections (front/back/total) |
| **Skins** | 100% | Hole-by-hole stroke competition |
| **Best Ball** | 90% | Team format makes it easier to score well |
| **Scramble** | 35% (lowest) / 15% (others) | Team picks best shot each time |
| **Side Games** | 100% | Dots, Snake, Sixes use main format |

## Usage Examples

### 1. Stroke Play with Best Ball Format

```typescript
import { convertToRoundData } from './strokeEngine';

const players = [
  { playerId: 'alice', scores: [...], handicap: 10 },
  { playerId: 'bob', scores: [...], handicap: 20 },
];

// Apply 90% handicap for best ball
const roundData = convertToRoundData(
  players,
  courseData,
  'best-ball'  // Alice gets 9 strokes, Bob gets 18
);
```

### 2. Match Play with Handicap Differential

```typescript
const players = [
  { playerId: 'alice', scores: [...], handicap: 5 },
  { playerId: 'bob', scores: [...], handicap: 15 },
];

// Use differential: Alice plays scratch, Bob gets 10 strokes
const roundData = convertToRoundData(
  players,
  courseData,
  'match-play',
  true  // useHandicapDifferential
);

// Alice gets 0 pops per hole, Bob gets strokes based on 10 handicap
```

### 3. Scramble Team

```typescript
const players = [
  { playerId: 'alice', scores: [...], handicap: 10 },  // Lowest
  { playerId: 'bob', scores: [...], handicap: 15 },
  { playerId: 'charlie', scores: [...], handicap: 20 },
  { playerId: 'david', scores: [...], handicap: 25 },
];

// Apply scramble adjustments
const roundData = convertToRoundData(
  players,
  courseData,
  'scramble'
);

// Alice: 10 * 0.35 = 4 (3.5 rounds to 4)
// Bob: 15 * 0.15 = 2 (2.25 rounds to 2)
// Charlie: 20 * 0.15 = 3
// David: 25 * 0.15 = 4 (3.75 rounds to 4)
```

## API Reference

### `getHandicapPercentage(format: GameFormat): number`

Returns the handicap adjustment percentage for a format.

**Example:**
```typescript
getHandicapPercentage('best-ball') // 0.9 (90%)
getHandicapPercentage('stroke-play') // 1.0 (100%)
```

### `calculatePlayingHandicap(handicap: number, format: GameFormat): number`

Calculates adjusted handicap for a format. Rounds to nearest integer.

**Example:**
```typescript
calculatePlayingHandicap(10, 'best-ball') // 9
calculatePlayingHandicap(15, 'best-ball') // 14 (13.5 rounds to 14)
```

### `calculateScrambleHandicaps(handicaps: number[]): number[]`

Special calculation for scramble format: 35% of lowest, 15% of others.

**Example:**
```typescript
calculateScrambleHandicaps([10, 20, 15, 25])
// [4, 3, 2, 4]  (10*0.35, 20*0.15, 15*0.15, 25*0.15)
```

### `calculateMatchPlayDifferential(hcp1: number, hcp2: number): [number, number]`

Calculates match play handicap differential. Lower handicap player plays scratch.

**Example:**
```typescript
calculateMatchPlayDifferential(5, 15)
// [0, 10]  (Player 1 scratch, Player 2 gets 10 strokes)

calculateMatchPlayDifferential(15, 5)
// [10, 0]  (Player 1 gets 10, Player 2 scratch)
```

### `adjustHandicapsForFormat(handicaps: Record<string, number>, format: GameFormat, useMatchDifferential?: boolean): Record<string, number>`

Applies format-specific adjustments to all players.

**Example:**
```typescript
adjustHandicapsForFormat(
  { alice: 10, bob: 20, charlie: 15 },
  'best-ball'
)
// { alice: 9, bob: 18, charlie: 14 }
```

## Integration with Game Engines

### Stroke Engine

```typescript
import { strokeEngine, convertToRoundData } from './strokeEngine';

const players = [
  { playerId: 'alice', scores: [...], handicap: 10 },
  { playerId: 'bob', scores: [...], handicap: 20 },
];

// Convert with format adjustment
const roundData = convertToRoundData(players, courseData, 'best-ball');

// Run engine
const result = strokeEngine(roundData, {
  useNet: true,
  format: 'best-ball'
});
```

### Match Engine

```typescript
import { matchEngine } from './matchEngine';

const roundData = convertToRoundData(players, courseData, 'match-play', true);

const result = matchEngine(roundData, {
  useNet: true,
  useHandicapDifferential: true
});
```

## Configuration in UI

### Toggle for Match Play Differential

```tsx
<Switch
  checked={useHandicapDifferential}
  onCheckedChange={setUseHandicapDifferential}
/>
<Label>
  Use handicap differential
  <span className="text-xs text-muted-foreground">
    Lower handicap plays scratch, higher gets strokes
  </span>
</Label>
```

### Format Selection Affects Handicaps

```tsx
<Select value={format} onValueChange={setFormat}>
  <SelectItem value="stroke-play">Stroke Play (100%)</SelectItem>
  <SelectItem value="match-play">Match Play (100%)</SelectItem>
  <SelectItem value="best-ball">Best Ball (90%)</SelectItem>
  <SelectItem value="scramble">Scramble (35%/15%)</SelectItem>
</Select>
```

## Testing

**Test File:** `src/lib/golf/handicapUtils.test.ts`

- ✅ 20 comprehensive tests
- ✅ All format percentages
- ✅ Scramble special rules
- ✅ Match play differential
- ✅ Rounding behavior
- ✅ Edge cases (scratch, equal handicaps, empty arrays)

## Why No Slope Ratings?

Traditional golf uses course rating and slope rating to calculate "course handicap" which adjusts for course difficulty. We skip this for several reasons:

1. **Simplicity** - Most casual golf doesn't track slope/rating
2. **Decentralized** - No central authority to verify course ratings
3. **Good Enough** - Percentage adjustments achieve the goal of fairness
4. **User Choice** - Players can manually adjust handicaps if desired

The format-specific adjustments are the most important factor for competitive balance in team formats.

## Future Enhancements

### Possible Additions

1. **Custom Percentages** - Let users override default percentages
2. **Historical Data** - Track performance by format and suggest adjustments
3. **Format-Specific Stats** - Compare performance across formats
4. **Team Balancing** - Auto-suggest balanced teams based on adjusted handicaps

### Not Planned

- ❌ Slope ratings (unnecessary complexity)
- ❌ Course rating database (unmaintainable in decentralized system)
- ❌ Playing Conditions Calculation (PCC) - requires centralized data
- ❌ Hard cap rules - adds complexity without much benefit

## References

### Standard Golf Rules

While we don't implement full USGA rules, we reference them for format percentages:

- **Best Ball**: USGA recommends 90% for four-ball formats
- **Scramble**: Common rule is 35%/15%/10%/5% or 25%/20%/15%/10%
- **Match Play**: Standard is to use handicap differential

### Pinseekr Philosophy

> "Decentralized golf doesn't need USGA approval. The format-specific adjustments provide fair competition without bureaucratic overhead."

Keep it simple. Keep it fair. Keep it decentralized.
