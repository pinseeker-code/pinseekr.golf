import { useNostr } from '@nostrify/react';
import { GOLF_KINDS, OLD_GOLF_KINDS } from '@/lib/golf/types';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { type GolfCourse } from './useGolfCourses';

interface CourseSearchFilters {
  name?: string;
  location?: string;
  tags?: string[];
  author?: string;
  limit?: number;
}

export function useDiscoverCourses(filters: CourseSearchFilters = {}) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['discover-courses', filters],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Build filter for course discovery
      const searchFilters: NostrFilter[] = [{
        kinds: [GOLF_KINDS.COURSE, OLD_GOLF_KINDS.COURSE], // accept new and legacy course kinds
        '#t': ['golf-course'], // Ensure we only get golf courses
        limit: filters.limit || 50,
      }];

      // Add tag filters if specified
      if (filters.tags && filters.tags.length > 0) {
        // Combine with existing golf-course tag
        searchFilters[0]['#t'] = ['golf-course', ...filters.tags];
      }

      // Add author filter if specified
      if (filters.author) {
        searchFilters[0].authors = [filters.author];
      }

      const events = await nostr.query(searchFilters, { signal });
      
      // Parse events into GolfCourse objects
      const courses: GolfCourse[] = events
        .filter(validateCourseEvent)
        .map(parseEventToCourse)
        .filter((course): course is GolfCourse => course !== null);

      // Apply client-side filtering for name/location if needed
      let filteredCourses = courses;
      
      if (filters.name) {
        const nameQuery = filters.name.toLowerCase();
        filteredCourses = filteredCourses.filter(course => 
          course.name.toLowerCase().includes(nameQuery)
        );
      }

      if (filters.location) {
        const locationQuery = filters.location.toLowerCase();
        filteredCourses = filteredCourses.filter(course => 
          course.location.toLowerCase().includes(locationQuery)
        );
      }

      // Deduplicate courses by name - keep the most recent version
      const dedupeMap = new Map<string, typeof filteredCourses[0]>();
      for (const course of filteredCourses) {
        const key = course.name.toLowerCase().trim();
        const existing = dedupeMap.get(key);
        if (!existing || course.createdAt > existing.createdAt) {
          dedupeMap.set(key, course);
        }
      }

      const deduped = Array.from(dedupeMap.values());

      return deduped.sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: true,
  });
}

function validateCourseEvent(event: NostrEvent): boolean {
  // Check if it's a golf course event
  if (event.kind !== GOLF_KINDS.COURSE && event.kind !== OLD_GOLF_KINDS.COURSE) return false;

  // Check for required tags
  const dTag = event.tags.find(([name]) => name === 'd')?.[1];
  const nameTag = event.tags.find(([name]) => name === 'name')?.[1];
  const locationTag = event.tags.find(([name]) => name === 'location')?.[1];

  // All courses require 'd', 'name', and 'location' tags
  if (!dTag || !nameTag || !locationTag) return false;

  // Check for at least some holes
  const holeCount = event.tags.filter(([name]) => name.startsWith('hole')).length;
  if (holeCount < 9) return false; // Minimum 9 holes

  return true;
}

function parseEventToCourse(event: NostrEvent): GolfCourse | null {
  try {
    const getTag = (name: string) => event.tags.find(tag => tag[0] === name)?.[1];
    
    const dTag = getTag('d');
    const nameTag = getTag('name');
    const locationTag = getTag('location');
    const descriptionTag = getTag('description');

    if (!dTag || !nameTag || !locationTag) return null;

    // Parse hole pars and sections from tags
    const holes: { [hole: number]: number } = {};
    const sections: { [sectionIndex: number]: string } = {};
    let totalPar = 0;
    
    event.tags.forEach(tag => {
      // Find all tags that start with "hole" followed by a number
      if (tag[0].startsWith('hole') && tag[0] !== 'hole') {
        const holeNumber = parseInt(tag[0].replace('hole', ''));
        if (!isNaN(holeNumber) && holeNumber > 0) {
          const par = parseInt(tag[1] || '4');
          holes[holeNumber] = par;
          totalPar += par;
        }
      }
      
      // Find section name tags
      if (tag[0].startsWith('section') && tag[1]) {
        const sectionIndex = parseInt(tag[0].replace('section', ''));
        if (!isNaN(sectionIndex)) {
          sections[sectionIndex] = tag[1];
        }
      }
    });

    // Get course tags for categorization (excluding system tags)
    const courseTags = event.tags
      .filter(([name]) => name === 't')
      .map(([, value]) => value)
      .filter((tag): tag is string => !!tag && tag !== 'golf-course');

    return {
      id: dTag,
      name: nameTag,
      location: locationTag,
      description: descriptionTag,
      holes,
      sections: Object.keys(sections).length > 0 ? sections : undefined,
      totalPar,
      author: event.pubkey,
      createdAt: event.created_at * 1000,
      tags: courseTags.length > 0 ? courseTags : undefined,
      eventId: event.id,
    };
  } catch (error) {
    console.error('Error parsing course event:', error);
    return null;
  }
}

// Hook for searching public courses with common filters
export function usePublicCourses(searchTerm?: string) {
  return useDiscoverCourses({
    name: searchTerm,
    tags: ['public'], // Look for courses tagged as public
    limit: 100,
  });
}

// Hook for tournament courses
export function useTournamentCourses() {
  return useDiscoverCourses({
    tags: ['tournament', 'championship'],
    limit: 50,
  });
}

// Hook for featured/popular courses
export function useFeaturedCourses() {
  return useDiscoverCourses({
    tags: ['featured', 'popular'],
    limit: 30,
  });
}