import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useRoundHistory } from '@/hooks/useRoundHistory';
import { Calendar, Filter, Trophy, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RoundHistoryPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { data: rounds, isLoading } = useRoundHistory(user?.pubkey);
  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minPlayers, setMinPlayers] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('');

  const filteredRounds = useMemo(() => {
    if (!rounds) return [];

    return rounds.filter((round) => {
      const courseMatch = courseFilter.trim().length === 0
        || round.courseName.toLowerCase().includes(courseFilter.trim().toLowerCase());

      const statusMatch = statusFilter === 'all' || round.status === statusFilter;

      const startMatch = startDate
        ? round.date >= new Date(startDate).getTime()
        : true;

      const endMatch = endDate
        ? round.date <= new Date(endDate).getTime()
        : true;

      const minPlayersValue = minPlayers ? Number(minPlayers) : undefined;
      const maxPlayersValue = maxPlayers ? Number(maxPlayers) : undefined;

      const minPlayersMatch = minPlayersValue !== undefined
        ? round.playerCount >= minPlayersValue
        : true;
      const maxPlayersMatch = maxPlayersValue !== undefined
        ? round.playerCount <= maxPlayersValue
        : true;
      return courseMatch && statusMatch && startMatch && endMatch && minPlayersMatch && maxPlayersMatch;
    });
  }, [rounds, courseFilter, statusFilter, startDate, endDate, minPlayers, maxPlayers]);

  if (!user) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <Alert>
            <AlertDescription>
              Please log in to view your round history
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Round History</h1>
          <p className="text-muted-foreground">
            Your completed and in-progress rounds
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            <CardDescription>
              Narrow your round history by course, status, or date
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="course-filter">Course</Label>
              <Input
                id="course-filter"
                value={courseFilter}
                onChange={(event) => setCourseFilter(event.target.value)}
                placeholder="Search by course"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date range</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Players</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={minPlayers}
                  onChange={(event) => setMinPlayers(event.target.value)}
                  placeholder="Min"
                />
                <Input
                  type="number"
                  min={1}
                  value={maxPlayers}
                  onChange={(event) => setMaxPlayers(event.target.value)}
                  placeholder="Max"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !filteredRounds || filteredRounds.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No rounds found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting filters or start a new round
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredRounds.map((round) => {
              const date = new Date(round.date);
              return (
                <Card key={round.eventId || round.roundId}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle>{round.courseName}</CardTitle>
                        <CardDescription className="mt-1 space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <Calendar className="h-3 w-3" />
                            {date.toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Users className="h-3 w-3" />
                            {round.playerCount} players
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {round.topGross !== undefined || round.topNet !== undefined ? (
                              <>
                                {round.topGross !== undefined && (
                                  <span className="mr-3">Best Gross: {round.topGross}</span>
                                )}
                                {round.topNet !== undefined && (
                                  <span>Best Net: {round.topNet}</span>
                                )}
                              </>
                            ) : (
                              <>Scores pending</>
                            )}
                          </div>
                        </CardDescription>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div className="capitalize">{round.gameMode.replace('-', ' ')}</div>
                        <div className="capitalize">{round.status}</div>
                        <div className="mt-1">
                          {round.settlementPublished ? 'Settlement published' : 'Settlement pending'}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => navigate(`/round/${round.roundId}`)}
                        className="flex-1"
                      >
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/round/${round.roundId}/score`)}
                        className="flex-1"
                      >
                        Open Scorecard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
