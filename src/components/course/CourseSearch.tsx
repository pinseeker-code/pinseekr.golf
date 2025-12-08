// Legacy CourseSearch component - redirects to new CourseSelection
import React from 'react';
import { CourseSelection } from '@/components/golf/CourseSelection';
import { type GolfCourse } from '@/hooks/useGolfCourses';

interface CourseSearchProps {
  onSelectCourse?: (courseId: string, courseName: string, courseLocation: string) => void;
  selectedCourse?: { id: string; name: string; location: string } | null;
  className?: string;
}

export const CourseSearch: React.FC<CourseSearchProps> = ({
  onSelectCourse,
  selectedCourse,
  className = ''
}) => {
  // Convert legacy props to new CourseSelection format
  const convertedSelectedCourse: GolfCourse | null = selectedCourse ? {
    id: selectedCourse.id,
    name: selectedCourse.name,
    location: selectedCourse.location,
    holes: Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, 4])), // Default par 4s
    totalPar: 72,
    author: '',
    createdAt: Date.now(),
  } : null;

  const handleSelectCourse = (course: GolfCourse) => {
    if (onSelectCourse) {
      onSelectCourse(course.id, course.name, course.location);
    }
  };

  return (
    <CourseSelection
      selectedCourse={convertedSelectedCourse || undefined}
      onSelectCourse={handleSelectCourse}
      className={className}
    />
  );
};