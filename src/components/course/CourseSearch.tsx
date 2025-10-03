import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { useCourseSearch, useFavoriteCourses } from '@/hooks/useCourseDatabase';
import { CourseSearchFilters, AmenityType, DIFFICULTY_LEVELS } from '@/lib/golf/courseTypes';
import { MapPin, Star, Heart, Search, Filter, Route, DollarSign } from 'lucide-react';

interface CourseSearchProps {
  onSelectCourse?: (courseId: string, courseName: string, courseLocation: string) => void;
  selectedCourse?: { id: string; name: string; location: string } | null;
  className?: string;
}

export const CourseSearch: React.FC<CourseSearchProps> = ({
  onSelectCourse,
  selectedCourse: _selectedCourse,
  className = ''
}) => {
  const [filters, setFilters] = useState<CourseSearchFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radiusValue, setRadiusValue] = useState([25]);

  const { data: searchResults, isLoading, error } = useCourseSearch(filters);
  const { isFavorite, addFavorite, removeFavorite } = useFavoriteCourses();

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.log('Location access denied:', error);
        }
      );
    }
  }, []);

  const handleLocationSearch = () => {
    if (userLocation) {
      setFilters(prev => ({
        ...prev,
        location: {
          center: userLocation,
          radius: radiusValue[0]
        }
      }));
    }
  };

  const handleFilterChange = (key: keyof CourseSearchFilters, value: unknown) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleAmenityToggle = (amenity: AmenityType, checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      amenities: checked
        ? [...(prev.amenities || []), amenity]
        : (prev.amenities || []).filter(a => a !== amenity)
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    setRadiusValue([25]);
  };

  const toggleFavorite = (courseId: string) => {
    if (isFavorite(courseId)) {
      removeFavorite(courseId);
    } else {
      addFavorite(courseId);
    }
  };

  const filteredResults = searchResults?.filter(course =>
    !searchQuery ||
    course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.location.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    course.location.state.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Find Golf Courses</span>
          </CardTitle>
          <CardDescription>
            Discover amazing golf courses near you or anywhere in the world
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="flex space-x-2">
            <div className="flex-1">
              <Input
                placeholder="Search by course name, city, or state..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </Button>
          </div>

          {/* Location Search */}
          {userLocation && (
            <div className="flex items-center space-x-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <MapPin className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <Label>Search within {radiusValue[0]} miles of your location</Label>
                <Slider
                  value={radiusValue}
                  onValueChange={setRadiusValue}
                  max={100}
                  min={5}
                  step={5}
                  className="mt-2"
                />
              </div>
              <Button onClick={handleLocationSearch} variant="outline">
                <Route className="h-4 w-4 mr-2" />
                Search Nearby
              </Button>
            </div>
          )}

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              {/* Course Type */}
              <div className="space-y-2">
                <Label>Course Type</Label>
                <Select onValueChange={(value) => handleFilterChange('courseType', value ? [value] : [])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any type</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="semi-private">Semi-Private</SelectItem>
                    <SelectItem value="resort">Resort</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range */}
              <div className="space-y-2">
                <Label>Price Range</Label>
                <Select onValueChange={(value) => handleFilterChange('priceRange', value ? [value] : [])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any price" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any price</SelectItem>
                    <SelectItem value="$">$ - Budget</SelectItem>
                    <SelectItem value="$$">$$ - Moderate</SelectItem>
                    <SelectItem value="$$$">$$$ - Upscale</SelectItem>
                    <SelectItem value="$$$$">$$$$ - Luxury</SelectItem>
                    <SelectItem value="$$$$$">$$$$$ - Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select onValueChange={(value) => handleFilterChange('difficulty', value ? [parseInt(value)] : [])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any difficulty</SelectItem>
                    {Object.entries(DIFFICULTY_LEVELS).map(([level, info]) => (
                      <SelectItem key={level} value={level}>
                        {info.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Minimum Rating */}
              <div className="space-y-2">
                <Label>Minimum Rating</Label>
                <Select onValueChange={(value) => handleFilterChange('rating', value ? parseFloat(value) : undefined)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any rating</SelectItem>
                    <SelectItem value="4.5">4.5+ stars</SelectItem>
                    <SelectItem value="4.0">4.0+ stars</SelectItem>
                    <SelectItem value="3.5">3.5+ stars</SelectItem>
                    <SelectItem value="3.0">3.0+ stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Holes */}
              <div className="space-y-2">
                <Label>Number of Holes</Label>
                <Select onValueChange={(value) => handleFilterChange('holes', value ? [value] : [])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    <SelectItem value="9-hole">9 Holes</SelectItem>
                    <SelectItem value="18-hole">18 Holes</SelectItem>
                    <SelectItem value="27-hole">27 Holes</SelectItem>
                    <SelectItem value="36-hole">36 Holes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>

              {/* Amenities */}
              <div className="md:col-span-2 lg:col-span-3 space-y-2">
                <Label>Amenities</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.values(AmenityType).slice(0, 8).map((amenity) => (
                    <div key={amenity} className="flex items-center space-x-2">
                      <Checkbox
                        id={amenity}
                        checked={(filters.amenities || []).includes(amenity)}
                        onCheckedChange={(checked) => handleAmenityToggle(amenity, checked as boolean)}
                      />
                      <Label htmlFor={amenity} className="text-sm capitalize">
                        {amenity.replace('-', ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      <div className="space-y-4">
        {/* Results Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {isLoading ? 'Searching...' : `${filteredResults.length} courses found`}
            </h3>
            {filters.location && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Within {radiusValue[0]} miles of your location
              </p>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-4" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950">
            <CardContent className="p-4 text-center">
              <p className="text-red-600 dark:text-red-400">
                Error searching courses. Please try again.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results Grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResults.map((course) => (
              <Card key={course.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-1">{course.name}</CardTitle>
                      <CardDescription className="flex items-center space-x-1">
                        <MapPin className="h-3 w-3" />
                        <span>{course.location.city}, {course.location.state}</span>
                        {course.distance && (
                          <span className="text-blue-600">
                            • {course.distance.toFixed(1)} mi
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(course.id);
                      }}
                      className="text-red-500 hover:text-red-600"
                    >
                      <Heart className={`h-4 w-4 ${isFavorite(course.id) ? 'fill-current' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Rating and Reviews */}
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="font-medium">{course.rating}</span>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      ({course.reviewCount} reviews)
                    </span>
                  </div>

                  {/* Course Info */}
                  <div className="flex items-center space-x-4 text-sm">
                    <Badge variant="outline">
                      {course.holeCount} holes
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {course.metadata.courseType}
                    </Badge>
                    <div className="flex items-center space-x-1">
                      <DollarSign className="h-3 w-3" />
                      <span>{course.metadata.priceRange}</span>
                    </div>
                  </div>

                  {/* Difficulty */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Difficulty:</span>
                    <Badge className={`bg-${DIFFICULTY_LEVELS[course.metadata.difficulty].color}-100 text-${DIFFICULTY_LEVELS[course.metadata.difficulty].color}-800`}>
                      {DIFFICULTY_LEVELS[course.metadata.difficulty].name}
                    </Badge>
                  </div>

                  {/* Course Description */}
                  {course.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {course.description}
                    </p>
                  )}

                  {/* Select Button */}
                  {onSelectCourse && (
                    <Button
                      className="w-full"
                      onClick={() => onSelectCourse(course.id, course.name, `${course.location.city}, ${course.location.state}`)}
                    >
                      Select Course
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredResults.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No courses found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Try adjusting your search criteria or filters
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};