import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CourseDatabase } from '@/lib/golf/courseDatabase';
import {
  GolfCourse,
  CourseSearchFilters,
  CourseSearchResult as _CourseSearchResult,
  TeeTimeSlot
} from '@/lib/golf/courseTypes';

// Global course database instance
const courseDatabase = new CourseDatabase();

/**
 * Hook to search for golf courses
 */
export function useCourseSearch(filters: CourseSearchFilters) {
  return useQuery({
    queryKey: ['course-search', filters],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return courseDatabase.searchCourses(filters);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get a specific course by ID
 */
export function useCourse(courseId: string) {
  return useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      return courseDatabase.getCourseById(courseId);
    },
    enabled: !!courseId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to get all courses
 */
export function useAllCourses() {
  return useQuery({
    queryKey: ['courses-all'],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 400));
      return courseDatabase.getAllCourses();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}

/**
 * Hook for nearby courses based on user location
 */
export function useNearbyCourses(
  location: { latitude: number; longitude: number } | null,
  radius: number = 25
) {
  const filters = useMemo(() => {
    if (!location) return null;
    return {
      location: {
        center: location,
        radius
      }
    };
  }, [location, radius]);

  return useQuery({
    queryKey: ['nearby-courses', location, radius],
    queryFn: async () => {
      if (!filters) return [];
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 600));
      return courseDatabase.searchCourses(filters);
    },
    enabled: !!location,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for course recommendations based on preferences
 */
export function useRecommendedCourses(preferences: {
  difficulty?: number[];
  priceRange?: string[];
  courseType?: string[];
  amenities?: string[];
}) {
  return useQuery({
    queryKey: ['recommended-courses', preferences],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get all courses and apply preference-based filtering
      const allCourses = courseDatabase.getAllCourses();
      let filtered = allCourses;

      if (preferences.difficulty?.length) {
        filtered = filtered.filter(course =>
          preferences.difficulty!.includes(course.metadata.difficulty)
        );
      }

      if (preferences.priceRange?.length) {
        filtered = filtered.filter(course =>
          preferences.priceRange!.includes(course.metadata.priceRange)
        );
      }

      if (preferences.courseType?.length) {
        filtered = filtered.filter(course =>
          preferences.courseType!.includes(course.metadata.courseType)
        );
      }

      if (preferences.amenities?.length) {
        filtered = filtered.filter(course =>
          preferences.amenities!.every(amenity =>
            course.amenities.some(a => a.type === amenity && a.available)
          )
        );
      }

      // Sort by rating
      return filtered.sort((a, b) => b.rating - a.rating).slice(0, 10);
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook for popular/featured courses
 */
export function useFeaturedCourses() {
  return useQuery({
    queryKey: ['featured-courses'],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Return highly rated courses
      return courseDatabase.getAllCourses()
        .filter(course => course.rating >= 4.5)
        .sort((a, b) => b.rating - a.rating);
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook for course statistics
 */
export function useCourseStats() {
  return useQuery({
    queryKey: ['course-stats'],
    queryFn: async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 200));

      const courses = courseDatabase.getAllCourses();

      return {
        totalCourses: courses.length,
        averageRating: courses.reduce((sum, course) => sum + course.rating, 0) / courses.length,
        coursesByType: courses.reduce((acc, course) => {
          acc[course.metadata.courseType] = (acc[course.metadata.courseType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        coursesByDifficulty: courses.reduce((acc, course) => {
          acc[course.metadata.difficulty] = (acc[course.metadata.difficulty] || 0) + 1;
          return acc;
        }, {} as Record<number, number>),
        topRatedCourses: courses
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 5)
          .map(course => ({ id: course.id, name: course.name, rating: course.rating }))
      };
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Hook for user's favorite courses (would integrate with user data)
 */
export function useFavoriteCourses() {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('favorite-courses');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading favorite courses:', error);
      }
    }
  }, []);

  const addFavorite = (courseId: string) => {
    setFavorites(prev => {
      const updated = [...prev, courseId].filter((id, index, arr) =>
        arr.indexOf(id) === index
      );
      localStorage.setItem('favorite-courses', JSON.stringify(updated));
      return updated;
    });
  };

  const removeFavorite = (courseId: string) => {
    setFavorites(prev => {
      const updated = prev.filter(id => id !== courseId);
      localStorage.setItem('favorite-courses', JSON.stringify(updated));
      return updated;
    });
  };

  const isFavorite = (courseId: string) => favorites.includes(courseId);

  const favoriteCourses = useQuery({
    queryKey: ['favorite-courses', favorites],
    queryFn: async () => {
      if (favorites.length === 0) return [];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      return favorites
        .map(id => courseDatabase.getCourseById(id))
        .filter((course): course is GolfCourse => course !== undefined);
    },
    enabled: favorites.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    favorites: favoriteCourses.data || [],
    isLoading: favoriteCourses.isLoading,
    addFavorite,
    removeFavorite,
    isFavorite,
    favoriteIds: favorites
  };
}

/**
 * Hook for course tee times (mock data)
 */
export function useCourseTimes(courseId: string, date?: Date) {
  return useQuery({
    queryKey: ['course-times', courseId, date?.toISOString()],
    queryFn: async (): Promise<TeeTimeSlot[]> => {
      if (!courseId) return [];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 400));

      // Generate mock tee times
      const selectedDate = date || new Date();
      const times: TeeTimeSlot[] = [];

      // Generate times from 7 AM to 6 PM
      for (let hour = 7; hour <= 18; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

          times.push({
            id: `${courseId}-${selectedDate.toISOString().split('T')[0]}-${timeString}`,
            courseId,
            date: selectedDate.getTime(),
            time: timeString,
            available: Math.random() > 0.3, // 70% availability
            maxPlayers: 4,
            currentBookings: Math.floor(Math.random() * 3),
            pricePerPlayer: Math.floor(Math.random() * 200) + 50, // $50-$250
            currency: 'USD',
            restrictions: Math.random() > 0.8 ? ['Members only'] : undefined
          });
        }
      }

      return times.filter(time => time.available);
    },
    enabled: !!courseId,
    staleTime: 2 * 60 * 1000, // 2 minutes (tee times change frequently)
  });
}

/**
 * Hook for course weather (mock data)
 */
export function useCourseWeather(courseId: string) {
  return useQuery({
    queryKey: ['course-weather', courseId],
    queryFn: async () => {
      if (!courseId) return null;

      const course = courseDatabase.getCourseById(courseId);
      if (!course) return null;

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Mock weather data
      return {
        courseId,
        current: {
          temperature: Math.floor(Math.random() * 30) + 60, // 60-90°F
          condition: ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
          windSpeed: Math.floor(Math.random() * 20) + 5, // 5-25 mph
          windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
          humidity: Math.floor(Math.random() * 40) + 40, // 40-80%
          uvIndex: Math.floor(Math.random() * 10) + 1 // 1-10
        },
        forecast: Array.from({ length: 5 }, (_, i) => ({
          date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          high: Math.floor(Math.random() * 30) + 65,
          low: Math.floor(Math.random() * 20) + 45,
          condition: ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
          precipitationChance: Math.floor(Math.random() * 50)
        }))
      };
    },
    enabled: !!courseId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}