import React from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LoginArea } from '@/components/auth/LoginArea';
import { OutboxPanel } from '@/components/OutboxPanel';
import RelayMetrics from '@/components/RelayMetrics';
import { useInviteInbox } from '@/hooks/useInviteInbox';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Mail } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
}

function InboxIconButton() {
  const { user } = useCurrentUser();
  const { count } = useInviteInbox();
  if (!user) return null;
  return (
    <Link to="/inbox" className="relative flex items-center justify-center h-8 w-8 rounded-md hover:bg-yellow-500/50 transition-colors">
      <Mail className="h-4 w-4 text-gray-900" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}

export const Layout: React.FC<LayoutProps> = ({ children, showHeader = true }) => {
  return (
    <>
      {showHeader && (
        <header className="border-b bg-yellow-400 sticky top-0 z-50">
          <div className="w-full max-w-screen-sm mx-auto px-4 py-2 flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <div className="rounded-lg">
                <img
                  src="/Images/pinseekr.golflogo.png"
                  alt="Pinseekr.golf Logo"
                  className="h-8 w-auto"
                />
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <InboxIconButton />
              <OutboxPanel />
              <RelayMetrics />
              <div className="w-24">
                <LoginArea useEnhancedLogin={true} />
              </div>
            </div>
          </div>
        </header>
      )}
      {children}
    </>
  );
};

