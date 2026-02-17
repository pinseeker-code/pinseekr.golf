import { describe, expect, it } from 'vitest';
import { createRoundEvent, createHoleScoreEvent, parseRoundEvent, validateGolfEvent } from './nostrEvents';
import { createDemoRound } from './demoData';
import { SUBTYPES } from '@/lib/golfTags';
import { APP_KIND } from './types';

describe('nostrEvents helpers', () => {
  it('publishes round events under APP_KIND with canonical t tags', () => {
    const round = createDemoRound();
    const event = createRoundEvent(round);

    expect(event.kind).toBe(APP_KIND);
    expect(event.tags.some(tag => tag[0] === 't' && tag[1] === 'golf')).toBe(true);
    expect(event.tags.some(tag => tag[0] === 't' && tag[1] === SUBTYPES.ROUND)).toBe(true);
  });

  it('parses round events only when both golf and subtype tags exist', () => {
    const round = createDemoRound();
    const event = createRoundEvent(round);

    expect(parseRoundEvent(event)).not.toBeNull();

    const withoutSubtype = {
      ...event,
      tags: event.tags.filter(tag => !(tag[0] === 't' && tag[1] === SUBTYPES.ROUND)),
    };

    expect(parseRoundEvent(withoutSubtype)).toBeNull();
  });

  it('creates hole score events with APP_KIND and valid tags', () => {
    const round = createDemoRound();
const holeScore = round.holes[0]!;
    const player = round.players[0]!;
    const event = createHoleScoreEvent(holeScore, round.id, player);

    expect(event.kind).toBe(APP_KIND);
    expect(event.tags.some(tag => tag[0] === 't' && tag[1] === 'golf')).toBe(true);
    expect(event.tags.some(tag => tag[0] === 't' && tag[1] === SUBTYPES.HOLE)).toBe(true);
    expect(validateGolfEvent(event)).toBe(true);

    const withoutSubtype = {
      ...event,
      tags: event.tags.filter(tag => !(tag[0] === 't' && tag[1] === SUBTYPES.HOLE)),
    };

    expect(validateGolfEvent(withoutSubtype)).toBe(false);
  });
});