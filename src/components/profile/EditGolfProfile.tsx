import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Save, User, Flag, Search, Calculator, RefreshCw, Plus, X, MapPin } from 'lucide-react';
import { useGolfProfileMutation } from '@/hooks/useGolfProfile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useHandicapCalculation } from '@/hooks/useHandicapCalculation';
import { useDiscoverCourses } from '@/hooks/useDiscoverCourses';
import { HandicapInfoDialog } from '@/components/golf/HandicapInfoDialog';
import type { GolfProfile } from '@/lib/golf/social';

interface EditGolfProfileProps {
  profile?: GolfProfile;
  onSave?: (profile: GolfProfile) => void;
  className?: string;
}

export function EditGolfProfile({ profile, onSave, className }: EditGolfProfileProps) {
  const { user } = useCurrentUser();
  const { createProfile, updateProfile } = useGolfProfileMutation();
  const { data: handicapResult, isLoading: isCalculatingHandicap } = useHandicapCalculation(user?.pubkey);
  
  const [formData, setFormData] = useState({
    handicap: profile?.handicap || 0,
    homeLocation: profile?.homeLocation || '',
    privacyLevel: (profile?.preferences.privacyLevel || 'public') as 'public' | 'friends' | 'private',
    shareScores: profile?.preferences.shareScores ?? true,
    shareAchievements: profile?.preferences.shareAchievements ?? true,
    shareZapsWagers: profile?.preferences.shareZapsWagers ?? false,
    favoriteCourses: profile?.preferences.favoriteCourses || [] as string[],
  });

  // Course search state
  const [courseSearch, setCourseSearch] = useState('');
  const [showCourseSuggestions, setShowCourseSuggestions] = useState(false);
  const courseInputRef = useRef<HTMLInputElement>(null);

  const { data: discoveredCourses } = useDiscoverCourses(
    courseSearch.trim().length >= 2 ? { name: courseSearch, limit: 8 } : {}
  );

  const courseSuggestions = (discoveredCourses ?? []).filter(
    (c) => !formData.favoriteCourses.includes(c.name)
  );
  const showCustomAdd =
    courseSearch.trim().length >= 1 &&
    !formData.favoriteCourses.includes(courseSearch.trim()) &&
    !courseSuggestions.some((c) => c.name.toLowerCase() === courseSearch.trim().toLowerCase());

  const addFavoriteCourse = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !formData.favoriteCourses.includes(trimmed)) {
      setFormData((prev) => ({ ...prev, favoriteCourses: [...prev.favoriteCourses, trimmed] }));
    }
    setCourseSearch('');
    setShowCourseSuggestions(false);
  };

  const removeFavoriteCourse = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      favoriteCourses: prev.favoriteCourses.filter((c) => c !== name),
    }));
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      const profileData = {
        pubkey: user.pubkey,
        handicap: Number(formData.handicap),
        homeLocation: formData.homeLocation,
        homeCourse: formData.favoriteCourses[0] || profile?.homeCourse || '',
        preferences: {
          preferredTees: profile?.preferences.preferredTees || 'white',
          favoriteFormat: profile?.preferences.favoriteFormat || 'stroke-play',
          privacyLevel: formData.privacyLevel,
          shareScores: formData.shareScores,
          shareAchievements: formData.shareAchievements,
          shareZapsWagers: formData.shareZapsWagers,
          favoriteCourses: formData.favoriteCourses,
        },
      };

      let result;
      if (profile) {
        result = await updateProfile({ 
          pubkey: user.pubkey, 
          updates: profileData 
        });
      } else {
        result = await createProfile(profileData);
      }

      if (onSave) {
        onSave(result);
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            Please log in to edit your golf profile.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {profile ? 'Edit Golf Profile' : 'Create Golf Profile'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Basic Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="handicap" className="flex items-center gap-2">
                  Handicap Index
                  <HandicapInfoDialog handicapResult={handicapResult} />
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="handicap"
                    type="number"
                    step="0.1"
                    min="-5"
                    max="54"
                    value={formData.handicap}
                    onChange={(e) => handleInputChange('handicap', parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                    className="flex-1"
                  />
                  {handicapResult && handicapResult.index !== null && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange('handicap', handicapResult.index!)}
                      className="whitespace-nowrap"
                      title="Use calculated handicap"
                    >
                      <Calculator className="h-4 w-4 mr-1" />
                      Use {handicapResult.index.toFixed(1)}
                    </Button>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {isCalculatingHandicap ? (
                    <span className="flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Calculating from your rounds...
                    </span>
                  ) : handicapResult ? (
                    handicapResult.method === 'insufficient' ? (
                      <span>
                        Enter manually or play {handicapResult.minimumRoundsNeeded} more rounds to auto-calculate.
                      </span>
                    ) : (
                      <span>
                        Calculated: <strong>{handicapResult.index?.toFixed(1)}</strong> ({handicapResult.roundsUsed} of {handicapResult.roundsAvailable} rounds used)
                      </span>
                    )
                  ) : (
                    <span>Enter your handicap index manually</span>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="homeLocation">
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location</span>
                </Label>
                <Input
                  id="homeLocation"
                  value={formData.homeLocation}
                  onChange={(e) => handleInputChange('homeLocation', e.target.value)}
                  placeholder="City, State"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Favorite Courses */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Favorite Courses
            </h3>
            <p className="text-xs text-muted-foreground">
              Search for courses on Pinseekr or add any course by name.
            </p>

            {/* Search input with suggestions dropdown */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    ref={courseInputRef}
                    placeholder="Search or type a course name…"
                    value={courseSearch}
                    className="pl-8"
                    onChange={(e) => {
                      setCourseSearch(e.target.value);
                      setShowCourseSuggestions(true);
                    }}
                    onFocus={() => setShowCourseSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowCourseSuggestions(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (courseSearch.trim()) addFavoriteCourse(courseSearch);
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => courseSearch.trim() && addFavoriteCourse(courseSearch)}
                  disabled={!courseSearch.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Suggestions dropdown */}
              {showCourseSuggestions && (courseSuggestions.length > 0 || showCustomAdd) && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-popover border rounded-md shadow-md max-h-52 overflow-y-auto">
                  {courseSuggestions.map((course) => (
                    <button
                      key={course.id}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors"
                      onMouseDown={() => addFavoriteCourse(course.name)}
                    >
                      <Flag className="h-4 w-4 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{course.name}</div>
                        {course.location && (
                          <div className="text-xs text-muted-foreground truncate">{course.location}</div>
                        )}
                      </div>
                    </button>
                  ))}
                  {showCustomAdd && (
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors border-t"
                      onMouseDown={() => addFavoriteCourse(courseSearch)}
                    >
                      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">Add "{courseSearch.trim()}"</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Selected courses chips */}
            {formData.favoriteCourses.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.favoriteCourses.map((course) => (
                  <span
                    key={course}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-muted border font-medium"
                  >
                    <Flag className="h-3 w-3 text-green-600" />
                    {course}
                    <button
                      type="button"
                      className="hover:text-destructive ml-0.5"
                      onClick={() => removeFavoriteCourse(course)}
                      aria-label={`Remove ${course}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Privacy Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Privacy & Sharing</h3>
            
            <div>
              <Label htmlFor="privacyLevel">Profile Visibility</Label>
              <Select 
                value={formData.privacyLevel} 
                onValueChange={(value: 'public' | 'friends' | 'private') => handleInputChange('privacyLevel', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public - Anyone can see</SelectItem>
                  <SelectItem value="friends">Friends Only</SelectItem>
                  <SelectItem value="private">Private - Only me</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="shareScores">Share Scores</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow others to see your round scores
                  </p>
                </div>
                <Switch
                  id="shareScores"
                  checked={formData.shareScores}
                  onCheckedChange={(checked) => handleInputChange('shareScores', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="shareAchievements">Share Achievements</Label>
                  <p className="text-xs text-muted-foreground">
                    Show your badges and achievements
                  </p>
                </div>
                <Switch
                  id="shareAchievements"
                  checked={formData.shareAchievements}
                  onCheckedChange={(checked) => handleInputChange('shareAchievements', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="shareZapsWagers">Share Zaps &amp; Wagers</Label>
                  <p className="text-xs text-muted-foreground">
                    Show lightning payments and wager results
                  </p>
                </div>
                <Switch
                  id="shareZapsWagers"
                  checked={formData.shareZapsWagers}
                  onCheckedChange={(checked) => handleInputChange('shareZapsWagers', checked)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Submit Button */}
          <div className="pt-4">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full sm:w-auto gap-2"
            >
              <Save className="h-4 w-4" />
              {isLoading ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}