import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Save, User, Home, Settings } from 'lucide-react';
import { useGolfProfileMutation } from '@/hooks/useGolfProfile';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { GolfProfile } from '@/lib/golf/social';

interface EditGolfProfileProps {
  profile?: GolfProfile;
  onSave?: (profile: GolfProfile) => void;
  className?: string;
}

export function EditGolfProfile({ profile, onSave, className }: EditGolfProfileProps) {
  const { user } = useCurrentUser();
  const { createProfile, updateProfile } = useGolfProfileMutation();
  
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    displayName: profile?.displayName || '',
    bio: profile?.bio || '',
    handicap: profile?.handicap || 0,
    homeCourse: profile?.homeCourse || '',
    homeLocation: profile?.homeLocation || '',
    preferredTees: profile?.preferences.preferredTees || 'white',
    favoriteFormat: profile?.preferences.favoriteFormat || 'stroke-play',
    privacyLevel: profile?.preferences.privacyLevel || 'public' as const,
    shareScores: profile?.preferences.shareScores ?? true,
    shareAchievements: profile?.preferences.shareAchievements ?? true,
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      const profileData = {
        pubkey: user.pubkey,
        name: formData.name,
        displayName: formData.displayName,
        bio: formData.bio,
        handicap: Number(formData.handicap),
        homeCourse: formData.homeCourse,
        homeLocation: formData.homeLocation,
        preferences: {
          preferredTees: formData.preferredTees,
          favoriteFormat: formData.favoriteFormat,
          privacyLevel: formData.privacyLevel,
          shareScores: formData.shareScores,
          shareAchievements: formData.shareAchievements,
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
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  placeholder="How others see you"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Tell us about your golf journey..."
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="handicap">Handicap Index</Label>
              <Input
                id="handicap"
                type="number"
                step="0.1"
                min="-5"
                max="54"
                value={formData.handicap}
                onChange={(e) => handleInputChange('handicap', parseFloat(e.target.value) || 0)}
                placeholder="0.0"
              />
            </div>
          </div>

          <Separator />

          {/* Course & Location */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Home className="h-4 w-4" />
              Course & Location
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="homeCourse">Home Course</Label>
                <Input
                  id="homeCourse"
                  value={formData.homeCourse}
                  onChange={(e) => handleInputChange('homeCourse', e.target.value)}
                  placeholder="Your regular course"
                />
              </div>
              <div>
                <Label htmlFor="homeLocation">Location</Label>
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

          {/* Playing Preferences */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Playing Preferences
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preferredTees">Preferred Tees</Label>
                <Select 
                  value={formData.preferredTees} 
                  onValueChange={(value) => handleInputChange('preferredTees', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="forward">Forward Tees</SelectItem>
                    <SelectItem value="red">Red Tees</SelectItem>
                    <SelectItem value="white">White Tees</SelectItem>
                    <SelectItem value="blue">Blue Tees</SelectItem>
                    <SelectItem value="black">Black Tees</SelectItem>
                    <SelectItem value="tips">Tips</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="favoriteFormat">Favorite Format</Label>
                <Select 
                  value={formData.favoriteFormat} 
                  onValueChange={(value) => handleInputChange('favoriteFormat', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stroke-play">Stroke Play</SelectItem>
                    <SelectItem value="match-play">Match Play</SelectItem>
                    <SelectItem value="best-ball">Best Ball</SelectItem>
                    <SelectItem value="scramble">Scramble</SelectItem>
                    <SelectItem value="nassau">Nassau</SelectItem>
                    <SelectItem value="skins">Skins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
            </div>
          </div>

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