import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import MobileContainer from '@/components/MobileContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginArea } from '@/components/auth/LoginArea';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Users, Zap, Trophy, BarChart3, User, Code } from 'lucide-react';

// Developer profile info for "Vibed by" section
const DEVELOPER = {
  npub: 'npub12sl626zucwnkqwxnkm5y5knlnxycn2cx8vy3dhfghccqxvnkxvuqfy6dme',
  name: 'Pinseekr',
  picture: 'https://yt3.googleusercontent.com/K1EFE5qDKlP3SMP4eruEZNK5mpM6MULLo5ogfoaggcQSx_4EUF_wXJbw1ebEUymFv_mQcUVoVAY=s160-c-k-c0x00ffffff-no-rj',
  lud16: 'pinseekr@npub.cash',
};

const Index = () => {
  const { user } = useCurrentUser();

  useSeoMeta({
    title: 'Pinseekr.golf - Decentralized Golf Scoring',
    description: 'Track your golf scores, split costs and manage wagers, and share achievements with the Nostr social network.',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b bg-yellow-400">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg">
              <img
                src="/Images/pinseekr.golflogo.png"
                alt="Pinseekr.golf Logo"
                className="h-12 w-auto"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <LoginArea className="max-w-60" useEnhancedLogin={true} />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <MobileContainer className="py-16">
          <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            The Future of Golf Scoring
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Track scoring and stats, split costs and settle wagers with Lightning. Golf decentralized—built on Nostr.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:space-x-4">
            {user ? (
              <>
                <Link to="/round/new">
                  <Button size="lg" className="text-lg px-8 py-3 w-full sm:w-auto">
                    <span className="mr-2">⛳</span>
                    Start New Round
                  </Button>
                </Link>
                {/* View Achievements button moved into the Achievement Badges card below */}
              </>
            ) : (
              <div className="bg-white/90 dark:bg-gray-800/90 p-6 rounded-lg border w-full sm:w-auto">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Sign in with your Nostr identity to start tracking your golf scores
                </p>
                <LoginArea className="w-full" useEnhancedLogin={true} />
              </div>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="text-center hover:shadow-lg transition-shadow h-full hover:scale-105 transition-transform">
            <CardHeader>
              <Link to="/round/new" className="block">
                <div className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#FFD600' }}>
                  <span className="font-bold text-xl" style={{ color: '#333333' }}>⛳</span>
                </div>
                <CardTitle>Score Tracking</CardTitle>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="mb-3">
                <Link to="/demo">
                  <Button variant="outline" size="sm" className="text-xs">
                    Try Interactive Demo
                  </Button>
                </Link>
              </div>
              <CardDescription>
                Try out a demo of the scoring page and expense input.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Zap className="h-12 w-12 mx-auto mb-4" style={{ color: '#8B00FF' }} />
              <CardTitle>Lightning Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Split costs and manage Lightning Network wagers with your friends for added excitement.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Users className="h-12 w-12 mx-auto mb-4" style={{ color: '#333333' }} />
              <CardTitle>Social Features</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Share achievements and scores with the Nostr network. Build your golf reputation.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Trophy className="h-12 w-12 mx-auto mb-4" style={{ color: '#FFD600' }} />
              <CardTitle>Achievement Badges</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Earn badges for hole-in-ones, breaking 90, eagles, and other golf milestones.
              </CardDescription>
              <p className="mt-3 text-xs text-muted-foreground">
                Note: This is currently a proof of concept — badges and reputational features are experimental.
              </p>
                <div className="mt-4">
                  <Link to="/achievements">
                    <Button variant="outline" size="sm">
                      <Trophy className="mr-2 h-4 w-4" />
                      View Achievements
                    </Button>
                  </Link>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Game Modes Section */}
        {user && (
          <Card className="mb-16">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-6 w-6" style={{ color: '#FFD600' }} />
                <CardTitle className="text-2xl">Multiple Game Modes</CardTitle>
              </div>
              <CardDescription>
                Choose from various scoring formats to match your playing style
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">Stroke Play</h3>
                  <p className="text-purple-700 dark:text-purple-300 text-sm">
                    Traditional golf scoring where every stroke counts. Players record their actual score on each hole, and the lowest total score after 18 holes wins. Handicaps are applied to level the playing field.
                  </p>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Skins</h3>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                    Win money on individual holes by having the lowest score. If multiple players tie, the "skin" carries over to the next hole, creating bigger payouts. Perfect for adding excitement to every hole.
                  </p>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Nassau</h3>
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    Three separate bets in one: front 9, back 9, and overall 18-hole match. You can win, lose, or push each bet independently. The most popular golf betting format among players.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Match Play</h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    Head-to-head competition where you win or lose individual holes, not total strokes. First to be "up" by more holes than remain wins the match. Used in the Ryder Cup and many tournaments.
                  </p>
                </div>
                {/* Dots card removed from UI per request (engine retained) */}
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Snake</h3>
                    <p className="text-green-700 dark:text-green-300 text-sm">
                      Progressive Wager (penalty increases as more three-putts are made by the group). When a player three-putts the Snake is passed; the final Snake at round end carries the largest penalty.
                    </p>
                </div>
                <div className="p-4 bg-gradient-to-br from-yellow-50 via-purple-50 to-yellow-50 dark:from-yellow-950 dark:via-purple-950 dark:to-yellow-950 rounded-lg border-2 border-yellow-400 dark:border-yellow-600 relative overflow-hidden">
                  <div className="absolute top-2 right-2">
                    <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full font-bold">NEW</span>
                  </div>
                  <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-2 flex items-center">
                    🏆 Pinseekr Cup
                  </h3>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                    Multi-format tournament where game modes can change every 3, 6, 9, or 18 holes during one or multiple rounds. Teams compete in Ryder Cup-style format mixing stroke play, match play, dots, and snake. Ultimate test of adaptability and golf skills.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Why Nostr Section */}
        <Card className="mb-16 bg-gradient-to-r from-purple-50 to-yellow-50 dark:from-purple-950 dark:to-yellow-950 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Why Nostr?</CardTitle>
            <CardDescription className="text-center text-lg">
              Your identity, your data, your golf legacy - forever
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#8B00FF' }}>
                  <User className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-semibold mb-2">Digital Identity</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  One cryptographic identity across all apps. No passwords, no accounts to lose - just your keys, your identity.
                </p>
              </div>
              <div className="text-center">
                <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#FFD600' }}>
                  <span className="font-bold text-2xl" style={{ color: '#333333' }}>⚡</span>
                </div>
                <h3 className="font-semibold mb-2">Lightning Payments</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Instant, low-cost Bitcoin payments. Split costs, settle wagers, and tip players seamlessly with Lightning Network.
                </p>
              </div>
              <div className="text-center">
                <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#333333' }}>
                  <Code className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-semibold mb-2">Open Source</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Transparent, auditable code. No hidden algorithms or data mining - see exactly how your data is handled.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vibed by section */}
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Vibed by:</p>
          <div className="flex flex-col items-center gap-4">
            {/* Developer Profile Badge */}
            <a
              href={`https://njump.me/${DEVELOPER.npub}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={DEVELOPER.picture} alt={DEVELOPER.name} />
                <AvatarFallback>{DEVELOPER.name[0]}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-gray-900 dark:text-gray-100">{DEVELOPER.name}</span>
            </a>
            {/* Zap Button */}
            <a
              href={`lightning:${DEVELOPER.lud16}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium transition-colors"
            >
              <Zap className="h-4 w-4" />
              Zap
            </a>
          </div>
        </div>
        </MobileContainer>
      </main>
    </div>
  );
};

export default Index;