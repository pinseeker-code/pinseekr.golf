import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Maximize2, X, BarChart3 } from 'lucide-react';
import type { SnakeResult } from '@/lib/golf/snakeEngine';

interface SnakeVisualizationProps {
  snakeResult: SnakeResult;
  playerNames: { [playerId: string]: string };
  playerScores?: { [playerId: string]: number[] };
  coursePars?: { [hole: number]: number };
}

export const SnakeVisualization: React.FC<SnakeVisualizationProps> = ({
  snakeResult,
  playerNames,
  playerScores = {},
  coursePars: _coursePars = {},
}) => {
  const navigate = useNavigate();
  const { holeByHole } = snakeResult;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [textSize, setTextSize] = useState(1); // 0.8, 1, 1.2

  const playerIds = useMemo(() => {
    const ids = new Set<string>();
    holeByHole.forEach(hole => {
      Object.keys(hole.playerPutts).forEach(id => ids.add(id));
    });
    return Array.from(ids);
  }, [holeByHole]);

  // Only show first 9 holes
  const holes = holeByHole.slice(0, 9).map(h => h.hole);
  const numPlayers = playerIds.length;
  const numHoles = holes.length;

  const baseWidth = isFullscreen ? 80 : 42;
  const baseHeight = isFullscreen ? 70 : 38;
  const cellWidth = baseWidth * textSize;
  const cellHeight = baseHeight * textSize;
  const headerWidth = (isFullscreen ? 200 : 110) * textSize;
  const headerHeight = (isFullscreen ? 50 : 30) * textSize;
  const totalWidth = headerWidth + numHoles * cellWidth;
  const totalHeight = headerHeight + numPlayers * cellHeight;

  const snakePath = useMemo(() => {
    const points: { x: number; y: number; hole: number }[] = [];
    
    // Only use first 9 holes
    holeByHole.slice(0, 9).forEach((holeData, holeIndex) => {
      if (holeData.snakeHolder) {
        const playerIndex = playerIds.indexOf(holeData.snakeHolder);
        const x = headerWidth + holeIndex * cellWidth + cellWidth / 2;
        const y = headerHeight + playerIndex * cellHeight + cellHeight * 0.9;
        points.push({ x, y, hole: holeData.hole });
      }
    });

    return points;
  }, [holeByHole, playerIds, headerWidth, cellWidth, cellHeight, headerHeight]);

  const pathD = useMemo(() => {
    if (snakePath.length === 0) return '';
    if (snakePath.length === 1) {
      return `M ${snakePath[0]!.x},${snakePath[0]!.y} m -5,0 a 5,5 0 1,0 10,0 a 5,5 0 1,0 -10,0`;
    }

    let path = `M ${snakePath[0]!.x},${snakePath[0]!.y}`;
    
    for (let i = 1; i < snakePath.length; i++) {
      const prev = snakePath[i - 1]!;
      const curr = snakePath[i]!;
      const dx = curr.x - prev.x;
      const cp1x = prev.x + dx * 0.4;
      const cp1y = prev.y;
      const cp2x = prev.x + dx * 0.6;
      const cp2y = curr.y;
      
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
    }
    
    return path;
  }, [snakePath]);

  function renderSVG(forFullscreen: boolean) {
    return (
      <svg
        width={totalWidth}
        height={totalHeight}
        className="border border-gray-700 rounded-lg bg-gray-800"
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      >
        <defs>
          <linearGradient id="snakeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#86efac" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#4ade80" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.5" />
          </linearGradient>
          
          <linearGradient id="snakeAnimated" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#86efac" stopOpacity="0.4">
              <animate attributeName="stop-opacity" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite" />
            </stop>
            <stop offset="50%" stopColor="#4ade80" stopOpacity="0.5">
              <animate attributeName="stop-opacity" values="0.5;0.7;0.5" dur="3s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.4">
              <animate attributeName="stop-opacity" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite" />
            </stop>
          </linearGradient>

          <pattern id="snakeScales" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.5" fill="rgba(255,255,255,0.15)" />
          </pattern>
        </defs>

        {/* Header row */}
        <rect x={0} y={0} width={headerWidth} height={headerHeight} fill="rgb(55, 65, 81)" stroke="rgb(75, 85, 99)" strokeWidth={1} />
        
        {/* Resize buttons in header */}
        <foreignObject x={5} y={5} width={headerWidth - 10} height={headerHeight - 10}>
          <div className="flex gap-1 items-center h-full">
            <button 
              onClick={() => setTextSize(Math.max(0.8, textSize - 0.1))}
              className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm font-bold min-w-6"
              title="Decrease text size"
            >
              −
            </button>
            <button 
              onClick={() => setTextSize(Math.min(1.4, textSize + 0.1))}
              className="p-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm font-bold min-w-6"
              title="Increase text size"
            >
              +
            </button>
          </div>
        </foreignObject>
        
        {/* Grid layer - header row */}
        {holes.map((hole, i) => (
          <rect key={`grid-header-${hole}`} x={headerWidth + i * cellWidth} y={0} width={cellWidth} height={headerHeight} fill="rgb(55, 65, 81)" stroke="rgb(75, 85, 99)" strokeWidth={1} />
        ))}

        {/* Grid layer - player rows */}
        {playerIds.map((playerId, playerIndex) => (
          <g key={`grid-${playerId}`}>
            <rect x={0} y={headerHeight + playerIndex * cellHeight} width={headerWidth} height={cellHeight} fill="rgb(55, 65, 81)" stroke="rgb(75, 85, 99)" strokeWidth={1} />
            {holes.map((hole, holeIndex) => (
              <rect key={`grid-${playerId}-${hole}`} x={headerWidth + holeIndex * cellWidth} y={headerHeight + playerIndex * cellHeight} width={cellWidth} height={cellHeight} fill="none" stroke="rgb(75, 85, 99)" strokeWidth={1} />
            ))}
          </g>
        ))}

        {/* Snake path layer */}
        {pathD && (
          <>
            <path d={pathD} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" transform="translate(1, 2)" />
            <path d={pathD} fill="none" stroke="#15803d" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d={pathD} fill="none" stroke="url(#snakeAnimated)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
              <animate attributeName="stroke-dasharray" values="0,1000;1000,0" dur="3s" repeatCount="indefinite" />
            </path>
            <path d={pathD} fill="none" stroke="url(#snakeScales)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />

            {snakePath.length > 0 && (
              <g>
                <circle cx={snakePath[snakePath.length - 1]!.x} cy={snakePath[snakePath.length - 1]!.y} r="10" fill="url(#snakeGradient)" stroke="#15803d" strokeWidth="2">
                  <animate attributeName="r" values="10;12;10" dur="1.5s" repeatCount="indefinite" />
                </circle>
                <circle cx={snakePath[snakePath.length - 1]!.x - 3} cy={snakePath[snakePath.length - 1]!.y - 2} r="2" fill="white" />
                <circle cx={snakePath[snakePath.length - 1]!.x + 3} cy={snakePath[snakePath.length - 1]!.y - 2} r="2" fill="white" />
                <circle cx={snakePath[snakePath.length - 1]!.x - 3} cy={snakePath[snakePath.length - 1]!.y - 2} r="1" fill="black" />
                <circle cx={snakePath[snakePath.length - 1]!.x + 3} cy={snakePath[snakePath.length - 1]!.y - 2} r="1" fill="black" />
                {/* Forked tongue - smaller, slower */}
                <g>
                  <line x1={snakePath[snakePath.length - 1]!.x - 1.5} y1={snakePath[snakePath.length - 1]!.y + 8} x2={snakePath[snakePath.length - 1]!.x - 3} y2={snakePath[snakePath.length - 1]!.y + 12} stroke="#ff1744" strokeWidth="1.5" strokeLinecap="round">
                    <animate attributeName="y2" values={`${snakePath[snakePath.length - 1]!.y + 12};${snakePath[snakePath.length - 1]!.y + 13};${snakePath[snakePath.length - 1]!.y + 12}`} dur="1.2s" repeatCount="indefinite" />
                  </line>
                  <line x1={snakePath[snakePath.length - 1]!.x + 1.5} y1={snakePath[snakePath.length - 1]!.y + 8} x2={snakePath[snakePath.length - 1]!.x + 3} y2={snakePath[snakePath.length - 1]!.y + 12} stroke="#ff1744" strokeWidth="1.5" strokeLinecap="round">
                    <animate attributeName="y2" values={`${snakePath[snakePath.length - 1]!.y + 12};${snakePath[snakePath.length - 1]!.y + 13};${snakePath[snakePath.length - 1]!.y + 12}`} dur="1.2s" repeatCount="indefinite" />
                  </line>
                </g>
              </g>
            )}
          </>
        )}

        {/* Text layer - hole numbers */}
        {holes.map((hole, i) => (
          <text key={`text-header-${hole}`} x={headerWidth + i * cellWidth + cellWidth / 2} y={headerHeight / 2} textAnchor="middle" dominantBaseline="middle" style={{fontSize: `${10 * textSize}px`}} className="font-bold fill-gray-100">
            {hole}
          </text>
        ))}

        {/* Text layer - player names and scores */}
        {playerIds.map((playerId, playerIndex) => (
          <g key={`text-${playerId}`}>
            <text x={8 * textSize} y={headerHeight + playerIndex * cellHeight + cellHeight / 2} dominantBaseline="middle" style={{fontSize: `${(forFullscreen ? 16 : 10) * textSize}px`}} className="font-semibold fill-gray-100">
              {playerNames[playerId] || playerId}
            </text>

            {holes.map((hole, holeIndex) => {
              const score = playerScores[playerId]?.[holeIndex];
              
              return (
                score !== undefined && (
                  <text key={`text-${playerId}-${hole}`} x={headerWidth + holeIndex * cellWidth + cellWidth / 2} y={headerHeight + playerIndex * cellHeight + cellHeight / 2} textAnchor="middle" dominantBaseline="middle" style={{fontSize: `${18 * textSize}px`}} className="fill-gray-100">
                    {score}
                  </text>
                )
              );
            })}
          </g>
        ))}
      </svg>
    );
  }

  return (
    <>
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-gray-900 overflow-auto">
          <div className="sticky top-0 p-4 flex justify-between items-center bg-gray-900 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">Scorecard</h2>
            <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(false)} className="text-white hover:bg-gray-800">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="p-8 flex justify-center items-start min-h-screen">
            <div className="overflow-x-auto max-w-full">
              {renderSVG(true)}
            </div>
          </div>
        </div>
      )}
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Scorecard
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/round-summary')} className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Stats</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsFullscreen(true)} className="flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Fullscreen</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto scrollbar-thin">
            {renderSVG(false)}
          </div>
        </CardContent>
      </Card>
    </>
  );
};
