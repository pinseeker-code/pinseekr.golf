import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Key, Wallet, User, Smartphone, ExternalLink, Zap } from 'lucide-react';

interface NostrAuthProps {
  onAuth?: (pubkey: string, method: 'extension' | 'npub' | 'mobile' | 'amber') => void;
  className?: string;
}

// Mobile detection utilities
const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isAndroid = () => /Android/i.test(navigator.userAgent);
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

// Window.nostr type is now provided by @nostr-dev-kit/ndk

export function NostrAuth({ onAuth, className }: NostrAuthProps) {
  const [userPubkey, setUserPubkey] = useState<string | null>(null);
  const [npubInput, setNpubInput] = useState('');
  const [authMethod, setAuthMethod] = useState<'extension' | 'npub' | 'mobile' | 'amber' | null>(null);
  const [error, setError] = useState<string | null>(null);






  const connectWithNpub = () => {
    if (!npubInput.startsWith('npub1') || npubInput.length !== 63) {
      setError('Please enter a valid npub (should start with npub1 and be 63 characters long)');
      return;
    }

    try {
      // Store the npub for display and pass to callback
      setUserPubkey(npubInput);
      setAuthMethod('npub');
      setError(null);
      onAuth?.(npubInput, 'npub');
    } catch {
      setError('Invalid npub format');
    }
  };

  const connectWithAmber = () => {
    if (!isAndroid()) {
      setError('Amber is only available on Android devices');
      return;
    }

    try {
      // Try Amber deep link
      const amberUrl = `nostr:${window.location.origin}/auth-callback`;
      window.location.href = amberUrl;
    } catch {
      // Fallback to Google Play Store
      window.open('https://play.google.com/store/apps/details?id=com.greenart7c3.amber', '_blank');
    }
  };

  const openMobileClient = (client: 'damus' | 'amethyst' | 'primal') => {
    const urls = {
      damus: isIOS()
        ? 'https://apps.apple.com/us/app/damus/id1628663131'
        : 'https://damus.io/',
      amethyst: isAndroid()
        ? 'https://play.google.com/store/apps/details?id=com.vitorpamplona.amethyst'
        : 'https://www.amethyst.social/',
      primal: 'https://primal.net/downloads'
    };

    window.open(urls[client], '_blank');
  };

  const disconnect = () => {
    setUserPubkey(null);
    setAuthMethod(null);
    setNpubInput('');
    setError(null);
  };

  const getDisplayName = (pubkey: string) => {
    if (pubkey.startsWith('npub1')) {
      return `${pubkey.slice(0, 12)}...${pubkey.slice(-4)}`;
    }
    return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
  };

  // If already authenticated, show connected state
  if (userPubkey && authMethod) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Connected</span>
              </div>
              <Badge variant="secondary" className="gap-1">
                {authMethod === 'extension' ? (
                  <>
                    <Wallet className="h-3 w-3" />
                    Extension
                  </>
                ) : authMethod === 'amber' ? (
                  <>
                    <Smartphone className="h-3 w-3" />
                    Amber
                  </>
                ) : authMethod === 'mobile' ? (
                  <>
                    <Smartphone className="h-3 w-3" />
                    Mobile
                  </>
                ) : (
                  <>
                    <Key className="h-3 w-3" />
                    npub
                  </>
                )}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground font-mono">
            {getDisplayName(userPubkey)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="h-5 w-5" />
          Join the Golf Community
        </CardTitle>
        <CardDescription>
          Connect to unlock achievements, track your progress, and compete with golfers worldwide
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Mobile-First: Show mobile options prominently on mobile devices */}
        {isMobile() && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span className="text-sm font-medium">Mobile Authentication</span>
            </div>

            {/* Amber for Android */}
            {isAndroid() && (
              <Button
                onClick={connectWithAmber}
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Zap className="h-4 w-4" />
                Connect with Amber (Recommended)
              </Button>
            )}

            {/* Mobile Client Options */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">New to Nostr? Download an app to get started:</p>
              <div className="grid grid-cols-1 gap-2">
                {isIOS() && (
                  <Button
                    onClick={() => openMobileClient('damus')}
                    variant="outline"
                    size="sm"
                    className="justify-between"
                  >
                    <span>Damus for iOS</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
                {isAndroid() && (
                  <Button
                    onClick={() => openMobileClient('amethyst')}
                    variant="outline"
                    size="sm"
                    className="justify-between"
                  >
                    <span>Amethyst for Android</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  onClick={() => openMobileClient('primal')}
                  variant="outline"
                  size="sm"
                  className="justify-between"
                >
                  <span>Primal (Cross-platform)</span>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                After setting up your account, return here to connect and start tracking your golf achievements!
              </p>
            </div>
          </div>
        )}



        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* npub Method */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span className="text-sm font-medium">Already have an account?</span>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="npub1..."
              value={npubInput}
              onChange={(e) => setNpubInput(e.target.value)}
              className="font-mono text-xs"
            />
            <Button onClick={connectWithNpub} disabled={!npubInput.trim()}>
              Connect
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste your Nostr address (npub) to view your profile and saved scores
          </p>
        </div>
      </CardContent>
    </Card>
  );
}