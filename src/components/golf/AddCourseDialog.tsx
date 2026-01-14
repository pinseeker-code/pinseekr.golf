import { useForm } from "react-hook-form";
import { useEffect, useCallback, useState } from "react";
import { Loader2, Plus, Minus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAddGolfCourse, type GolfCourse } from "@/hooks/useGolfCourses";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useToast } from "@/hooks/useToast";

interface AddCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCourseAdded: (course: GolfCourse) => void;
  existingCourse?: GolfCourse | null;
}

interface NineHoleSection {
  name: string; // e.g., "Front 9", "Meadows", "Forest"
  holes: { [hole: number]: number }; // holes 1-9 with their par values
  handicaps: { [hole: number]: number }; // holes 1-9 with their handicap rankings
  teeYardages: { [teeName: string]: { [hole: number]: number } }; // per-tee per-hole yardages
}

// Handicap rating styles for courses with multiple 9s
type HandicapStyle = 
  | 'per-nine'      // Each 9 rated independently 1-9 (common for 27/36 hole courses)
  | 'combined-18'   // Holes rated 1-18 (standard 18-hole rating)
  | 'sequential';   // All holes rated sequentially (1-27, 1-36, etc.)

interface CourseFormData {
  name: string;
  location: string;
  sections: NineHoleSection[]; // Array of 9-hole sections
  tees: string[]; // tee names (e.g., ["Black", "Blue", "White"])
  handicapStyle: HandicapStyle; // How handicaps are rated
}

export function AddCourseDialog({ open, onOpenChange, onCourseAdded, existingCourse }: AddCourseDialogProps) {
  const { user } = useCurrentUser();
  const { mutateAsync: addCourse, isPending } = useAddGolfCourse();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { toast } = useToast();

  const [scorecardFiles, setScorecardFiles] = useState<File[]>([]);
  const [scorecardPreviews, setScorecardPreviews] = useState<string[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  
  // State for par selection popup
  const [parPopoverOpen, setParPopoverOpen] = useState<{sectionIndex: number, hole: number} | null>(null);
  const [popoverCloseSuppress, setPopoverCloseSuppress] = useState<number>(0);
  
  // State for drag mode to show visual zones
  const [isDragging, setIsDragging] = useState<{sectionIndex: number, hole: number} | null>(null);

  const getDefaultValues = useCallback((): CourseFormData => {
    const defaultTees = ['Blue', 'White'];
    
    if (existingCourse) {
      // Convert existing course to section format
      const holes = existingCourse.holes;
      const totalHoles = Object.keys(holes).length;
      const sections: NineHoleSection[] = [];
      
      // Get tee names from existing course or use defaults
      const courseTees = existingCourse.tees && existingCourse.tees.length > 0 
        ? existingCourse.tees 
        : defaultTees;
      
      // Detect handicap style from existing handicaps
      let detectedStyle: HandicapStyle = 'combined-18';
      if (existingCourse.handicaps) {
        const hcValues = Object.values(existingCourse.handicaps);
        const maxHc = Math.max(...hcValues);
        const numSections = Math.ceil(totalHoles / 9);
        
        if (maxHc <= 9 && numSections > 1) {
          // All handicaps are 1-9, likely per-nine rating
          detectedStyle = 'per-nine';
        } else if (maxHc > 18) {
          // Handicaps go above 18, must be sequential
          detectedStyle = 'sequential';
        } else {
          detectedStyle = 'combined-18';
        }
      }
      
      // Group holes into 9-hole sections
      for (let sectionStart = 1; sectionStart <= totalHoles; sectionStart += 9) {
        const sectionEnd = Math.min(sectionStart + 8, totalHoles);
        const sectionNumber = Math.floor((sectionStart - 1) / 9) + 1;
        const defaultSectionNames = ["Front 9", "Back 9", "Third 9", "Fourth 9"];
        
        const sectionHoles: { [hole: number]: number } = {};
        const sectionHandicaps: { [hole: number]: number } = {};
        const sectionTeeYardages: { [teeName: string]: { [hole: number]: number } } = {};
        
        // Initialize tee yardages for each tee
        for (const teeName of courseTees) {
          sectionTeeYardages[teeName] = {};
        }
        
        for (let hole = sectionStart; hole <= sectionEnd; hole++) {
          const relativeHole = ((hole - 1) % 9) + 1; // Convert to 1-9 within section
          sectionHoles[relativeHole] = holes[hole] || 4;
          sectionHandicaps[relativeHole] = existingCourse.handicaps?.[hole] || hole;
          
          // Get per-tee yardages from existing course
          for (const teeName of courseTees) {
            const teeYards = existingCourse.teeYardages?.[teeName]?.[hole] 
              || existingCourse.yardages?.[hole] // fallback to legacy single yardage
              || 0;
            sectionTeeYardages[teeName][relativeHole] = teeYards;
          }
        }
        
        sections.push({
          name: existingCourse.sections?.[sectionNumber - 1] || defaultSectionNames[sectionNumber - 1] || `9-Hole ${sectionNumber}`,
          holes: sectionHoles,
          handicaps: sectionHandicaps,
          teeYardages: sectionTeeYardages
        });
      }
      
      return {
        name: existingCourse.name,
        location: existingCourse.location,
        sections,
        tees: courseTees,
        handicapStyle: detectedStyle,
      };
    }
    
    // Default empty course with 2 tees
    const createEmptyTeeYardages = () => {
      const teeYardages: { [teeName: string]: { [hole: number]: number } } = {};
      for (const teeName of defaultTees) {
        teeYardages[teeName] = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 0]));
      }
      return teeYardages;
    };
    
    return {
      name: '',
      location: '',
      tees: defaultTees,
      handicapStyle: 'combined-18' as HandicapStyle,
      sections: [
        {
          name: 'Front 9',
          holes: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 4])),
          handicaps: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, i + 1])),
          teeYardages: createEmptyTeeYardages()
        },
        {
          name: 'Back 9', 
          holes: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 4])),
          handicaps: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, i + 10])),
          teeYardages: createEmptyTeeYardages()
        }
      ],
    };
  }, [existingCourse]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CourseFormData>({
    defaultValues: getDefaultValues(),
  });

  const sections = watch('sections');
  const tees = watch('tees') || [];
  const handicapStyle = watch('handicapStyle') || 'combined-18';
  // (yardage totals computed on demand where needed)

  // Reset form when existingCourse changes
  useEffect(() => {
    reset(getDefaultValues());
  }, [existingCourse, reset, getDefaultValues]);

  // Get the max handicap value based on handicap style
  const getMaxHandicap = (): number => {
    switch (handicapStyle) {
      case 'per-nine':
        return 9; // Each nine is rated 1-9
      case 'combined-18':
        return 18; // Standard 18-hole rating
      case 'sequential':
        return sections.length * 9; // All holes rated sequentially
      default:
        return 18;
    }
  };

  // Get the default handicap for a hole based on style
  const getDefaultHandicap = (sectionIndex: number, holeInSection: number): number => {
    switch (handicapStyle) {
      case 'per-nine':
        return holeInSection; // 1-9 within each section
      case 'combined-18':
        // For 18-hole courses, holes 1-18
        // For 27+ holes, we need to handle the "extra" 9s
        if (sections.length <= 2) {
          return sectionIndex * 9 + holeInSection;
        }
        // For 27+ holes with combined-18 style, first two nines get 1-18,
        // additional nines get their own 1-9 (like a rotation)
        if (sectionIndex < 2) {
          return sectionIndex * 9 + holeInSection;
        }
        return holeInSection; // Additional nines rated 1-9
      case 'sequential':
        return sectionIndex * 9 + holeInSection;
      default:
        return sectionIndex * 9 + holeInSection;
    }
  };

  // Add a new 9-hole section
  const addSection = () => {
    if (sections.length < 4) { // Max 4 sections (36 holes)
      const sectionNumber = sections.length + 1;
      const defaultSectionNames = ["Front 9", "Back 9", "Third 9", "Fourth 9"];
      
      // Create empty tee yardages for all current tees
      const teeYardages: { [teeName: string]: { [hole: number]: number } } = {};
      for (const teeName of tees) {
        teeYardages[teeName] = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 0]));
      }
      
      // Generate handicaps based on current style
      const newHandicaps: { [hole: number]: number } = {};
      for (let i = 1; i <= 9; i++) {
        newHandicaps[i] = getDefaultHandicap(sections.length, i);
      }
      
      const newSection: NineHoleSection = {
        name: defaultSectionNames[sectionNumber - 1] || `9-Hole ${sectionNumber}`,
        holes: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 4])),
        handicaps: newHandicaps,
        teeYardages
      };
      
      setValue('sections', [...sections, newSection]);
    }
  };

  // Remove the last section
  const removeSection = (indexToRemove?: number) => {
    if (sections.length > 1) { // Min 1 section (9 holes)
      if (indexToRemove !== undefined) {
        // Remove specific section by index
        const newSections = sections.filter((_, index) => index !== indexToRemove);
        setValue('sections', newSections);
      } else {
        // Remove last section (legacy behavior)
        setValue('sections', sections.slice(0, -1));
      }
    }
  };

  // Update section name
  const updateSectionName = (sectionIndex: number, name: string) => {
    const newSections = [...sections];
    newSections[sectionIndex] = { ...newSections[sectionIndex], name };
    setValue('sections', newSections);
  };

  

  // Update hole par within a section (bounded)
  const updateHolePar = (sectionIndex: number, hole: number, increment: number) => {
    const currentPar = sections[sectionIndex]?.holes[hole] || 4;
    const newPar = Math.max(3, Math.min(5, currentPar + increment));

    const newSections = [...sections];
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      holes: { 
        ...newSections[sectionIndex].holes, 
        [hole]: newPar
      }
    };
    setValue('sections', newSections);
  };  // Cycle hole par smoothly (for drag operations)
  const cycleHolePar = (sectionIndex: number, hole: number, direction: 1 | -1) => {
    const currentPar = sections[sectionIndex]?.holes[hole] || 4;
    const parValues = [3, 4, 5];
    const currentIndex = parValues.indexOf(currentPar);
    
    let newIndex;
    if (direction === 1) {
      // Cycle forward: 3 -> 4 -> 5 -> 3 -> ...
      newIndex = (currentIndex + 1) % parValues.length;
    } else {
      // Cycle backward: 5 -> 4 -> 3 -> 5 -> ...
      newIndex = (currentIndex - 1 + parValues.length) % parValues.length;
    }
    
    const newPar = parValues[newIndex];
    const newSections = [...sections];
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      holes: { 
        ...newSections[sectionIndex].holes, 
        [hole]: newPar
      }
    };
    setValue('sections', newSections);
  };

  // Update hole handicap within a section (1-9 for each section)
  const updateHoleHandicap = (sectionIndex: number, hole: number, newHandicap: number) => {
    const newSections = [...sections];
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      handicaps: { 
        ...(newSections[sectionIndex].handicaps || {}), 
        [hole]: newHandicap
      }
    };
    setValue('sections', newSections);
  };

  // Update hole yardage for a specific tee within a section
  const updateHoleYardage = (sectionIndex: number, teeName: string, hole: number, newYards: number) => {
    const newSections = [...sections];
    const current = newSections[sectionIndex];
    const currentTeeYardages = current.teeYardages || {};
    const currentHoleYards = currentTeeYardages[teeName] || {};
    
    newSections[sectionIndex] = {
      ...current,
      teeYardages: { 
        ...currentTeeYardages, 
        [teeName]: { ...currentHoleYards, [hole]: newYards }
      }
    };
    setValue('sections', newSections);
  };

  // Add a new tee
  const addTee = (teeName: string) => {
    const newTees = [...tees, teeName];
    setValue('tees', newTees);
    
    // Add empty yardages for the new tee to all sections
    const newSections = sections.map(section => ({
      ...section,
      teeYardages: {
        ...section.teeYardages,
        [teeName]: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 0]))
      }
    }));
    setValue('sections', newSections);
  };

  // Remove a tee
  const removeTee = (teeIndex: number) => {
    const teeToRemove = tees[teeIndex];
    const newTees = tees.filter((_, i) => i !== teeIndex);
    setValue('tees', newTees);
    
    // Remove yardages for this tee from all sections
    const newSections = sections.map(section => {
      const { [teeToRemove]: _removed, ...remainingTeeYardages } = section.teeYardages || {};
      return {
        ...section,
        teeYardages: remainingTeeYardages
      };
    });
    setValue('sections', newSections);
  };

  // Rename a tee
  const renameTee = (teeIndex: number, newName: string) => {
    const oldName = tees[teeIndex];
    if (oldName === newName) return;
    
    const newTees = [...tees];
    newTees[teeIndex] = newName;
    setValue('tees', newTees);
    
    // Rename yardages for this tee in all sections
    const newSections = sections.map(section => {
      const { [oldName]: oldYardages, ...remainingTeeYardages } = section.teeYardages || {};
      return {
        ...section,
        teeYardages: {
          ...remainingTeeYardages,
          [newName]: oldYardages || {}
        }
      };
    });
    setValue('sections', newSections);
  };

  // Convert sections back to flat hole structure for storage
  const convertSectionsToHoles = (sections: NineHoleSection[], teeNames: string[]) => {
    const holes: { [hole: number]: number } = {};
    const handicaps: { [hole: number]: number } = {};
    const sectionNames: { [sectionIndex: number]: string } = {};
    const teeYardages: { [teeName: string]: { [hole: number]: number } } = {};
    
    // Initialize teeYardages for each tee
    for (const teeName of teeNames) {
      teeYardages[teeName] = {};
    }
    
    let holeNumber = 1;
    
    sections.forEach((section, sectionIndex) => {
      sectionNames[sectionIndex] = section.name;
      for (let i = 1; i <= 9; i++) {
        if (section.holes[i] !== undefined) {
          holes[holeNumber] = section.holes[i];
          handicaps[holeNumber] = section.handicaps?.[i] || i;
          
          // Copy per-tee yardages
          for (const teeName of teeNames) {
            const yards = section.teeYardages?.[teeName]?.[i] || 0;
            teeYardages[teeName][holeNumber] = yards;
          }
          
          holeNumber++;
        }
      }
    });
    
    return { holes, handicaps, sections: sectionNames, teeYardages };
  };

  // Calculate total par from sections
  const totalPar = sections.reduce((total, section) => {
    return total + Object.values(section.holes).reduce((sectionTotal, par) => sectionTotal + par, 0);
  }, 0);

  // Calculate total holes from sections
  const totalHoles = sections.reduce((total, section) => {
    return total + Object.keys(section.holes).length;
  }, 0);

  const onSubmit = async (data: CourseFormData) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "You must be logged in to add a course.",
        variant: "destructive",
      });
      return;
    }

    try {
      // If any scorecard files were selected, upload them first
      let uploadedUrls: string[] | undefined = undefined;
      if (scorecardFiles.length > 0) {
        setIsUploadingFiles(true);
        try {
          const results = await Promise.all(scorecardFiles.map((f) => uploadFile(f)));
          uploadedUrls = results.map((r) => {
            // `useUploadFile` returns an array of tuples where the first tuple contains the URL
            const first = Array.isArray(r) && r[0] ? r[0] : [];
            return first && first[1] ? first[1] : '';
          }).filter(Boolean);
        } catch (err) {
          console.error('Failed to upload scorecard images', err);
          toast({ title: 'Upload failed', description: 'Failed to upload scorecard images', variant: 'destructive' });
          setIsUploadingFiles(false);
          return;
        } finally {
          setIsUploadingFiles(false);
        }
      }
      // Convert sections to flat hole structure for storage
      const { holes, handicaps, sections: sectionNames, teeYardages } = convertSectionsToHoles(data.sections, data.tees);
      const courseData = {
        name: data.name,
        location: data.location,
        holes,
        handicaps,
        teeYardages,
        sections: sectionNames,
        tees: data.tees,
        scorecardImages: uploadedUrls && uploadedUrls.length > 0 ? uploadedUrls : undefined,
        // Pass existing ID to update the same Nostr event instead of creating a new one
        existingId: existingCourse?.id,
      };
      
      await addCourse(courseData);
      
      // Create the course object for the callback
      const course: GolfCourse = {
        id: existingCourse?.id || `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
        name: data.name,
        location: data.location,
        holes,
        handicaps,
        teeYardages,
        sections: sectionNames,
        tees: data.tees,
        totalPar: Object.values(holes).reduce((sum, par) => sum + par, 0),
        author: existingCourse?.author || user.pubkey,
        createdAt: existingCourse?.createdAt || Date.now(),
      };

      onCourseAdded(course);
      reset();
      
      toast({
        title: existingCourse ? "Course updated" : "Course added",
        description: existingCourse 
          ? `${data.name} has been updated.`
          : `${data.name} has been added to the community database.`,
      });
    } catch {
      toast({
        title: "Failed to add course",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Login Required</DialogTitle>
            <DialogDescription>
              You must be logged in to add a course to the community database.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 !max-w-none">
      <div className="grid w-full sm:w-[90vw] max-w-xl gap-4 border bg-background p-3 sm:p-6 shadow-lg rounded-t-xl sm:rounded-lg max-h-[90vh] overflow-y-auto overflow-x-hidden"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        >
        <DialogHeader>
          <DialogTitle className="text-base sm:text-xl">{existingCourse ? "Edit Golf Course" : "Add Golf Course"}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {existingCourse 
              ? "Edit the course details and save your changes."
              : "Add a new course to the community database. This will be stored on the Nostr network for everyone to use."
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 overflow-hidden">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Course Name</Label>
              <Input
                id="name"
                {...register('name', { required: 'Course name is required' })}
                placeholder="e.g., Pebble Beach Golf Links"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}

            {/* Tees */}
            <div className="space-y-2 mt-3">
              <Label className="text-sm">Tee Boxes</Label>
              <p className="text-xs text-muted-foreground">Define the tees - yardages are entered per-hole below</p>
              <div className="flex flex-wrap gap-2">
                {tees.map((teeName, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                    <Input
                      placeholder="Tee name"
                      value={teeName}
                      onChange={(e) => renameTee(idx, e.target.value)}
                      className="w-20 h-7 text-sm px-2 border-0 bg-transparent"
                    />
                    {tees.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTee(idx)}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => addTee(`Tee ${tees.length + 1}`)}
                  className="h-7"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Tee
                </Button>
              </div>
            </div>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...register('location', { required: 'Location is required' })}
                placeholder="e.g., Pebble Beach, CA"
              />
              {errors.location && (
                <p className="text-sm text-destructive mt-1">{errors.location.message}</p>
              )}
            </div>
            
            {/* Scorecard Photos */}
            <div>
              <Label>Scorecard Photos</Label>
              <div className="flex flex-col gap-2">
                <input
                  id="scorecard-files"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (!files) return;
                    const list = Array.from(files);
                    setScorecardFiles((prev) => [...prev, ...list]);
                    setScorecardPreviews((prev) => [...prev, ...list.map((f) => URL.createObjectURL(f))]);
                    (e.target as HTMLInputElement).value = '';
                  }}
                />
                <div className="flex items-center gap-2">
                  <label htmlFor="scorecard-files">
                    <Button asChild size="sm" variant="outline">
                      <span className="flex items-center"><Upload className="h-4 w-4 mr-2"/>Upload Photos</span>
                    </Button>
                  </label>
                  <span className="text-sm text-muted-foreground">Optional — upload photos of the printed scorecard for verification</span>
                </div>

                {scorecardPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {scorecardPreviews.map((src, idx) => (
                      <div key={idx} className="relative">
                        <img src={src} alt={`scorecard-${idx}`} className="w-full h-24 object-cover rounded-md border" />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => {
                            setScorecardPreviews((prev) => {
                              const newP = [...prev];
                              const removed = newP.splice(idx, 1);
                              if (removed && removed[0]) URL.revokeObjectURL(removed[0]);
                              return newP;
                            });
                            setScorecardFiles((prev) => prev.filter((_, i) => i !== idx));
                          }}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Course Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Course Configuration</Label>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {totalHoles} Holes • Par {totalPar}
                </span>
              </div>
            </div>

            {/* Course Size Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Label className="text-sm">Course Size:</Label>
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  type="button"
                  variant={sections.length === 1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setValue('sections', sections.slice(0, 1))}
                  className="px-3"
                >
                  9 Holes
                </Button>
                <Button
                  type="button"
                  variant={sections.length === 2 ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (sections.length === 1) addSection();
                    else if (sections.length > 2) setValue('sections', sections.slice(0, 2));
                  }}
                  className="px-3"
                >
                  18 Holes
                </Button>
                <Button
                  type="button"
                  variant={sections.length === 3 ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    const currentLength = sections.length;
                    if (currentLength < 3) {
                      // Add sections to reach 3
                      for (let i = currentLength; i < 3; i++) addSection();
                    } else if (currentLength > 3) {
                      setValue('sections', sections.slice(0, 3));
                    }
                  }}
                  className="px-3"
                >
                  27 Holes
                </Button>
                
                {/* Custom configuration indicator and add button */}
                {sections.length > 3 && (
                  <div className="flex items-center gap-1 ml-2 px-2 py-1 bg-muted rounded-md">
                    <span className="text-sm font-medium">{totalHoles} Holes</span>
                  </div>
                )}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSection}
                  disabled={sections.length >= 4}
                  className="h-7 w-7 p-0 ml-2"
                  title="Add another 9-hole section"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Sections with Named 9s */}
            <div className="space-y-6 overflow-hidden">
              {sections.map((section, sectionIndex) => (
                <div key={sectionIndex} className="border rounded-lg p-4 space-y-3 overflow-hidden">
                  {/* Section Name Input */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Label className="text-sm font-medium whitespace-nowrap">9-Hole Name</Label>
                    <Input
                      value={section.name}
                      onChange={(e) => updateSectionName(sectionIndex, e.target.value)}
                      placeholder={`e.g., ${sectionIndex === 0 ? 'Meadows' : sectionIndex === 1 ? 'Forest' : 'Lakes'} Nine`}
                      className="flex-1 h-8"
                    />
                    <span className="text-xs text-muted-foreground">
                      Par {Object.values(section.holes).reduce((sum, par) => sum + par, 0)}
                    </span>
                    {sections.length > 1 && (
                        <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeSection(sectionIndex)}
                        className="h-8 w-8 p-0"
                        title={`Remove section`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {/* 9-Hole Grid - Horizontal scroll contained within this box */}
                  <div className="relative -mx-3 overflow-hidden">
                    <div className="flex gap-1 px-3 pb-2 overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
                      {Array.from({ length: 9 }, (_, i) => {
                        const hole = i + 1;
                        const par = section.holes[hole] || 4;
                        return (
                          <div key={hole} className="flex flex-col items-center gap-1 p-1 sm:p-1.5 border rounded-md min-w-[50px] sm:min-w-[56px] flex-shrink-0 bg-card">
                          <Label className="text-[10px] sm:text-xs font-semibold text-foreground">
                            {hole}
                          </Label>
                          
                          {/* Par Input */}
                          <div className="flex flex-col items-center">
                            <Label className="text-[10px] sm:text-xs text-muted-foreground">Par</Label>
                            <Popover 
                              open={parPopoverOpen?.sectionIndex === sectionIndex && parPopoverOpen?.hole === hole}
                              onOpenChange={(open) => {
                                if (!open) {
                                  // Ignore close requests during suppression window (mobile focus quirks)
                                  if (Date.now() < popoverCloseSuppress) return;
                                  setParPopoverOpen(null);
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <div 
                                  className={`w-10 h-7 flex items-center justify-center bg-background border rounded cursor-pointer select-none touch-manipulation hover:bg-accent hover:border-accent-foreground/20 active:scale-95 transition-all duration-150 relative ${
                                    isDragging?.sectionIndex === sectionIndex && isDragging?.hole === hole 
                                      ? 'bg-accent/50' : ''
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Open popover and suppress auto-close for 500ms
                                    setParPopoverOpen({ sectionIndex, hole });
                                    setPopoverCloseSuppress(Date.now() + 500);
                                  }}
                                  onWheel={(e) => {
                                    e.preventDefault();
                                    const direction = e.deltaY > 0 ? 1 : -1;
                                    cycleHolePar(sectionIndex, hole, direction);
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const element = e.currentTarget;
                                    const rect = element.getBoundingClientRect();
                                    const startY = e.clientY;
                                    let hasMoved = false;
                                    
                                    const getParFromPosition = (clientY: number) => {
                                      const relativeY = clientY - rect.top;
                                      const elementHeight = rect.height;
                                      const ratio = Math.max(0, Math.min(1, relativeY / elementHeight));
                                      if (ratio < 0.33) return 5;
                                      if (ratio < 0.67) return 4;
                                      return 3;
                                    };
                                    
                                    const handleMouseMove = (moveEvent: MouseEvent) => {
                                      const deltaY = Math.abs(moveEvent.clientY - startY);
                                      
                                      if (deltaY > 3 && !hasMoved) {
                                        hasMoved = true;
                                        document.body.style.cursor = 'ns-resize';
                                        setIsDragging({ sectionIndex, hole });
                                      }
                                      
                                      if (hasMoved) {
                                        const newPar = getParFromPosition(moveEvent.clientY);
                                        const currentPar = sections[sectionIndex]?.holes[hole] || 4;
                                        
                                        if (newPar !== currentPar) {
                                          const newSections = [...sections];
                                          newSections[sectionIndex] = {
                                            ...newSections[sectionIndex],
                                            holes: { ...newSections[sectionIndex].holes, [hole]: newPar }
                                          };
                                          setValue('sections', newSections);
                                        }
                                      }
                                    };
                                    
                                    const handleMouseUp = () => {
                                      document.removeEventListener('mousemove', handleMouseMove);
                                      document.removeEventListener('mouseup', handleMouseUp);
                                      document.body.style.cursor = '';
                                      setIsDragging(null);
                                      
                                      if (!hasMoved) {
                                        // Handled by onClick for better mobile support
                                      }
                                    };
                                    
                                    document.addEventListener('mousemove', handleMouseMove);
                                    document.addEventListener('mouseup', handleMouseUp);
                                  }}
                                  onTouchStart={(e) => {
                                    const touch = e.touches[0];
                                    const element = e.currentTarget as HTMLDivElement & { _startY?: number };
                                    element._startY = touch.clientY;
                                  }}
                                  onTouchMove={(e) => {
                                    e.preventDefault();
                                  }}
                                  onTouchEnd={(e) => {
                                    const touch = e.changedTouches[0];
                                    const element = e.currentTarget as HTMLDivElement & { _startY?: number };
                                    const startY = element._startY;
                                    if (startY !== undefined) {
                                      const deltaY = startY - touch.clientY;
                                      if (Math.abs(deltaY) > 10) {
                                        const direction = deltaY > 0 ? 1 : -1;
                                        cycleHolePar(sectionIndex, hole, direction);
                                      }
                                      // else: tap handled by onClick
                                    }
                                  }}
                                  title="Click for menu, scroll to cycle, or drag: top=5, middle=4, bottom=3"
                                >
                                  <span className="font-medium text-sm relative z-10">
                                    {par}
                                  </span>
                                  
                                  {isDragging?.sectionIndex === sectionIndex && isDragging?.hole === hole && (
                                    <div className="absolute inset-0 pointer-events-none">
                                      <div className="absolute top-0 left-0 right-0 h-1/3 bg-green-200/30 border-b border-green-300/50 flex items-center justify-center">
                                        <span className="text-xs font-semibold text-green-700">5</span>
                                      </div>
                                      <div className="absolute top-1/3 left-0 right-0 h-1/3 bg-yellow-200/30 border-b border-yellow-300/50 flex items-center justify-center">
                                        <span className="text-xs font-semibold text-yellow-700">4</span>
                                      </div>
                                      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-orange-200/30 flex items-center justify-center">
                                        <span className="text-xs font-semibold text-orange-700">3</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </PopoverTrigger>
                              <PopoverContent 
                                className="w-auto p-2" 
                                side="top" 
                                align="center"
                                onOpenAutoFocus={(e) => e.preventDefault?.()}
                                onInteractOutside={() => {
                                  // Ignore close during suppression window
                                  if (Date.now() < popoverCloseSuppress) return;
                                  setParPopoverOpen(null);
                                }}
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="text-xs text-muted-foreground text-center mb-1">
                                    Par for Hole {hole}
                                  </div>
                                  <div className="flex gap-1">
                                    {[3, 4, 5].map((parValue) => (
                                      <Button
                                        key={parValue}
                                        variant={par === parValue ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                          updateHolePar(sectionIndex, hole, parValue - par);
                                          setParPopoverOpen(null);
                                        }}
                                        className="w-8 h-8 p-0 font-semibold"
                                      >
                                        {parValue}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          
                          {/* Per-Tee Yardage Inputs */}
                          {tees.map((teeName) => (
                            <div key={teeName} className="flex flex-col items-center">
                              <Label className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[40px]" title={teeName}>
                                {teeName.slice(0, 4)}
                              </Label>
                              <Input
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                min="0"
                                value={section.teeYardages?.[teeName]?.[hole] || ''}
                                onFocus={(e) => (e.target as HTMLInputElement).select()}
                                onContextMenu={(e) => e.preventDefault()}
                                translate="no"
                                style={{ WebkitTouchCallout: 'none' }}
                                onChange={(e) => updateHoleYardage(sectionIndex, teeName, hole, parseInt(e.target.value) || 0)}
                                placeholder="0"
                                className="w-10 sm:w-12 h-10 sm:h-7 text-xs text-center px-0.5 sm:px-1 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          ))}
                          
                          {/* Handicap Input */}
                          <div className="flex flex-col items-center">
                            <Label className="text-[10px] sm:text-xs text-muted-foreground">HC</Label>
                            <Input
                              type="tel"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min="1"
                              max={getMaxHandicap()}
                              value={(section.handicaps && section.handicaps[hole]) || getDefaultHandicap(sectionIndex, hole)}
                              onFocus={(e) => (e.target as HTMLInputElement).select()}
                              onContextMenu={(e) => e.preventDefault()}
                              translate="no"
                              style={{ WebkitTouchCallout: 'none' }}
                              onChange={(e) => {
                                const maxHc = getMaxHandicap();
                                const defaultHc = getDefaultHandicap(sectionIndex, hole);
                                const value = parseInt(e.target.value) || defaultHc;
                                updateHoleHandicap(sectionIndex, hole, Math.max(1, Math.min(maxHc, value)));
                              }}
                              className="w-9 sm:w-10 h-10 sm:h-7 text-xs text-center px-0.5 sm:px-1 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || isUploadingFiles} className="w-full sm:w-auto">
              {(isPending || isUploadingFiles) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Plus className="mr-2 h-4 w-4" />
              {existingCourse ? "Save Changes" : "Add Course"}
            </Button>
          </div>
        </form>
      </div>
    </DialogContent>
    </Dialog>
  );
}