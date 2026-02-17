import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useGolfProfile } from './useGolfProfile';
import { APP_KIND } from '@/lib/golf/types';
import { SUBTYPES } from '@/lib/golfTags';
import type { NostrEvent } from '@nostrify/nostrify';
import React from 'react';

// Mock dependencies
vi.mock('@nostrify/react', () => ({
  useNostr: vi.fn(),
}));

vi.mock('@/lib/offline/db', () => ({
  db: {
    profiles: {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

describe('useGolfProfile', () => {
  let queryClient: QueryClient;
  const testPubkey = 'test-pubkey-123';

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('fetches and returns a golf profile from Nostr', async () => {
    const mockProfileEvent: NostrEvent = {
      id: 'profile-event-id',
      pubkey: testPubkey,
      created_at: 1700000000,
      kind: APP_KIND,
      tags: [
        ['d', 'golf-profile'],
        ['t', 'golf'],
        ['t', SUBTYPES.PROFILE],
        ['name', 'John Golfer'],
        ['handicap', '12'],
        ['home_course', 'Pebble Beach'],
      ],
      content: '',
      sig: 'test-sig',
    };

    const mockQuery = vi.fn().mockResolvedValue([mockProfileEvent]);
    const fakeNostr = { query: mockQuery } as unknown as { query: (...args: unknown[]) => Promise<import('@nostrify/nostrify').NostrEvent[]> };
    vi.mocked(useNostr).mockReturnValue({ nostr: fakeNostr } as unknown as ReturnType<typeof useNostr>);

    const { result } = renderHook(() => useGolfProfile(testPubkey), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.pubkey).toBe(testPubkey);
    expect(result.current.data?.name).toBe('John Golfer');
    expect(result.current.data?.handicap).toBe(12);
    expect(result.current.data?.homeCourse).toBe('Pebble Beach');
  });

  it('returns null when no profile is found', async () => {
    const mockQuery = vi.fn().mockResolvedValue([]);
    const fakeNostr = { query: mockQuery } as unknown as { query: (...args: unknown[]) => Promise<import('@nostrify/nostrify').NostrEvent[]> };
    vi.mocked(useNostr).mockReturnValue({ nostr: fakeNostr } as unknown as ReturnType<typeof useNostr>);

    const { result } = renderHook(() => useGolfProfile(testPubkey), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it('does not fetch when pubkey is undefined', async () => {
    const mockQuery = vi.fn();
    const fakeNostr = { query: mockQuery } as unknown as { query: (...args: unknown[]) => Promise<import('@nostrify/nostrify').NostrEvent[]> };
    vi.mocked(useNostr).mockReturnValue({ nostr: fakeNostr } as unknown as ReturnType<typeof useNostr>);

    const { result } = renderHook(() => useGolfProfile(undefined), { wrapper });

    // Wait a bit to ensure no fetch happens
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockQuery).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('parses stats from profile tags', async () => {
    const mockStats = {
      roundsPlayed: 50,
      averageScore: 85,
      bestScore: 78,
      worstScore: 95,
      totalStrokes: 4250,
      fairwayHitPercentage: 65,
      greenInRegulationPercentage: 55,
      averagePutts: 32,
      holesInOne: 1,
      eagles: 5,
      birdies: 40,
      pars: 300,
      bogeys: 180,
      doubleBogeys: 50,
      tripleBogeyOrWorse: 15,
      lastUpdated: Date.now(),
    };

    const mockProfileEvent: NostrEvent = {
      id: 'profile-event-id',
      pubkey: testPubkey,
      created_at: 1700000000,
      kind: APP_KIND,
      tags: [
        ['d', 'golf-profile'],
        ['t', 'golf'],
        ['t', SUBTYPES.PROFILE],
        ['name', 'Stats Player'],
        ['handicap', '10'],
        ['stats', JSON.stringify(mockStats)],
      ],
      content: '',
      sig: 'test-sig',
    };

    const mockQuery = vi.fn().mockResolvedValue([mockProfileEvent]);
    const fakeNostr = { query: mockQuery } as unknown as { query: (...args: unknown[]) => Promise<import('@nostrify/nostrify').NostrEvent[]> };
    vi.mocked(useNostr).mockReturnValue({ nostr: fakeNostr } as unknown as ReturnType<typeof useNostr>);

    const { result } = renderHook(() => useGolfProfile(testPubkey), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.stats).toBeDefined();
    expect(result.current.data?.stats.roundsPlayed).toBe(50);
    expect(result.current.data?.stats.averageScore).toBe(85);
    expect(result.current.data?.stats.bestScore).toBe(78);
    expect(result.current.data?.stats.holesInOne).toBe(1);
    expect(result.current.data?.stats.birdies).toBe(40);
  });

  it('handles profiles with badges', async () => {
    const mockBadges = [
      {
        id: 'first-round',
        name: 'First Round',
        description: 'Complete your first round',
        icon: '🎉',
        category: 'participation' as const,
        criteria: 'Play 1 round',
        rarity: 'common' as const,
        earnedAt: Date.now() - 86400000,
      },
    ];

    const mockProfileEvent: NostrEvent = {
      id: 'profile-event-id',
      pubkey: testPubkey,
      created_at: 1700000000,
      kind: APP_KIND,
      tags: [
        ['d', 'golf-profile'],
        ['t', 'golf'],
        ['t', SUBTYPES.PROFILE],
        ['name', 'Badge Collector'],
        ['badges', JSON.stringify(mockBadges)],
      ],
      content: '',
      sig: 'test-sig',
    };

    const mockQuery = vi.fn().mockResolvedValue([mockProfileEvent]);
    const fakeNostr = { query: mockQuery } as unknown as { query: (...args: unknown[]) => Promise<import('@nostrify/nostrify').NostrEvent[]> };
    vi.mocked(useNostr).mockReturnValue({ nostr: fakeNostr } as unknown as ReturnType<typeof useNostr>);

    const { result } = renderHook(() => useGolfProfile(testPubkey), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.badges).toBeDefined();
    expect(result.current.data?.badges).toHaveLength(1);
    expect(result.current.data!.badges![0]!.name).toBe('First Round');
    expect(result.current.data!.badges![0]!.rarity).toBe('common');
  });

  it('uses correct Nostr filter for profile query', async () => {
    const mockQuery = vi.fn().mockResolvedValue([]);
    const fakeNostr = { query: mockQuery } as unknown as { query: (...args: unknown[]) => Promise<import('@nostrify/nostrify').NostrEvent[]> };
    vi.mocked(useNostr).mockReturnValue({ nostr: fakeNostr } as unknown as ReturnType<typeof useNostr>);

    renderHook(() => useGolfProfile(testPubkey), { wrapper });

    await waitFor(() => expect(mockQuery).toHaveBeenCalled());

    const filterUsed = mockQuery.mock.calls[0]![0][0] as import('@nostrify/nostrify').NostrFilter;
    expect(filterUsed.kinds).toEqual([APP_KIND]);
    expect(filterUsed.authors).toEqual([testPubkey]);
    expect(filterUsed['#t']).toContain('golf');
    expect(filterUsed['#t']).toContain(SUBTYPES.PROFILE);
    expect(filterUsed['#d']).toEqual(['golf-profile']);
    expect(filterUsed.limit).toBe(1);
  });
});
