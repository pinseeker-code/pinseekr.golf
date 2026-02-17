import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import MobileContainer from '@/components/MobileContainer';
import { ScoringEngineDemo } from '@/components/ScoringEngineDemo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Zap } from 'lucide-react';

export const SimulatorPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 py-4">
        <MobileContainer>
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                <Zap className="h-3 w-3 mr-1" />
                Simulator
              </Badge>
            </div>

            {/* Scoring Engine Demo Component */}
            <ScoringEngineDemo />
          </div>
        </MobileContainer>
      </div>
    </Layout>
  );
};

export default SimulatorPage;
