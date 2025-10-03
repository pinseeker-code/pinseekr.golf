import {
  GolfCourse,
  CourseSearchFilters,
  CourseSearchResult,
  CourseReview as _CourseReview,
  TeeTimeSlot as _TeeTimeSlot,
  AmenityType,
  COURSE_KINDS as _COURSE_KINDS,
  DistanceUnit
} from './courseTypes';

export class CourseDatabase {
  private courses: Map<string, GolfCourse> = new Map();
  private distanceUnit: DistanceUnit = 'yards';

  constructor(distanceUnit: DistanceUnit = 'yards') {
    this.distanceUnit = distanceUnit;
    this.initializeSampleCourses();
  }

  /**
   * Initialize with sample famous golf courses
   */
  private initializeSampleCourses(): void {
    const sampleCourses: GolfCourse[] = [
      {
        id: 'augusta-national',
        name: 'Augusta National Golf Club',
        location: {
          address: '2604 Washington Rd',
          city: 'Augusta',
          state: 'Georgia',
          country: 'USA',
          zipCode: '30904',
          coordinates: { latitude: 33.5027, longitude: -82.0199 },
          timezone: 'America/New_York'
        },
        website: 'https://www.masters.com',
        description: 'Home of The Masters Tournament, one of the most prestigious golf courses in the world.',
        rating: 5,
        reviewCount: 1250,
        holes: this.generateAugustaNationalHoles(),
        teeBoxes: [
          {
            id: 'masters',
            name: 'Tournament Tees',
            color: 'Gold',
            gender: 'mens',
            difficulty: 'championship',
            totalDistance: 7475,
            courseRating: 76.2,
            slopeRating: 137,
            totalPar: 72
          },
          {
            id: 'member',
            name: 'Member Tees',
            color: 'White',
            gender: 'mens',
            difficulty: 'advanced',
            totalDistance: 6925,
            courseRating: 73.8,
            slopeRating: 131,
            totalPar: 72
          }
        ],
        amenities: [
          { type: AmenityType.PRACTICE_RANGE, name: 'Practice Range', available: true },
          { type: AmenityType.PUTTING_GREEN, name: 'Putting Green', available: true },
          { type: AmenityType.PRO_SHOP, name: 'Pro Shop', available: true },
          { type: AmenityType.RESTAURANT, name: 'Clubhouse Dining', available: true },
          { type: AmenityType.CADDIE_SERVICE, name: 'Caddie Service', available: true },
        ],
        metadata: {
          architect: 'Alister MacKenzie',
          yearBuilt: 1933,
          courseType: 'private',
          style: 'parkland',
          difficulty: 5,
          layout: '18-hole',
          greensType: 'bentgrass',
          fairwaysType: 'bermuda',
          irrigation: true,
          drainage: 'excellent',
          maintenance: 'excellent',
          season: {
            openMonths: [1, 2, 3, 4, 5, 10, 11, 12],
            peakMonths: [3, 4, 5],
            closedMonths: [6, 7, 8, 9]
          },
          priceRange: '$$$$$',
          bookingRequired: true,
          walkingAllowed: true,
          caddieRequired: true,
          dressCode: 'strict'
        },
        images: [
          {
            id: 'augusta-main',
            url: '/images/courses/augusta-national-main.jpg',
            type: 'course-overview',
            title: 'Augusta National Golf Club',
            isPrimary: true
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'pebble-beach',
        name: 'Pebble Beach Golf Links',
        location: {
          address: '1700 17 Mile Dr',
          city: 'Pebble Beach',
          state: 'California',
          country: 'USA',
          zipCode: '93953',
          coordinates: { latitude: 36.5674, longitude: -121.9500 },
          timezone: 'America/Los_Angeles'
        },
        website: 'https://www.pebblebeach.com',
        description: 'Iconic oceanside course with breathtaking views and challenging coastal winds.',
        rating: 4.8,
        reviewCount: 2100,
        holes: this.generatePebbleBeachHoles(),
        teeBoxes: [
          {
            id: 'championship',
            name: 'Championship Tees',
            color: 'Black',
            gender: 'mens',
            difficulty: 'championship',
            totalDistance: 6828,
            courseRating: 75.5,
            slopeRating: 144,
            totalPar: 72
          },
          {
            id: 'resort',
            name: 'Resort Tees',
            color: 'Blue',
            gender: 'mens',
            difficulty: 'advanced',
            totalDistance: 6325,
            courseRating: 72.8,
            slopeRating: 136,
            totalPar: 72
          },
          {
            id: 'forward',
            name: 'Forward Tees',
            color: 'Red',
            gender: 'womens',
            difficulty: 'intermediate',
            totalDistance: 5197,
            courseRating: 70.4,
            slopeRating: 127,
            totalPar: 72
          }
        ],
        amenities: [
          { type: AmenityType.PRACTICE_RANGE, name: 'Driving Range', available: true },
          { type: AmenityType.PUTTING_GREEN, name: 'Putting Green', available: true },
          { type: AmenityType.PRO_SHOP, name: 'Pro Shop', available: true },
          { type: AmenityType.RESTAURANT, name: 'The Lodge Restaurant', available: true },
          { type: AmenityType.BAR, name: 'Tap Room', available: true },
          { type: AmenityType.CART_RENTAL, name: 'Golf Carts', available: true, cost: 65 },
          { type: AmenityType.CADDIE_SERVICE, name: 'Caddie Service', available: true, cost: 125 }
        ],
        metadata: {
          architect: 'Jack Neville & Douglas Grant',
          yearBuilt: 1919,
          courseType: 'resort',
          style: 'links',
          difficulty: 4,
          layout: '18-hole',
          greensType: 'bentgrass',
          fairwaysType: 'rye',
          irrigation: true,
          drainage: 'excellent',
          maintenance: 'excellent',
          season: {
            openMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            peakMonths: [6, 7, 8, 9],
            closedMonths: []
          },
          priceRange: '$$$$$',
          bookingRequired: true,
          walkingAllowed: true,
          caddieRequired: false,
          dressCode: 'golf-attire'
        },
        images: [
          {
            id: 'pebble-main',
            url: '/images/courses/pebble-beach-main.jpg',
            type: 'course-overview',
            title: 'Pebble Beach Golf Links',
            isPrimary: true
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'st-andrews',
        name: 'The Old Course at St. Andrews',
        location: {
          address: 'Pilmour Links',
          city: 'St Andrews',
          state: 'Fife',
          country: 'Scotland',
          zipCode: 'KY16 9SF',
          coordinates: { latitude: 56.3489, longitude: -2.8211 },
          timezone: 'Europe/London'
        },
        website: 'https://www.standrews.com',
        description: 'The Home of Golf - the most famous golf course in the world with over 600 years of history.',
        rating: 4.9,
        reviewCount: 3500,
        holes: this.generateStAndrewsHoles(),
        teeBoxes: [
          {
            id: 'championship',
            name: 'Championship Tees',
            color: 'Gold',
            gender: 'mens',
            difficulty: 'championship',
            totalDistance: 7297,
            courseRating: 75.1,
            slopeRating: 129,
            totalPar: 72
          },
          {
            id: 'medal',
            name: 'Medal Tees',
            color: 'White',
            gender: 'mens',
            difficulty: 'advanced',
            totalDistance: 6721,
            courseRating: 72.1,
            slopeRating: 124,
            totalPar: 72
          }
        ],
        amenities: [
          { type: AmenityType.PRACTICE_RANGE, name: 'Driving Range', available: true },
          { type: AmenityType.PUTTING_GREEN, name: 'Himalayas Putting Course', available: true },
          { type: AmenityType.PRO_SHOP, name: 'Golf Shop', available: true },
          { type: AmenityType.RESTAURANT, name: 'Clubhouse Restaurant', available: true },
          { type: AmenityType.CADDIE_SERVICE, name: 'Caddie Service', available: true }
        ],
        metadata: {
          yearBuilt: 1400,
          courseType: 'public',
          style: 'links',
          difficulty: 4,
          layout: '18-hole',
          greensType: 'bentgrass',
          fairwaysType: 'mixed',
          irrigation: false,
          drainage: 'excellent',
          maintenance: 'excellent',
          season: {
            openMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            peakMonths: [5, 6, 7, 8, 9],
            closedMonths: []
          },
          priceRange: '$$$$',
          bookingRequired: true,
          walkingAllowed: true,
          caddieRequired: false,
          dressCode: 'golf-attire'
        },
        images: [
          {
            id: 'standrews-main',
            url: '/images/courses/st-andrews-main.jpg',
            type: 'course-overview',
            title: 'The Old Course at St. Andrews',
            isPrimary: true
          }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    sampleCourses.forEach(course => {
      this.courses.set(course.id, course);
    });
  }

  /**
   * Search for golf courses
   */
  searchCourses(filters: CourseSearchFilters): CourseSearchResult[] {
    let results = Array.from(this.courses.values());

    // Apply location filter
    if (filters.location) {
      results = results.filter(course => {
        const distance = this.calculateDistance(
          filters.location!.center,
          course.location.coordinates
        );
        return distance <= filters.location!.radius;
      }).map(course => ({
        ...course,
        distance: this.calculateDistance(
          filters.location!.center,
          course.location.coordinates
        ),
        holeCount: course.holes.length
      }));
    } else {
      results = results.map(course => ({
        ...course,
        holeCount: course.holes.length
      }));
    }

    // Apply other filters
    if (filters.priceRange?.length) {
      results = results.filter(course =>
        filters.priceRange!.includes(course.metadata.priceRange)
      );
    }

    if (filters.courseType?.length) {
      results = results.filter(course =>
        filters.courseType!.includes(course.metadata.courseType)
      );
    }

    if (filters.difficulty?.length) {
      results = results.filter(course =>
        filters.difficulty!.includes(course.metadata.difficulty)
      );
    }

    if (filters.amenities?.length) {
      results = results.filter(course =>
        filters.amenities!.every(amenity =>
          course.amenities.some(a => a.type === amenity && a.available)
        )
      );
    }

    if (filters.rating) {
      results = results.filter(course => course.rating >= filters.rating!);
    }

    if (filters.holes?.length) {
      results = results.filter(course =>
        filters.holes!.includes(course.metadata.layout)
      );
    }

    // Sort by distance if location provided, otherwise by rating
    if (filters.location) {
      // For demo purposes, we'll add a random distance for sorting
      results.forEach(course => {
        (course as GolfCourse & { distance?: number }).distance = Math.random() * 50;
      });
      results.sort((a, b) => ((a as GolfCourse & { distance?: number }).distance || 0) - ((b as GolfCourse & { distance?: number }).distance || 0));
    } else {
      results.sort((a, b) => b.rating - a.rating);
    }

    // Convert to CourseSearchResult format
    return results.map(course => ({
      ...course,
      holeCount: course.holes.length,
      distance: (course as GolfCourse & { distance?: number }).distance
    }));
  }

  /**
   * Get course by ID
   */
  getCourseById(id: string): GolfCourse | undefined {
    return this.courses.get(id);
  }

  /**
   * Get all courses
   */
  getAllCourses(): GolfCourse[] {
    return Array.from(this.courses.values());
  }

  /**
   * Add a new course
   */
  addCourse(course: GolfCourse): void {
    this.courses.set(course.id, course);
  }

  /**
   * Update course information
   */
  updateCourse(id: string, updates: Partial<GolfCourse>): boolean {
    const course = this.courses.get(id);
    if (!course) return false;

    const updatedCourse = { ...course, ...updates, updatedAt: Date.now() };
    this.courses.set(id, updatedCourse);
    return true;
  }

  /**
   * Delete a course
   */
  deleteCourse(id: string): boolean {
    return this.courses.delete(id);
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLon = this.toRad(point2.longitude - point1.longitude);

    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(point1.latitude)) * Math.cos(this.toRad(point2.latitude)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Generate famous hole layouts
   */
  private generateAugustaNationalHoles() {
    return [
      { number: 1, par: 4, handicap: 10, distances: { masters: 445, member: 435 }, description: "Tea Olive - Slight dogleg right" },
      { number: 2, par: 5, handicap: 16, distances: { masters: 575, member: 565 }, description: "Pink Dogwood - Reachable par 5" },
      { number: 3, par: 4, handicap: 4, distances: { masters: 350, member: 340 }, description: "Flowering Peach - Downhill approach" },
      { number: 4, par: 3, handicap: 14, distances: { masters: 240, member: 220 }, description: "Flowering Crab Apple - Long par 3" },
      { number: 5, par: 4, handicap: 6, distances: { masters: 495, member: 485 }, description: "Magnolia - Uphill dogleg left" },
      { number: 6, par: 3, handicap: 12, distances: { masters: 180, member: 170 }, description: "Juniper - Downhill par 3" },
      { number: 7, par: 4, handicap: 2, distances: { masters: 450, member: 440 }, description: "Pampas - Downhill tee shot" },
      { number: 8, par: 5, handicap: 18, distances: { masters: 570, member: 560 }, description: "Yellow Jasmine - Uphill par 5" },
      { number: 9, par: 4, handicap: 8, distances: { masters: 460, member: 450 }, description: "Carolina Cherry - Uphill finish" },
      { number: 10, par: 4, handicap: 9, distances: { masters: 495, member: 485 }, description: "Camellia - Sharp dogleg left" },
      { number: 11, par: 4, handicap: 5, distances: { masters: 520, member: 510 }, description: "White Dogwood - Water guards green" },
      { number: 12, par: 3, handicap: 15, distances: { masters: 155, member: 145 }, description: "Golden Bell - Swirling winds" },
      { number: 13, par: 5, handicap: 1, distances: { masters: 510, member: 500 }, description: "Azalea - Amen Corner finale" },
      { number: 14, par: 4, handicap: 11, distances: { masters: 440, member: 430 }, description: "Chinese Fir - Slight uphill" },
      { number: 15, par: 5, handicap: 3, distances: { masters: 550, member: 540 }, description: "Firethorn - Water carry to green" },
      { number: 16, par: 3, handicap: 13, distances: { masters: 170, member: 160 }, description: "Redbud - Dramatic water hole" },
      { number: 17, par: 4, handicap: 7, distances: { masters: 440, member: 430 }, description: "Nandina - Eisenhower Tree" },
      { number: 18, par: 4, handicap: 17, distances: { masters: 465, member: 455 }, description: "Holly - Uphill to clubhouse" }
    ];
  }

  private generatePebbleBeachHoles() {
    return [
      { number: 1, par: 4, handicap: 13, distances: { championship: 373, resort: 350 }, description: "Opening hole along Carmel Bay" },
      { number: 2, par: 4, handicap: 15, distances: { championship: 502, resort: 480 }, description: "Slight dogleg right" },
      { number: 3, par: 4, handicap: 11, distances: { championship: 390, resort: 370 }, description: "Short par 4 with ocean views" },
      { number: 4, par: 4, handicap: 5, distances: { championship: 331, resort: 310 }, description: "Dramatic coastline hole" },
      { number: 5, par: 3, handicap: 17, distances: { championship: 188, resort: 170 }, description: "Uphill par 3" },
      { number: 6, par: 5, handicap: 1, distances: { championship: 523, resort: 500 }, description: "Long par 5 inland" },
      { number: 7, par: 3, handicap: 9, distances: { championship: 106, resort: 95 }, description: "Short but tricky" },
      { number: 8, par: 4, handicap: 3, distances: { championship: 418, resort: 400 }, description: "Oceanside challenge" },
      { number: 9, par: 4, handicap: 7, distances: { championship: 464, resort: 440 }, description: "Finishing the front nine" },
      { number: 10, par: 4, handicap: 12, distances: { championship: 446, resort: 425 }, description: "Start of Pebble's back nine" },
      { number: 11, par: 4, handicap: 16, distances: { championship: 384, resort: 365 }, description: "Shorter par 4" },
      { number: 12, par: 3, handicap: 18, distances: { championship: 202, resort: 180 }, description: "Elevated par 3" },
      { number: 13, par: 4, handicap: 14, distances: { championship: 399, resort: 380 }, description: "Dogleg left" },
      { number: 14, par: 5, handicap: 4, distances: { championship: 580, resort: 560 }, description: "Long par 5" },
      { number: 15, par: 4, handicap: 10, distances: { championship: 397, resort: 375 }, description: "Approaching the ocean holes" },
      { number: 16, par: 4, handicap: 8, distances: { championship: 402, resort: 385 }, description: "Dramatic ocean hole" },
      { number: 17, par: 3, handicap: 6, distances: { championship: 178, resort: 160 }, description: "Most photographed hole in golf" },
      { number: 18, par: 5, handicap: 2, distances: { championship: 548, resort: 525 }, description: "Legendary finishing hole" }
    ];
  }

  private generateStAndrewsHoles() {
    return [
      { number: 1, par: 4, handicap: 12, distances: { championship: 376, medal: 356 }, description: "Burn - Opening drive over Swilcan Burn" },
      { number: 2, par: 4, handicap: 14, distances: { championship: 453, medal: 433 }, description: "Dyke - Long par 4" },
      { number: 3, par: 4, handicap: 10, distances: { championship: 397, medal: 377 }, description: "Cartgate (Out) - Shared green" },
      { number: 4, par: 4, handicap: 4, distances: { championship: 480, medal: 460 }, description: "Ginger Beer - Challenging hole" },
      { number: 5, par: 5, handicap: 16, distances: { championship: 568, medal: 548 }, description: "Hole O'Cross (Out) - Reachable par 5" },
      { number: 6, par: 4, handicap: 6, distances: { championship: 412, medal: 392 }, description: "Heathery (Out) - Blind tee shot" },
      { number: 7, par: 4, handicap: 2, distances: { championship: 359, medal: 339 }, description: "High (Out) - Shell bunker guards" },
      { number: 8, par: 3, handicap: 18, distances: { championship: 175, medal: 155 }, description: "Short - Shortest hole" },
      { number: 9, par: 4, handicap: 8, distances: { championship: 352, medal: 332 }, description: "End - Turning for home" },
      { number: 10, par: 4, handicap: 17, distances: { championship: 380, medal: 360 }, description: "Bobby Jones - Shared fairway" },
      { number: 11, par: 3, handicap: 1, distances: { championship: 174, medal: 154 }, description: "High (In) - Strath bunker" },
      { number: 12, par: 4, handicap: 3, distances: { championship: 348, medal: 328 }, description: "Heathery (In) - Shared green" },
      { number: 13, par: 4, handicap: 7, distances: { championship: 465, medal: 445 }, description: "Hole O'Cross (In) - Coffins await" },
      { number: 14, par: 5, handicap: 9, distances: { championship: 614, medal: 594 }, description: "Long - Longest hole" },
      { number: 15, par: 4, handicap: 13, distances: { championship: 456, medal: 436 }, description: "Cartgate (In) - Shared green" },
      { number: 16, par: 4, handicap: 11, distances: { championship: 423, medal: 403 }, description: "Corner of the Dyke - Railroad sheds" },
      { number: 17, par: 4, handicap: 5, distances: { championship: 455, medal: 435 }, description: "Road Hole - Most famous hole" },
      { number: 18, par: 4, handicap: 15, distances: { championship: 357, medal: 337 }, description: "Tom Morris - Swilcan Bridge finish" }
    ];
  }
}