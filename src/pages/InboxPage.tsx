import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useInviteInbox } from '@/hooks/useInviteInbox';
import { useAuthor } from '@/hooks/useAuthor';
import { Mail, MapPin, Calendar, LogIn, Flag, X } from 'lucide-react';

function InviteCard({
  invite,
  onDismiss,
}: {
  invite: ReturnType<typeof useInviteInbox>['invites'][number];
  onDismiss: (roundId: string) => void;
}) {
  const navigate = useNavigate();
  const author = useAuthor(invite.fromPubkey);
  const senderName =
    author.data?.metadata?.display_name ||
    author.data?.metadata?.name ||
    invite.fromName ||
    invite.fromPubkey.slice(0, 8) + '…';

  const handleJoin = () => {
    // Navigate to the round join page with auto-join flag
    navigate(`/round/new?joinCode=${invite.code}&autoJoin=1`);
  };

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 bg-green-100 rounded-full dark:bg-green-900">
            <Flag className="h-5 w-5 text-green-700 dark:text-green-300" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">Round Invite from {senderName}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                  {invite.courseName && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {invite.courseName}
                    </span>
                  )}
                  {invite.date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(invite.date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 font-mono text-xs">
                {invite.code}
              </Badge>
            </div>

            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleJoin} className="gap-1.5">
                <LogIn className="h-3.5 w-3.5" />
                Join Round
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDismiss(invite.roundId)}
                className="gap-1.5 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InboxPage() {
  const { user } = useCurrentUser();
  const { invites, isLoading, dismiss } = useInviteInbox();

  if (!user) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-16 text-center">
        <Mail className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <h2 className="text-xl font-semibold mb-2">Your Invite Inbox</h2>
        <p className="text-muted-foreground mb-6">Log in to see round invitations from other players.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Invite Inbox</h1>
        {invites.length > 0 && (
          <Badge className="bg-red-500 text-white">{invites.length}</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : invites.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Mail className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-muted-foreground">No pending invites</p>
            <p className="text-sm text-muted-foreground mt-1">
              When other players invite you to a round, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => (
            <InviteCard key={invite.id} invite={invite} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </div>
  );
}
