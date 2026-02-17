import { useEffect, useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useParams, Navigate } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { Layout } from '@/components/Layout';
import MobileContainer from '@/components/MobileContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { NoteContent } from '@/components/NoteContent';
import { ZapButton } from '@/components/ZapButton';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { AlertCircle } from 'lucide-react';
import NotFound from './NotFound';
import { APP_KIND } from '@/lib/golf/types';
import { SUBTYPES } from '@/lib/golfTags';

export default function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();
  const { nostr } = useNostr();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<NostrEvent | null>(null);
  const [redirect, setRedirect] = useState<string | null>(null);

  useEffect(() => {
    if (!identifier || !nostr) {
      setLoading(false);
      setError('Invalid request');
      return;
    }

    let decoded;
    try {
      decoded = nip19.decode(identifier);
    } catch {
      setLoading(false);
      setError('Invalid NIP-19 identifier');
      return;
    }

    const { type, data } = decoded;

    // Handle simple redirects
    if (type === 'npub' || type === 'nprofile') {
      setRedirect(`/profile/${identifier}`);
      return;
    }

    // Fetch events for note, nevent, naddr
    (async () => {
      try {
        setLoading(true);
        const controller = new AbortController();
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]);

        let eventId: string | undefined;
        let filters: import('@nostrify/nostrify').NostrFilter[] = [];

        if (type === 'note') {
          eventId = data as string;
          filters = [{ ids: [eventId], limit: 1 }];
        } else if (type === 'nevent') {
          const neventData = data as { id: string; relays?: string[]; author?: string; kind?: number };
          eventId = neventData.id;
          filters = [{ ids: [eventId], limit: 1 }];
        } else if (type === 'naddr') {
          const naddrData = data as { identifier: string; pubkey: string; kind: number; relays?: string[] };
          filters = [{ 
            kinds: [naddrData.kind], 
            authors: [naddrData.pubkey], 
            '#d': [naddrData.identifier], 
            limit: 1 
          }];
        }

        const events = await nostr.query(filters, { signal });
        
        if (events.length === 0) {
          setError('Event not found');
          setLoading(false);
          return;
        }

        const foundEvent = events[0];
        if (!foundEvent) {
          setError('Event not found');
          setLoading(false);
          return;
        }

        // Check if this is a golf-specific event that should be redirected
        if (foundEvent.kind === APP_KIND) {
          const tags = foundEvent.tags as string[][];
          const hasGolfTag = tags.some(t => t[0] === 't' && t[1] === 'golf');
          
          if (hasGolfTag) {
            const subtype = tags.find(t => t[0] === 't' && t[1] !== 'golf')?.[1];
            
            // Redirect golf rounds to round details page
            if (subtype === SUBTYPES.ROUND) {
              const dTag = tags.find(t => t[0] === 'd')?.[1];
              const roundIdTag = tags.find(t => t[0] === 'round-id')?.[1];
              const roundId = dTag || roundIdTag;
              if (roundId) {
                setRedirect(`/round/${roundId}`);
                return;
              }
            }
            
            // Redirect golf profiles to profile page
            if (subtype === SUBTYPES.PROFILE || (foundEvent.kind as unknown as number) === 30382) {
              const npub = nip19.npubEncode(foundEvent.pubkey);
              setRedirect(`/profile/${npub}`);
              return;
            }
          }
        }

        // For other events, display them
        setEvent(foundEvent);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch event:', err);
        setError('Failed to load event');
        setLoading(false);
      }
    })();
  }, [identifier, nostr]);

  // Handle redirects
  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  // Handle invalid identifier
  if (!identifier) {
    return <NotFound />;
  }

  // Handle loading state
  if (loading) {
    return (
      <Layout>
        <MobileContainer className="py-8">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </MobileContainer>
      </Layout>
    );
  }

  // Handle error state
  if (error) {
    return (
      <Layout>
        <MobileContainer className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </MobileContainer>
      </Layout>
    );
  }

  // Handle event not found
  if (!event) {
    return <NotFound />;
  }

  // Render the event
  return <EventView event={event} />;
}

// Component to render a generic Nostr event
function EventView({ event }: { event: NostrEvent }) {
  const { data: author } = useAuthor(event.pubkey);
  const authorName = author?.metadata?.name || genUserName(event.pubkey);
  const eventDate = new Date(event.created_at * 1000);

  return (
    <Layout>
      <MobileContainer className="py-8">
        <div className="space-y-6">
          {/* Event Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">Note from {authorName}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {eventDate.toLocaleDateString()} at {eventDate.toLocaleTimeString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Kind {event.kind}
                  </p>
                </div>
                <ZapButton 
                  target={event as unknown as import('nostr-tools').Event} 
                  className="text-sm"
                  showCount={true}
                />
              </div>
            </CardHeader>
            <CardContent>
              <NoteContent event={event} className="text-base leading-relaxed" />
            </CardContent>
          </Card>

          {/* Comments Section */}
          <CommentsSection 
            root={event}
            title="Replies"
            emptyStateMessage="No replies yet"
            emptyStateSubtitle="Be the first to reply!"
          />
        </div>
      </MobileContainer>
    </Layout>
  );
} 