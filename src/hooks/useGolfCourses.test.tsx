import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useGolfCourses } from './useGolfCourses';
import { APP_KIND } from '@/lib/golf/types';
import type { NostrEvent } from '@nostrify/nostrify';
import React from 'react';

// Mock dependencies
vi.mock('@nostrify/react', () => ({
  useNostr: vi.fn(),
}));

vi.mock('@/lib/offline/db', () => ({
  db: {
    courses: {
      toArray: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

describe('useGolfCourses', () => {
  let queryClient: QueryClient;

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

  it('fetches and returns golf courses from Nostr', async () => {
    const mockEvent: NostrEvent = {
      id: 'test-event-id',
      pubkey: 'test-pubkey',
      created_at: 1700000000,
      kind: APP_KIND,
      tags: [
        ['d', 'pebble-beach'],
        ['t', 'golf'],
        ['t', 'golf-course'],
        ['name', 'Pebble Beach Golf Links'],
        ['location', 'Pebble Beach, CA'],
      ],
      content: JSON.stringify({
        name: 'Pebble Beach Golf Links',
        location: 'Pebble Beach, CA',
        holes: {
          1: 4,
          2: 5,
          3: 4,
          4: 4,
          5: 3,
          6: 5,
          7: 3,
          8: 4,
          9: 4,
          10: 4,
          11: 4,
          12: 3,
          13: 4,
          14: 5,
          15: 4,
          16: 4,
          17: 3,
          18: 5,
        },
        totalPar: 72,
      }),
      sig: 'test-sig',
    };

    const mockQuery = vi.fn().mockResolvedValue([mockEvent]);
    const fakeNostr = { query: mockQuery } as unknown as { query: (...args: unknown[]) => Promise<import('@nostrify/nostrify').NostrEvent[]> };
    vi.mocked(useNostr).mockReturnValue({ nostr: fakeNostr } as unknown as ReturnType<typeof useNostr>);

    const { result } = renderHook(() => useGolfCourses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0]!.name).toBe('Pebble Beach Golf Links');
    expect(result.current.data![0]!.location).toBe('Pebble Beach, CA');
    expect(result.current.data![0]!.totalPar).toBe(72);
    expect(Object.keys(result.current.data![0]!.holes)).toHaveLength(18);
  });

  it('filters out invalid courses', async () => {
    const validEvent: NostrEvent = {
      id: 'valid-id',
      pubkey: 'test-pubkey',
      created_at: 1700000000,
      kind: APP_KIND,
      tags: [
        ['d', 'valid-course'],
        ['t', 'golf'],
        ['t', 'golf-course'],
      ],
      content: JSON.stringify({
        name: 'Valid Course',
        location: 'Test Location',
        holes: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4 },
        totalPar: 36,
      }),
      sig: 'test-sig',
    };

    const invalidEvent: NostrEvent = {
      id: 'invalid-id',
      pubkey: 'test-pubkey',
      created_at: 1700000000,
      kind: APP_KIND,
      tags: [
        ['d', 'invalid-course'],
        ['t', 'golf'],
        ['t', 'golf-course'],
      ],
      content: JSON.stringify({
        name: 'Unknown Course',
        location: 'Test Location',
        holes: {},
        totalPar: 0,
      }),
      sig: 'test-sig',
    };

    const mockQuery = vi.fn().mockResolvedValue([validEvent, invalidEvent]);
    const fakeNostr = { query: mockQuery } as unknown as { query: (...args: unknown[]) => Promise<import('@nostrify/nostrify').NostrEvent[]> };
    vi.mocked(useNostr).mockReturnValue({ nostr: fakeNostr } as unknown as ReturnType<typeof useNostr>);

    const { result } = renderHook(() => useGolfCourses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0]!.name).toBe('Valid Course');
  });

  it('deduplicates courses by name keeping most recent', async () => {
    const olderEvent: NostrEvent = {
      id: 'older-id',
      pubkey: 'test-pubkey',
      created_at: 1700000000,
      kind: APP_KIND,
      tags: [
        ['d', 'course-v1'],
        ['t', 'golf'],
        ['t', 'golf-course'],
      ],
      content: JSON.stringify({
        name: 'Duplicate Course',
        holes: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4 },
        totalPar: 36,
      }),
      sig: 'test-sig',
    };

    const newerEvent: NostrEvent = {
      id: 'newer-id',
      pubkey: 'test-pubkey',
      created_at: 1700001000,
      kind: APP_KIND,
      tags: [
        ['d', 'course-v2'],
        ['t', 'golf'],
        ['t', 'golf-course'],
      ],
      content: JSON.stringify({
        name: 'Duplicate Course',
        location: 'Updated Location',
        holes: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4 },
        totalPar: 36,
      }),
      sig: 'test-sig',
    };

    const mockQuery = vi.fn().mockResolvedValue([olderEvent, newerEvent]);
    const fakeNostr = { query: mockQuery } as unknown as { query: (...args: unknown[]) => Promise<import('@nostrify/nostrify').NostrEvent[]> };
    vi.mocked(useNostr).mockReturnValue({ nostr: fakeNostr } as unknown as ReturnType<typeof useNostr>);

    const { result } = renderHook(() => useGolfCourses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0]!.location).toBe('Updated Location');
    expect(result.current.data![0]!.createdAt).toBe(1700001000 * 1000);
  });

  it('sorts courses alphabetically by name', async () => {
    const courseC: NostrEvent = {
      id: 'c-id',
      pubkey: 'test-pubkey',
      created_at: 1700000000,
      kind: APP_KIND,
      tags: [['d', 'c-course'], ['t', 'golf'], ['t', 'golf-course']],
      content: JSON.stringify({
        name: 'Charlie Course',
        holes: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4 },
        totalPar: 36,
      }),
      sig: 'test-sig',
    };

    const courseA: NostrEvent = {
      id: 'a-id',
      pubkey: 'test-pubkey',
      created_at: 1700000000,
      kind: APP_KIND,
      tags: [['d', 'a-course'], ['t', 'golf'], ['t', 'golf-course']],
      content: JSON.stringify({
        name: 'Alpha Course',
        holes: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4 },
        totalPar: 36,
      }),
      sig: 'test-sig',
    };

    const courseB: NostrEvent = {
      id: 'b-id',
      pubkey: 'test-pubkey',
      created_at: 1700000000,
      kind: APP_KIND,
      tags: [['d', 'b-course'], ['t', 'golf'], ['t', 'golf-course']],
      content: JSON.stringify({
        name: 'Bravo Course',
        holes: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4 },
        totalPar: 36,
      }),
      sig: 'test-sig',
    };

    const mockQuery = vi.fn().mockResolvedValue([courseC, courseA, courseB]);
    const fakeNostr = { query: mockQuery } as unknown as { query: (...args: unknown[]) => Promise<import('@nostrify/nostrify').NostrEvent[]> };
    vi.mocked(useNostr).mockReturnValue({ nostr: fakeNostr } as unknown as ReturnType<typeof useNostr>);

    const { result } = renderHook(() => useGolfCourses(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0]!.name).toBe('Alpha Course');
    expect(result.current.data![1]!.name).toBe('Bravo Course');
    expect(result.current.data![2]!.name).toBe('Charlie Course');
  });
});
