import React from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LoginArea } from '@/components/auth/LoginArea';
import { OutboxPanel } from '@/components/OutboxPanel';
import RelayMetrics from '@/components/RelayMetrics';

interface LayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, showHeader = true }) => {
  return (
    <>
      {showHeader && (
        <header className="border-b bg-yellow-400 sticky top-0 z-50">
          <div className="w-full max-w-screen-sm mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center">
                <div className="rounded-lg">
                  <img
                    src="/Images/pinseekr.golflogo.png"
                    alt="Pinseekr.golf Logo"
                    className="h-8 w-auto"
                  />
                </div>
              </Link>
              <Link
                to="/rounds"
                className="text-sm font-semibold text-gray-900 hover:text-gray-700"
              >
                Rounds
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {/* minimize controls for mobile: keep theme toggle and compact login */}
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <OutboxPanel />
                {/* Relay metrics (dev) */}
                <div className="ml-2">
                  <RelayMetrics />
                </div>
              </div>
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
