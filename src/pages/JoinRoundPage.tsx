import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useNostr } from '@nostrify/react';
import { GOLF_KINDS } from '@/lib/golf/types';
import type { NostrEvent } from '@nostrify/nostrify';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function JoinRoundPage() {
  const { roundId: joinCode } = useParams();
  const navigate = useNavigate();
  const { nostr } = useNostr();
  const [status, setStatus] = useState<'loading' | 'not-found' | 'redirecting'>('loading');
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!joinCode) {
      navigate('/', { replace: true });
      return;
    }

    if (!nostr) {
      console.log('[JoinRoundPage] Waiting for nostr to initialize...');
      return;
    }

    const controller = new AbortController();
    
    // Add a timeout to avoid appearing stuck — but do NOT abort the query.
    // Let the query continue; if an event arrives after the timeout we should still handle it.
    const timeoutId = setTimeout(() => {
      console.log('[JoinRoundPage] Query timed out after 10 seconds (still listening)');
      setTimedOut(true);
    }, 10000);

    (async () => {
      try {
        const codeToQuery = joinCode.toUpperCase();
        console.log('[JoinRoundPage] Querying for join code:', codeToQuery);
        console.log('[JoinRoundPage] Using kind:', GOLF_KINDS.ROUND);
        
        // Query using #d tag with join-CODE format (d tags are always indexed)
        const filter = { kinds: [GOLF_KINDS.ROUND], '#d': [`join-${codeToQuery}`], limit: 1 };
        console.log('[JoinRoundPage] Filter:', JSON.stringify(filter));
        
        const events = await nostr.query([filter], { signal: controller.signal }) as NostrEvent[];

        clearTimeout(timeoutId);
        console.log('[JoinRoundPage] Query returned', events.length, 'events');

        if (events.length > 0) {
          console.log('[JoinRoundPage] First event tags:', JSON.stringify(events[0].tags));
        }

        // If the component was unmounted and the controller aborted, stop.
        if (controller.signal.aborted) return;

        // If the query finished and returned no events, mark not-found.
        if (events.length === 0) {
          console.log('[JoinRoundPage] No events found after query, setting not-found');
          setStatus('not-found');
          return;
        }

        // Get the actual round ID from the round-id tag
        const roundEvent = events[0];
        console.log('[JoinRoundPage] Found round event:', roundEvent);
        const roundIdTag = (roundEvent.tags as string[][]).find((t: string[]) => t[0] === 'round-id');
        const actualRoundId = roundIdTag?.[1];

        if (!actualRoundId) {
          console.log('[JoinRoundPage] No round-id tag found in event');
          setStatus('not-found');
          return;
        }

        console.log('[JoinRoundPage] Redirecting to roundId:', actualRoundId);
        setStatus('redirecting');
        // Redirect to the New Round flow with the actual roundId and request auto-join confirmation
        navigate(`/round/new?roundId=${encodeURIComponent(actualRoundId)}&autoJoin=1`, { replace: true });
      } catch (err) {
        clearTimeout(timeoutId);
        if (!controller.signal.aborted) {
          console.error('[JoinRoundPage] Failed to find round by code', err);
          setStatus('not-found');
        }
      }
    })();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [joinCode, navigate, nostr]);

  if (status === 'not-found') {
    return (
      <Layout>
        <div className="container max-w-md mx-auto py-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Round Not Found</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                No round found with code <span className="font-mono font-bold">{joinCode?.toUpperCase()}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Make sure the host has shared their round code and try again.
              </p>
              <button
                onClick={() => navigate('/round/new')}
                className="text-primary underline hover:no-underline"
              >
                Start a new round instead
              </button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-md mx-auto py-12">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">
                  {status === 'redirecting' ? 'Joining round...' : 'Looking for round...'}
                </p>
                {timedOut && status === 'loading' && (
                  <p className="text-sm text-muted-foreground mt-3">
                    Still searching for the round — relays sometimes take a few seconds to index. If nothing appears, ask the host to republish the code.
                  </p>
                )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
