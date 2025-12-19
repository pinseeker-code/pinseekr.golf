import { useState } from "react";
import { MapPin, Plus, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { type GolfCourse } from "@/hooks/useGolfCourses";
import { AddCourseDialog } from "./AddCourseDialog";
import { CourseSearch } from "./CourseSearch";

interface CourseSelectionProps {
  selectedCourse?: GolfCourse;
  onSelectCourse: (course: GolfCourse) => void;
  className?: string;
  allowAddCourse?: boolean;
}

export function CourseSelection({ selectedCourse, onSelectCourse, className, allowAddCourse = true }: CourseSelectionProps) {
  const [showCourseSearch, setShowCourseSearch] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<GolfCourse | null>(null);

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Selected Course Display */}
        {selectedCourse ? (
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-green-700 dark:text-green-400">
                  Selected Course
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600">
                    Par {selectedCourse.totalPar}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingCourse(selectedCourse)}
                    className="text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="font-semibold">{selectedCourse.name}</h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3 w-3" />
                {selectedCourse.location}
              </div>
              {selectedCourse.tees && selectedCourse.tees.length > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selectedCourse.tees.map((t) => (
                    <Badge key={`${t.name}-${t.yardage}`} variant="outline" className="text-xs">
                      {t.name} • {t.yardage.toLocaleString()} yd
                    </Badge>
                  ))}
                </div>
              )}
              {selectedCourse.description && (
                <p className="text-sm text-muted-foreground mt-2">{selectedCourse.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {Object.keys(selectedCourse.holes).length} holes
                </Badge>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Browse and search for courses</p>
              {allowAddCourse && (
                <Button variant="outline" size="sm" onClick={() => setShowAddCourse(true)} className="text-gray-900 dark:text-gray-100 font-medium">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Course
                </Button>
              )}
            </div>
            <CourseSearch
              onSelectCourse={(course) => {
                onSelectCourse(course);
              }}
              selectedCourse={selectedCourse}
              onCreateCourse={() => setShowAddCourse(true)}
            />
          </div>
        )}

        {/* Action buttons when course is selected */}
        {selectedCourse && (
          <div className="flex gap-2">
            <Dialog open={showCourseSearch} onOpenChange={setShowCourseSearch}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Change Course
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Select Golf Course</DialogTitle>
                </DialogHeader>
                <CourseSearch
                  onSelectCourse={(course) => {
                    onSelectCourse(course);
                    setShowCourseSearch(false);
                  }}
                    selectedCourse={selectedCourse}
                    onCreateCourse={() => setShowAddCourse(true)}
                />
              </DialogContent>
            </Dialog>
            {allowAddCourse && (
              <Button variant="outline" size="sm" onClick={() => setShowAddCourse(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Course
              </Button>
            )}
          </div>
        )}
      </div>

      <AddCourseDialog
        open={showAddCourse}
        onOpenChange={setShowAddCourse}
        onCourseAdded={(course) => {
          onSelectCourse(course);
          setShowAddCourse(false);
        }}
      />

      <AddCourseDialog
        open={!!editingCourse}
        onOpenChange={(open) => !open && setEditingCourse(null)}
        existingCourse={editingCourse}
        onCourseAdded={(course) => {
          onSelectCourse(course);
          setEditingCourse(null);
        }}
      />
    </div>
  );
}

export function CourseSelectionSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}