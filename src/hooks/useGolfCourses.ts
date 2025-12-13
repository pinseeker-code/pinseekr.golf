import React from 'react';
import { useNostr } from '@nostrify/react';
import { GOLF_KINDS } from '@/lib/golf/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';

export interface GolfCourse {
  id: string;
  name: string;
  location: string;
  description?: string;
  holes: { [hole: number]: number }; // hole number -> par
  yardages?: { [hole: number]: number }; // hole number -> yards
  sections?: { [sectionIndex: number]: string }; // section names (e.g., "Granite", "Slate")
  tees?: { name: string; yardage: number }[]; // tee name and yardage
  totalPar: number;
  author: string;
  createdAt: number;
  tags?: string[]; // course tags for categorization
  eventId?: string; // Nostr event ID
}

/**
 * Hook to fetch all golf courses from Nostr
 */
export function useGolfCourses() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['golf-courses'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
      const events = await nostr.query([
        {
          kinds: [GOLF_KINDS.COURSE], // Course event kind
          '#t': ['golf-course'],
          limit: 500,
        }
      ], { signal });

      const courses: GolfCourse[] = events.map(event => {
        // Try to parse JSON content first (preferred)
        try {
          if (event.content && event.content.trim().startsWith('{')) {
            const parsed = JSON.parse(event.content);
            return {
              id: (parsed.id as string) || event.tags.find(t => t[0] === 'd')?.[1] || event.id,
              name: (parsed.name as string) || (parsed.title as string) || parsed.courseName || 'Unknown Course',
              location: (parsed.location as string) || parsed.courseLocation || '',
              holes: parsed.holes || {},
              sections: parsed.sections || undefined,
              tees: parsed.tees || undefined,
              yardages: parsed.yardages || undefined,
              totalPar: typeof parsed.totalPar === 'number' ? parsed.totalPar : Object.values(parsed.holes || {}).reduce((s:any, n:any) => s + (Number(n) || 0), 0),
              author: event.pubkey,
              createdAt: (parsed.createdAt && typeof parsed.createdAt === 'number') ? parsed.createdAt : event.created_at * 1000,
            } as GolfCourse;
          }
        } catch (e) {
          // Fall back to tag parsing below if JSON parse fails
        }

        // Fallback: parse hole pars, yardages and sections from tags (back-compat)
        const getTag = (name: string) => event.tags.find(tag => tag[0] === name)?.[1];
        const holes: { [hole: number]: number } = {};
        const sections: { [sectionIndex: number]: string } = {};
        const tees: { name: string; yardage: number }[] = [];
        const yardages: { [hole: number]: number } = {};
        let totalPar = 0;

        event.tags.forEach(tag => {
          if (tag[0].startsWith('hole') && tag[0] !== 'hole') {
            const holeNumber = parseInt(tag[0].replace('hole', ''));
            if (!isNaN(holeNumber) && holeNumber > 0) {
              const par = parseInt(tag[1] || '4');
              holes[holeNumber] = par;
              totalPar += par;
            }
          } else if (tag[0].startsWith('section') && tag[0] !== 'section') {
            const sectionIndex = parseInt(tag[0].replace('section', ''));
            if (!isNaN(sectionIndex) && sectionIndex >= 0) {
              sections[sectionIndex] = tag[1] || '';
            }
          } else if (tag[0] === 'tee') {
            const name = tag[1] || '';
            const yardage = parseInt(tag[2] || '0') || 0;
            if (name) tees.push({ name, yardage });
          } else if (tag[0] === 'yard') {
            const holeNum = parseInt(tag[1] || '0');
            const yards = parseInt(tag[2] || '0') || 0;
            if (!isNaN(holeNum) && holeNum > 0) yardages[holeNum] = yards;
          }
        });

        return {
          id: getTag('d') || event.id,
          name: getTag('name') || 'Unknown Course',
          location: getTag('location') || '',
          holes,
          sections: Object.keys(sections).length > 0 ? sections : undefined,
          tees: tees.length > 0 ? tees : undefined,
          yardages: Object.keys(yardages).length > 0 ? yardages : undefined,
          totalPar,
          author: event.pubkey,
          createdAt: event.created_at * 1000,
        };
      });

      // Deduplicate courses by name - keep only the most recent version
      const coursesByName = new Map<string, GolfCourse>();
      for (const course of courses) {
        const key = course.name.toLowerCase().trim();
        const existing = coursesByName.get(key);
        // Keep the most recent version (highest createdAt)
        if (!existing || course.createdAt > existing.createdAt) {
          coursesByName.set(key, course);
        }
      }
      const dedupedCourses = Array.from(coursesByName.values());

      return dedupedCourses.sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Hook to add a new golf course to Nostr
 */
export function useAddGolfCourse() {
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (course: Omit<GolfCourse, 'id' | 'author' | 'createdAt' | 'totalPar'> & { existingId?: string; tees?: { name: string; yardage: number }[]; yardages?: { [hole: number]: number } }) => {
      // Use existing ID if editing, otherwise generate a new one
      const courseId = course.existingId || `${course.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
      
      const tags: string[][] = [
        ['d', courseId],
        ['name', course.name],
        ['location', course.location],
        ['t', 'golf-course'],
      ];

      // Add hole pars as tags - support variable number of holes
      const holeNumbers = Object.keys(course.holes).map(Number).sort((a, b) => a - b);
      for (const hole of holeNumbers) {
        const par = course.holes[hole];
        if (par) {
          tags.push([`hole${hole}`, par.toString()]);
        }
      }

      // Add tee information as tags: ['tee', '<name>', '<yardage>'] for each tee
      if (course.tees && course.tees.length > 0) {
        for (const t of course.tees) {
          const name = t.name || '';
          const yardage = (t.yardage || 0).toString();
          if (name) tags.push(['tee', name, yardage]);
        }
      }

      // Add per-hole yardages as tags: ['yard', '<holeNumber>', '<yards>']
      if ((course as unknown as { yardages?: { [hole: number]: number } }).yardages) {
        const ys = (course as unknown as { yardages?: { [hole: number]: number } }).yardages as { [hole: number]: number };
        const holeNums = Object.keys(ys).map(Number).sort((a, b) => a - b);
        for (const hn of holeNums) {
          const y = ys[hn] || 0;
          tags.push(['yard', String(hn), String(y)]);
        }
      }

      // Add section names as tags if available
      if (course.sections) {
        const sectionIndexes = Object.keys(course.sections).map(Number).sort((a, b) => a - b);
        for (const sectionIndex of sectionIndexes) {
          const sectionName = course.sections[sectionIndex];
          if (sectionName) {
            tags.push([`section${sectionIndex}`, sectionName]);
          }
        }
      }

      const payload = {
        id: courseId,
        name: course.name,
        location: course.location,
        holes: course.holes,
        yardages: (course as any).yardages || undefined,
        sections: course.sections || undefined,
        tees: course.tees || undefined,
        totalPar: Object.values(course.holes).reduce((s, n) => s + (Number(n) || 0), 0),
        createdAt: Date.now(),
      };

      const event = {
        kind: GOLF_KINDS.COURSE,
        content: JSON.stringify(payload),
        tags,
      };

      return new Promise<void>((resolve, reject) => {
        publishEvent(event, {
          onSuccess: () => resolve(),
          onError: reject,
        });
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['golf-courses'] });
    },
  });
}

/**
 * Hook to search golf courses by name or location
 */
export function useSearchCourses(query: string) {
  const { data: courses = [] } = useGolfCourses();
  
  return React.useMemo(() => {
    if (!query.trim()) return courses;
    
    const searchTerm = query.toLowerCase();
    return courses.filter(course => 
      course.name.toLowerCase().includes(searchTerm) ||
      course.location.toLowerCase().includes(searchTerm)
    );
  }, [courses, query]);
}