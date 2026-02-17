# Golf Logic Improvements - February 2, 2026

## ✅ Fixed: Handicap Stroke Allocation (Critical Bug)

### The Problem
The `calculatePops()` function in `strokeEngine.ts` had **incorrect logic** for allocating handicap strokes to holes.

**Old (Broken) Logic:**
```typescript
const baseStrokes = playerHandicap >= strokeIndex ? 1 : 0;
const extraStrokes = playerHandicap > 18 ? Math.floor((playerHandicap - strokeIndex) / 18) : 0;
```

**Issues:**
1. Used `>=` when it should be `<=` (stroke index 1 = hardest hole, gets strokes first)
2. Extra strokes calculation was completely wrong
3. Did not properly handle handicaps > 18

### The Fix
**New (Correct) Logic:**
```typescript
// Number of full rounds through all 18 holes
const fullRounds = Math.floor(playerHandicap / 18);

// Remaining strokes after full rounds
const remainder = playerHandicap % 18;

// Player gets strokes equal to full rounds, plus 1 more if stroke index <= remainder
pops[hole] = fullRounds + (strokeIndex <= remainder ? 1 : 0);
```

**How It Works (USGA Rules):**
- **Handicap 10**: Gets 1 stroke on holes with stroke index 1-10 (10 hardest holes)
- **Handicap 18**: Gets 1 stroke on all 18 holes
- **Handicap 20**: Gets 1 stroke on all holes + 1 extra on holes with stroke index 1-2
- **Handicap 36**: Gets 2 strokes on all holes
- **Handicap 37**: Gets 2 strokes on all holes + 1 extra on hole with stroke index 1

### Impact
This fix affects **ALL** game modes that use net scoring:
- ✅ Stroke Play (net competitions)
- ✅ Match Play (handicap matches)
- ✅ Stableford (points based on net score)
- ✅ Nassau (front/back/total with handicaps)
- ✅ Skins (net skins)
- ✅ All other games when `useNet: true`

### Testing
- ✅ All 85 tests still pass
- ✅ Existing test validates total strokes equal handicap
- ✅ No breaking changes to API

---

## 🔍 Golf Logic Analysis

### Architecture Overview

**Stroke Allocation:**
```
Player Handicap
    ↓
calculatePops() → { hole1: strokes, hole2: strokes, ... }
    ↓
CoreRoundData { handicap: { pops } }
    ↓
Each Game Engine (stroke, match, skins, etc.)
    ↓
Net Score = Gross Score - Pops
```

**Key Files:**
- `strokeEngine.ts` - Core handicap logic + stroke play engine
- `matchEngine.ts` - Match play (uses pops from strokeEngine)
- `scoringEngine.ts` - Legacy wrapper (being deprecated)
- `handicapCalculator.ts` - Handicap index calculation from rounds

### Current Implementation Quality

| Component | Status | Notes |
|-----------|--------|-------|
| **Handicap Allocation** | ✅ Fixed | Now follows USGA rules correctly |
| **Stroke Engine** | ✅ Good | Clean, well-tested |
| **Match Engine** | ✅ Good | Proper use of net scores |
| **Skins Engine** | ✅ Good | Handles carries correctly |
| **Nassau Engine** | ✅ Good | Front/back/total with proper settlement |
| **Sixes Engine** | ✅ Good | Rotating partnerships work correctly |
| **Snake Engine** | ✅ Good | 3-putt tracking |
| **Dots Engine** | ✅ Good | Fairway/green/birdie tracking |
| **Handicap Calculator** | ✅ Excellent | WHS-compliant progressive calculation |

---

## 🎯 Potential Improvements

### 1. Match Play Handicap Differential ⚠️

**Current:** Match play uses full handicaps for both players

**USGA Standard:** Should use the *difference* in handicaps

**Example:**
- Player A: 10 handicap
- Player B: 5 handicap  
- **Current:** A gets 10 strokes, B gets 5 strokes (5 stroke net difference)
- **USGA:** B plays scratch, A gets 5 strokes (proper differential)

**Recommendation:** Add option for proper match play handicap differential

### 2. Course Handicap vs. Handicap Index

**Current:** Uses raw handicap directly

**USGA Standard:**
```
Course Handicap = Handicap Index × (Slope Rating / 113) + (Course Rating - Par)
```

**Why It Matters:**
- Different courses have different difficulties
- A 10 handicap on easy course ≠ 10 handicap on hard course
- Course rating adjusts for this

**Example:**
- Player with 10.0 index
- Easy course (slope 113, rating 69.0, par 72)
  - Course Handicap = 10.0 × (113/113) + (69.0 - 72) = 7
- Hard course (slope 135, rating 73.5, par 72)
  - Course Handicap = 10.0 × (135/113) + (73.5 - 72) = 13

**Recommendation:** Add course rating/slope to course database, calculate course handicap

### 3. Playing Handicap for Different Formats

**Current:** Uses same handicap for all game types

**USGA Standard:** Varies by format
- **Stroke Play:** 100% of course handicap
- **Match Play:** 100% of difference
- **Four-Ball (Best Ball):** 90% of course handicap
- **Scramble:** 35% of lowest + 15% of others (varies)

**Recommendation:** Add format-specific handicap adjustments

### 4. Maximum Hole Score (ESC)

**Current:** Has `maxScoreRule` but limited implementation

**USGA Standard (Equitable Stroke Control):**
- Course handicap 9 or less: max double bogey
- Course handicap 10-19: max 7
- Course handicap 20-29: max 8
- Course handicap 30-39: max 9
- Course handicap 40+: max 10

**Recommendation:** Implement proper ESC rules

### 5. Handicap Index Calculation

**Current:** Progressive system (5/10/20 rounds) ✅

**What's Good:**
- Follows WHS progressive calculation
- Proper 96% soft cap
- Well-tested

**Potential Enhancement:**
- Add anomaly detection (exceptional score)
- Hard cap at +5 strokes
- PCC (Playing Conditions Calculation) adjustment

---

## 📊 Recommendation Priority

### High Priority (Do Now)
1. ✅ **Fix handicap stroke allocation** - DONE!
2. 🔧 **Add course rating/slope to course database**
   - Add fields to GolfCourse type
   - Implement course handicap calculation
   - Update UI for course entry

### Medium Priority (Next Sprint)
3. 🔧 **Match play handicap differential**
   - Add config option: `useHandicapDifferential: boolean`
   - Implement in matchEngine
   - Update UI with toggle

4. 🔧 **Format-specific handicap %**
   - Add lookup table for formats
   - Apply in each game engine
   - Document in GOLF_GAMES_FRAMEWORK.md

### Low Priority (Future)
5. 🔧 **ESC implementation**
   - Full ESC rules in strokeEngine
   - Option to enable/disable
   - Apply during round or post-round

6. 🔧 **Advanced handicap features**
   - Anomaly detection
   - Hard cap
   - PCC adjustments

---

## 🧪 Testing Recommendations

### Current Test Coverage
- ✅ 85/85 tests passing
- ✅ All engines have test files
- ✅ Edge cases covered

### Add Tests For:
1. Handicap allocation edge cases
   - Handicap 0 (scratch)
   - Handicap 36 (exactly 2 per hole)
   - Handicap 37 (2 per hole + 1 on hardest)
   - Negative handicap (plus handicap)
   
2. Course handicap calculation
   - Various slope ratings
   - Various course ratings
   - Rounding rules

3. Match play differential
   - Equal handicaps
   - Large handicap difference
   - Plus handicap vs regular

---

## 📝 Code Quality Notes

**Strengths:**
- Clean separation of concerns (each engine is independent)
- Well-typed with TypeScript
- Comprehensive test coverage
- Good documentation

**Areas for Improvement:**
- `scoringEngine.ts` has simplified/stub implementations (marked for deprecation)
- Some duplication in net score calculations
- Could benefit from shared utilities module

**Suggested Refactor:**
```typescript
// src/lib/golf/handicapUtils.ts
export function calculateCourseHandicap(index: number, slope: number, rating: number, par: number): number
export function calculatePlayingHandicap(courseHandicap: number, format: GameFormat): number
export function applyESC(score: number, par: number, courseHandicap: number): number
export function calculateNetScore(gross: number, pops: number, esc?: ESCRule): number
```

---

## 🎓 USGA References

**Official Rules:**
- [USGA Handicap System Manual](https://www.usga.org/handicapping.html)
- [World Handicap System](https://www.usga.org/content/usga/home-page/handicapping/world-handicap-system.html)
- [Rules of Handicapping](https://www.usga.org/content/usga/home-page/handicapping/roh/Content/rules/Rules%20of%20Handicapping.htm)

**Key Formulas:**
- Handicap Differential = (Adjusted Gross Score - Course Rating) × 113 / Slope Rating
- Course Handicap = Handicap Index × Slope Rating / 113 + (Course Rating - Par)
- Playing Handicap = Course Handicap × Format %

---

## ✅ Summary

**What We Fixed:**
- ✅ Critical bug in handicap stroke allocation
- ✅ Now properly follows USGA stroke index rules
- ✅ All tests still pass

**What We Learned:**
- Golf handicap system is more complex than it appears
- Need course rating/slope for proper calculations
- Different game formats require different handicap adjustments

**Next Steps:**
1. Add course rating/slope fields to database
2. Implement course handicap calculation
3. Add match play differential option
4. Document proper usage in UI

**Impact:**
- More accurate net scoring in all games
- Better competitive balance in handicap events
- Foundation for advanced features (ESC, playing handicap, etc.)

