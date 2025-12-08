import { MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type GolfCourse } from "@/hooks/useGolfCourses";

interface CourseInfoCardProps {
  course: GolfCourse;
  className?: string;
}

export function CourseInfoCard({ course, className }: CourseInfoCardProps) {
  return (
    <Card className={`border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-green-700 dark:text-green-400">
            Selected Course
          </CardTitle>
          <Badge variant="outline" className="text-green-600">
            Par {course.totalPar}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <h3 className="font-semibold">{course.name}</h3>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <MapPin className="h-3 w-3" />
          {course.location}
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <Users className="h-3 w-3" />
          Added by community
        </div>
      </CardContent>
    </Card>
  );
}