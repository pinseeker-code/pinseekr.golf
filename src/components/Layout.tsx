import React from 'react';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LoginArea } from '@/components/auth/LoginArea';

interface LayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, showHeader = true }) => {
  return (
    <>
      {showHeader && (
        <header className="border-b bg-yellow-400 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Link to="/" className="flex items-center">
                <div className="p-2 rounded-lg">
                  <img 
                    src="/Images/pinseekr.golflogo.png" 
                    alt="Pinseekr.golf Logo" 
                    className="h-12 w-auto"
                  />
                </div>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <LoginArea className="max-w-60" />
            </div>
          </div>
        </header>
      )}
      {children}
    </>
  );
};
