import React, { useState, useMemo } from 'react';
import { Search, MapPin, Star, Calendar, Tag, Plus, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublicCourses } from '@/hooks/useDiscoverCourses';
import { useGolfCourses } from '@/hooks/useGolfCourses';
import { useAuthor } from '@/hooks/useAuthor';
import { type GolfCourse } from '@/hooks/useGolfCourses';
import { genUserName } from '@/lib/genUserName';

interface CourseSearchProps {
  onSelectCourse: (course: GolfCourse) => void;
  selectedCourse?: GolfCourse;
  className?: string;
  onCreateCourse?: () => void;
}

export function CourseSearch({ onSelectCourse, selectedCourse, className, onCreateCourse }: CourseSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'my-courses' | 'search'>('my-courses');

  // Get user's own courses
  const { data: myCourses, isLoading: loadingMyCourses } = useGolfCourses();

  // Search public courses
  const { data: publicCourses, isLoading: loadingPublic } = usePublicCourses(
    activeTab === 'search' ? searchTerm : undefined
  );

  // Filter and combine courses based on active tab
  const displayCourses = useMemo(() => {
    switch (activeTab) {
      case 'my-courses':
        if (!myCourses) return [];
        return myCourses;
      
      case 'search':
        return publicCourses || [];
      
      default:
        return [];
    }
  }, [activeTab, myCourses, publicCourses]);



  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Course Categories Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'my-courses' | 'search')}>
          <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my-courses" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Saved Courses
              </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-courses" className="space-y-4">
            <CourseList
              courses={displayCourses}
              loading={loadingMyCourses}
              onSelectCourse={onSelectCourse}
              selectedCourse={selectedCourse}
              emptyMessage="No courses found. Create your first course!"
              showAuthor={false}
            />
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => onCreateCourse?.()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1 text-sm text-gray-900 hover:opacity-95"
              >
                <Plus className="h-4 w-4" />
                Create New Course
              </button>
            </div>
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search golf courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <CourseList
              courses={displayCourses}
              loading={loadingPublic}
              onSelectCourse={onSelectCourse}
              selectedCourse={selectedCourse}
              emptyMessage="No public courses found. Try a different search term."
              showAuthor={true}
            />
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => onCreateCourse?.()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1 text-sm text-gray-900 hover:opacity-95"
              >
                <Plus className="h-4 w-4" />
                Create New Course
              </button>
            </div>
          </TabsContent>
        </Tabs>
        <p className="mt-2 text-xs text-muted-foreground">Note: Course data is crowdsourced — verify details before relying on them.</p>
      </div>
    </div>
  );
}

interface CourseListProps {
  courses: GolfCourse[];
  loading: boolean;
  onSelectCourse: (course: GolfCourse) => void;
  selectedCourse?: GolfCourse;
  emptyMessage: string;
  showAuthor: boolean;
}

function CourseList({ courses, loading, onSelectCourse, selectedCourse, emptyMessage, showAuthor }: CourseListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {courses.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          isSelected={selectedCourse?.id === course.id}
          onSelect={() => onSelectCourse(course)}
          showAuthor={showAuthor}
        />
      ))}
    </div>
  );
}

interface CourseCardProps {
  course: GolfCourse;
  isSelected: boolean;
  onSelect: () => void;
  showAuthor: boolean;
}

function CourseCard({ course, isSelected, onSelect, showAuthor }: CourseCardProps) {
  const { data: authorData } = useAuthor(course.author || '');
  const authorName = authorData?.metadata?.name || 
                    authorData?.metadata?.display_name || 
                    (course.author ? genUserName(course.author) : 'Unknown');

  const holeCount = Object.keys(course.holes).length;
  const totalPar = Object.values(course.holes).reduce((sum, par) => sum + par, 0);

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{course.name}</h3>
              <div className="flex items-center gap-1 text-muted-foreground text-sm">
                <MapPin className="h-3 w-3" />
                {course.location}
              </div>
              {course.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {course.description}
                </p>
              )}
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div>{holeCount} holes</div>
              <div>Par {totalPar}</div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {course.tags?.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Tag className="h-2 w-2 mr-1" />
                  {tag}
                </Badge>
              ))}
              {course.sections && Object.keys(course.sections).length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {Object.keys(course.sections).length} sections
                </Badge>
              )}
              {course.tees && course.tees.length > 0 && (
                <div className="flex items-center gap-1">
                  {course.tees.map(t => (
                    <Badge key={`${t.name}-${t.yardage}`} variant="secondary" className="text-xs">
                      {t.name} {t.yardage}yd
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {showAuthor && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {authorName}
                {course.createdAt && (
                  <>
                    <Calendar className="h-3 w-3 ml-1" />
                    {new Date(course.createdAt).toLocaleDateString()}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}