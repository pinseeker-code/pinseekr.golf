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
  handicaps?: { [hole: number]: number }; // hole number -> stroke index (1-18)
  yardages?: { [hole: number]: number }; // hole number -> yards (legacy single yardage)
  teeYardages?: { [teeName: string]: { [hole: number]: number } }; // per-tee per-hole yardages
  sections?: { [sectionIndex: number]: string }; // section names (e.g., "Granite", "Slate")
  tees?: string[]; // tee names (e.g., ["Black", "Blue", "White"])
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
            const parsedRaw = JSON.parse(event.content) as unknown;
            const parsed = parsedRaw as {
              id?: string;
              name?: string;
              title?: string;
              courseName?: string;
              location?: string;
              courseLocation?: string;
              holes?: Record<string, number>;
              handicaps?: Record<string, number>;
              sections?: Record<string, string>;
              tees?: string[] | { name: string; yardage: number }[]; // support both formats
              teeYardages?: Record<string, Record<string, number>>;
              yardages?: Record<string, number>;
              totalPar?: number;
              createdAt?: number;
            };

            const parsedHoles = parsed.holes || {};
            const computedTotalPar = typeof parsed.totalPar === 'number'
              ? parsed.totalPar
              : Object.values(parsedHoles).map(v => Number(v) || 0).reduce((s, n) => s + n, 0);

            // Convert tees from old format { name, yardage }[] to new format string[]
            let teeNames: string[] | undefined;
            if (parsed.tees) {
              if (Array.isArray(parsed.tees) && parsed.tees.length > 0) {
                if (typeof parsed.tees[0] === 'string') {
                  teeNames = parsed.tees as string[];
                } else {
                  // Old format - extract just the names
                  teeNames = (parsed.tees as { name: string; yardage: number }[]).map(t => t.name);
                }
              }
            }

            return {
              id: parsed.id || event.tags.find(t => t[0] === 'd')?.[1] || event.id,
              name: parsed.name || parsed.title || parsed.courseName || 'Unknown Course',
              location: parsed.location || parsed.courseLocation || '',
              holes: parsed.holes || {},
              handicaps: parsed.handicaps || undefined,
              sections: parsed.sections || undefined,
              tees: teeNames,
              teeYardages: parsed.teeYardages || undefined,
              yardages: parsed.yardages || undefined,
              totalPar: computedTotalPar,
              author: event.pubkey,
              createdAt: (parsed.createdAt && typeof parsed.createdAt === 'number') ? parsed.createdAt : event.created_at * 1000,
            } as GolfCourse;
          }
        } catch {
          // Fall back to tag parsing below if JSON parse fails
        }

        // Fallback: parse hole pars, yardages and sections from tags (back-compat)
        const getTag = (name: string) => event.tags.find(tag => tag[0] === name)?.[1];
        const holes: { [hole: number]: number } = {};
        const handicaps: { [hole: number]: number } = {};
        const sections: { [sectionIndex: number]: string } = {};
        const teeNames: string[] = [];
        const teeYardages: { [teeName: string]: { [hole: number]: number } } = {};
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
          } else if (tag[0] === 'hc' && tag[1] && tag[2]) {
            // Handicap tag: ['hc', '<holeNumber>', '<handicap>']
            const holeNum = parseInt(tag[1]);
            const hc = parseInt(tag[2]);
            if (!isNaN(holeNum) && !isNaN(hc)) handicaps[holeNum] = hc;
          } else if (tag[0].startsWith('section') && tag[0] !== 'section') {
            const sectionIndex = parseInt(tag[0].replace('section', ''));
            if (!isNaN(sectionIndex) && sectionIndex >= 0) {
              sections[sectionIndex] = tag[1] || '';
            }
          } else if (tag[0] === 'tee') {
            // New format: ['tee', '<name>'] (no yardage - yardages are per-hole)
            // Old format: ['tee', '<name>', '<totalYardage>']
            const name = tag[1] || '';
            if (name && !teeNames.includes(name)) {
              teeNames.push(name);
              teeYardages[name] = {};
            }
          } else if (tag[0] === 'yard') {
            // New format: ['yard', '<teeName>', '<holeNumber>', '<yards>']
            // Old format: ['yard', '<holeNumber>', '<yards>']
            if (tag.length === 4) {
              // New format with tee name
              const teeName = tag[1];
              const holeNum = parseInt(tag[2]);
              const yards = parseInt(tag[3]) || 0;
              if (teeName && !isNaN(holeNum) && holeNum > 0) {
                if (!teeYardages[teeName]) teeYardages[teeName] = {};
                teeYardages[teeName][holeNum] = yards;
              }
            } else if (tag.length === 3) {
              // Old format without tee name
              const holeNum = parseInt(tag[1]);
              const yards = parseInt(tag[2]) || 0;
              if (!isNaN(holeNum) && holeNum > 0) yardages[holeNum] = yards;
            }
          }
        });

        return {
          id: getTag('d') || event.id,
          name: getTag('name') || 'Unknown Course',
          location: getTag('location') || '',
          holes,
          handicaps: Object.keys(handicaps).length > 0 ? handicaps : undefined,
          sections: Object.keys(sections).length > 0 ? sections : undefined,
          tees: teeNames.length > 0 ? teeNames : undefined,
          teeYardages: Object.keys(teeYardages).length > 0 ? teeYardages : undefined,
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
    mutationFn: async (course: Omit<GolfCourse, 'id' | 'author' | 'createdAt' | 'totalPar'> & { existingId?: string; scorecardImages?: string[] }) => {
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

      // Add hole handicaps (stroke index) as tags: ['hc', '<holeNumber>', '<handicap>']
      if (course.handicaps) {
        const hcHoles = Object.keys(course.handicaps).map(Number).sort((a, b) => a - b);
        for (const hole of hcHoles) {
          const hc = course.handicaps[hole];
          if (hc) tags.push(['hc', String(hole), String(hc)]);
        }
      }

      // Add tee names as tags: ['tee', '<name>']
      if (course.tees && course.tees.length > 0) {
        for (const teeName of course.tees) {
          if (teeName) tags.push(['tee', teeName]);
        }
      }

      // Add per-tee per-hole yardages as tags: ['yard', '<teeName>', '<holeNumber>', '<yards>']
      if (course.teeYardages) {
        for (const [teeName, holeYards] of Object.entries(course.teeYardages)) {
          const holeNums = Object.keys(holeYards).map(Number).sort((a, b) => a - b);
          for (const hole of holeNums) {
            const yards = holeYards[hole];
            if (yards) tags.push(['yard', teeName, String(hole), String(yards)]);
          }
        }
      }

      // Legacy: Add single per-hole yardages if no teeYardages (backwards compatibility)
      if (!course.teeYardages && course.yardages) {
        const holeNums = Object.keys(course.yardages).map(Number).sort((a, b) => a - b);
        for (const hole of holeNums) {
          const yards = course.yardages[hole];
          if (yards) tags.push(['yard', String(hole), String(yards)]);
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

      // Add scorecard image URLs as tags for easy discovery
      if (course.scorecardImages) {
        for (const url of course.scorecardImages) {
          if (url) tags.push(['scorecard-image', url]);
        }
      }

      const payload = {
        id: courseId,
        name: course.name,
        location: course.location,
        holes: course.holes,
        handicaps: course.handicaps || undefined,
        tees: course.tees || undefined,
        teeYardages: course.teeYardages || undefined,
        yardages: course.yardages || undefined, // legacy
        sections: course.sections || undefined,
        scorecardImages: course.scorecardImages || undefined,
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