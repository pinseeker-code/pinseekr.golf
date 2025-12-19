import React from 'react';

interface MobileContainerProps {
  children: React.ReactNode;
  className?: string;
}

// Mobile-first container wrapper: full-width with a constrained max width optimized for phones
export const MobileContainer: React.FC<MobileContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`w-full max-w-screen-sm mx-auto px-4 ${className}`}>
      {children}
    </div>
  );
};

export default MobileContainer;
