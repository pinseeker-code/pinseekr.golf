import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useCourse, useCourseWeather, useCourseTimes, useFavoriteCourses } from '@/hooks/useCourseDatabase';
import { DIFFICULTY_LEVELS } from '@/lib/golf/courseTypes';
import {
  MapPin,
  Star,
  Heart,
  Phone,
  Globe,
  Calendar,
  Clock,
  Thermometer,
  Wind,
  Droplets,
  Sun,
  DollarSign,
  Users,
  Car,
  Utensils
} from 'lucide-react';

interface CourseDetailProps {
  courseId: string;
  onBookTeeTime?: (slotId: string) => void;
  onSelectForRound?: (courseId: string, courseName: string) => void;
  className?: string;
}

export const CourseDetail: React.FC<CourseDetailProps> = ({
  courseId,
  onBookTeeTime,
  onSelectForRound,
  className = ''
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: course, isLoading: courseLoading, error: courseError } = useCourse(courseId);
  const { data: weather, isLoading: _weatherLoading } = useCourseWeather(courseId);
  const { data: teeTimes, isLoading: timesLoading } = useCourseTimes(courseId, selectedDate);
  const { isFavorite, addFavorite, removeFavorite } = useFavoriteCourses();

  const toggleFavorite = () => {
    if (isFavorite(courseId)) {
      removeFavorite(courseId);
    } else {
      addFavorite(courseId);
    }
  };

  if (courseLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-8 w-3/4 mb-4" />
            <Skeleton className="h-4 w-1/2 mb-6" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (courseError || !course) {
    return (
      <Card className={`border-red-200 bg-red-50 dark:bg-red-950 ${className}`}>
        <CardContent className="p-6 text-center">
          <p className="text-red-600 dark:text-red-400">
            Course not found or error loading course details.
          </p>
        </CardContent>
      </Card>
    );
  }

  const amenityIcons = {
    'practice-range': <Star className="h-4 w-4" />,
    'putting-green': <Star className="h-4 w-4" />,
    'chipping-green': <Star className="h-4 w-4" />,
    'pro-shop': <Star className="h-4 w-4" />,
    'restaurant': <Utensils className="h-4 w-4" />,
    'bar': <Utensils className="h-4 w-4" />,
    'cart-rental': <Car className="h-4 w-4" />,
    'club-rental': <Star className="h-4 w-4" />,
    'lessons': <Users className="h-4 w-4" />,
    'locker-room': <Star className="h-4 w-4" />,
    'parking': <Car className="h-4 w-4" />,
    'wifi': <Star className="h-4 w-4" />,
    'caddie-service': <Users className="h-4 w-4" />,
    'tournament-facilities': <Star className="h-4 w-4" />
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-3xl mb-2">{course.name}</CardTitle>
              <CardDescription className="flex items-center space-x-4 text-lg">
                <div className="flex items-center space-x-1">
                  <MapPin className="h-4 w-4" />
                  <span>{course.location.city}, {course.location.state}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  <span className="font-medium">{course.rating}</span>
                  <span>({course.reviewCount} reviews)</span>
                </div>
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={toggleFavorite}
                className="text-red-500 hover:text-red-600"
              >
                <Heart className={`h-4 w-4 mr-2 ${isFavorite(courseId) ? 'fill-current' : ''}`} />
                {isFavorite(courseId) ? 'Favorited' : 'Add to Favorites'}
              </Button>
              {onSelectForRound && (
                <Button onClick={() => onSelectForRound(courseId, course.name)}>
                  Select for Round
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {course.description && (
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">{course.description}</p>
          </CardContent>
        )}
      </Card>

      {/* Quick Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{course.holes.length}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Holes</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{course.metadata.layout}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Layout</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 capitalize">{course.metadata.courseType}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Type</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{DIFFICULTY_LEVELS[course.metadata.difficulty].name}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Difficulty</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{course.metadata.priceRange}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Price Range</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600 capitalize">{course.metadata.style}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Style</div>
          </CardContent>
        </Card>
      </div>

      {/* Weather Card */}
      {weather && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Thermometer className="h-5 w-5" />
              <span>Current Weather</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{weather.current.temperature}°F</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{weather.current.condition}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1">
                  <Wind className="h-4 w-4" />
                  <span className="font-bold">{weather.current.windSpeed} mph</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{weather.current.windDirection}</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1">
                  <Droplets className="h-4 w-4" />
                  <span className="font-bold">{weather.current.humidity}%</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Humidity</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1">
                  <Sun className="h-4 w-4" />
                  <span className="font-bold">{weather.current.uvIndex}</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">UV Index</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="holes">Course Layout</TabsTrigger>
          <TabsTrigger value="teetimes">Tee Times</TabsTrigger>
          <TabsTrigger value="amenities">Amenities</TabsTrigger>
          <TabsTrigger value="contact">Contact</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Tee Boxes */}
          <Card>
            <CardHeader>
              <CardTitle>Tee Box Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {course.teeBoxes.map((tee) => (
                  <div key={tee.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{tee.name}</h4>
                      <Badge style={{ backgroundColor: tee.color.toLowerCase(), color: 'white' }}>
                        {tee.color}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Distance:</span>
                        <span className="ml-2 font-medium">{tee.totalDistance} yards</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Par:</span>
                        <span className="ml-2 font-medium">{tee.totalPar}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Rating:</span>
                        <span className="ml-2 font-medium">{tee.courseRating}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Slope:</span>
                        <span className="ml-2 font-medium">{tee.slopeRating}</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Badge variant="outline" className="capitalize">
                        {tee.difficulty}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Course Details */}
          <Card>
            <CardHeader>
              <CardTitle>Course Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {course.metadata.architect && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Architect:</span>
                    <span className="ml-2 font-medium">{course.metadata.architect}</span>
                  </div>
                )}
                {course.metadata.yearBuilt && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Year Built:</span>
                    <span className="ml-2 font-medium">{course.metadata.yearBuilt}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Greens:</span>
                  <span className="ml-2 font-medium capitalize">{course.metadata.greensType}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Fairways:</span>
                  <span className="ml-2 font-medium capitalize">{course.metadata.fairwaysType}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Maintenance:</span>
                  <span className="ml-2 font-medium capitalize">{course.metadata.maintenance}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Dress Code:</span>
                  <span className="ml-2 font-medium capitalize">{course.metadata.dressCode.replace('-', ' ')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Course Layout Tab */}
        <TabsContent value="holes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hole-by-Hole Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Hole</th>
                      <th className="text-center p-2">Par</th>
                      <th className="text-center p-2">Handicap</th>
                      {course.teeBoxes.map((tee) => (
                        <th key={tee.id} className="text-center p-2">{tee.name}</th>
                      ))}
                      <th className="text-left p-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {course.holes.map((hole) => (
                      <tr key={hole.number} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-2 font-medium">{hole.number}</td>
                        <td className="p-2 text-center">{hole.par}</td>
                        <td className="p-2 text-center">{hole.handicap}</td>
                        {course.teeBoxes.map((tee) => (
                          <td key={tee.id} className="p-2 text-center">
                            {hole.distances[tee.id] || '-'}
                          </td>
                        ))}
                        <td className="p-2 text-sm text-gray-600 dark:text-gray-400">
                          {hole.description}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="border-b-2 font-semibold bg-gray-100 dark:bg-gray-800">
                      <td className="p-2">Total</td>
                      <td className="p-2 text-center">
                        {course.holes.reduce((sum, hole) => sum + hole.par, 0)}
                      </td>
                      <td className="p-2 text-center">-</td>
                      {course.teeBoxes.map((tee) => (
                        <td key={tee.id} className="p-2 text-center">{tee.totalDistance}</td>
                      ))}
                      <td className="p-2">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tee Times Tab */}
        <TabsContent value="teetimes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Available Tee Times</span>
                </CardTitle>
                <input
                  type="date"
                  value={selectedDate.toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="px-3 py-2 border rounded-md"
                />
              </div>
            </CardHeader>
            <CardContent>
              {timesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : teeTimes && teeTimes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teeTimes.slice(0, 12).map((slot) => (
                    <div key={slot.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium">{slot.time}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-sm">{slot.pricePerPlayer}</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {slot.maxPlayers - slot.currentBookings} spots available
                      </div>
                      {onBookTeeTime && (
                        <Button size="sm" className="w-full" onClick={() => onBookTeeTime(slot.id)}>
                          Book Tee Time
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No available tee times for the selected date
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Amenities Tab */}
        <TabsContent value="amenities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Course Amenities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {course.amenities.map((amenity) => (
                  <div key={amenity.type} className={`flex items-center space-x-3 p-3 rounded-lg ${
                    amenity.available ? 'bg-green-50 dark:bg-green-950 border border-green-200' : 'bg-gray-50 dark:bg-gray-800 border border-gray-200'
                  }`}>
                    <div className={`${amenity.available ? 'text-green-600' : 'text-gray-400'}`}>
                      {amenityIcons[amenity.type] || <Star className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{amenity.name}</div>
                      {amenity.description && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">{amenity.description}</div>
                      )}
                      {amenity.cost && (
                        <div className="text-sm text-green-600 dark:text-green-400">
                          ${amenity.cost} {amenity.currency && amenity.currency !== 'USD' && `(${amenity.currency})`}
                        </div>
                      )}
                    </div>
                    <Badge variant={amenity.available ? 'default' : 'secondary'}>
                      {amenity.available ? 'Available' : 'Not Available'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Address</h4>
                    <div className="text-gray-600 dark:text-gray-400">
                      <div>{course.location.address}</div>
                      <div>{course.location.city}, {course.location.state} {course.location.zipCode}</div>
                      <div>{course.location.country}</div>
                    </div>
                  </div>

                  {course.phone && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center space-x-2">
                        <Phone className="h-4 w-4" />
                        <span>Phone</span>
                      </h4>
                      <a href={`tel:${course.phone}`} className="text-blue-600 hover:underline">
                        {course.phone}
                      </a>
                    </div>
                  )}

                  {course.website && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center space-x-2">
                        <Globe className="h-4 w-4" />
                        <span>Website</span>
                      </h4>
                      <a
                        href={course.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {course.website}
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Booking Information</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Booking Required:</span>
                        <span className="ml-2">{course.metadata.bookingRequired ? 'Yes' : 'No'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Walking Allowed:</span>
                        <span className="ml-2">{course.metadata.walkingAllowed ? 'Yes' : 'No'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Caddie Required:</span>
                        <span className="ml-2">{course.metadata.caddieRequired ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Season Information</h4>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <div>Peak Season: {course.metadata.season.peakMonths.map(m =>
                        new Date(2023, m-1, 1).toLocaleString('default', { month: 'short' })
                      ).join(', ')}</div>
                      {course.metadata.season.closedMonths.length > 0 && (
                        <div>Closed: {course.metadata.season.closedMonths.map(m =>
                          new Date(2023, m-1, 1).toLocaleString('default', { month: 'short' })
                        ).join(', ')}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};