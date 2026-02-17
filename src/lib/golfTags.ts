// Helpers for canonical Nostr tags used by Pinseekr.golf
export { APP_KIND } from '@/lib/golf/types';
export const SUBTYPES = {
  COURSE: 'golf-course',
  ROUND: 'golf-round',
  PROFILE: 'golf-profile',
  HOLE: 'hole-score',
  PLAYER: 'golf-player',
  GAME: 'golf-game',
  RESULT: 'golf-result',
  PLAYER_SCORE: 'player-score',
  BADGE: 'golf-badge',
  INVITE_ACCEPT: 'invite-accept',
  TOURNAMENT: 'golf-tournament',
  SETTLEMENT_CLAIM: 'settlement-claim',
  PAYMENT_PROOF: 'payment-proof',
  EXPENSE: 'golf-expense',
} as const;

export type ExtraTag = string[];

/**
 * Build canonical golf tags.
 * - Always includes ['t', 'golf'] and ['t', subtype]
 * - Optionally includes ['d', id] (replaceable id)
 * - Optionally includes metadata tags (name, location, alt)
 * - Accepts extra arbitrary tags to append
 */
export function buildGolfTags(
  subtype: string,
  id?: string,
  opts?: { name?: string; location?: string; alt?: string; extra?: ExtraTag[] }
): string[][] {
  const tags: string[][] = [['t', 'golf'], ['t', subtype]];

  if (id) tags.push(['d', id]);
  if (opts?.name) tags.push(['name', opts.name]);
  if (opts?.location) tags.push(['location', opts.location]);
  if (opts?.alt) tags.push(['alt', opts.alt]);
  if (opts?.extra) tags.push(...opts.extra);

  return tags;
}
