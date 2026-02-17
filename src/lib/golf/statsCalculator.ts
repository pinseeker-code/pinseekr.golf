import { PlayerInRound } from './types';

export interface PlayerStats {
  playerId: string;
  playerName: string;
  holesPlayed: number;
  totalScore: number;
  scoreToParString: string;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  fairwaysHit: number;
  fairwaysAttempted: number;
  fairwaysPercent: number;
  girHit: number;
  greensPercent: number;
  totalPutts: number;
  avgPutts: string;
}

export function calculatePlayerStats(
  player: PlayerInRound,
  coursePars: { [hole: number]: number }
): PlayerStats {
  const scores = player.scores || [];
  const playerData = player as unknown as Record<string, unknown>;
  const putts = Array.isArray(playerData.putts) 
    ? playerData.putts as number[] 
    : Array.from({ length: 9 }, (_, i) => player.holeDetails?.[i]?.putts || 0);
  
  let eagles = 0;
  let birdies = 0;
  let pars = 0;
  let bogeys = 0;
  let doublePlus = 0;
  let girHit = 0;
  let totalScore = 0;
  let totalPutts = 0;
  let fairwaysHit = 0;
  let fairwaysAttempted = 0;

  scores.forEach((score, holeIndex) => {
    const hole = holeIndex + 1;
    const par = coursePars[hole] || 0;
    
    totalScore += score;
    const puttCount = putts[holeIndex] || 0;
    totalPutts += puttCount;

    // Score tracking
    if (score < par - 1) {
      eagles++;
    } else if (score === par - 1) {
      birdies++;
    } else if (score === par) {
      pars++;
    } else if (score === par + 1) {
      bogeys++;
    } else {
      doublePlus++;
    }

    // GIR tracking (green in regulation)
    // Use actual GIR data if available, otherwise estimate conservatively
    const holeDetail = player.holeDetails?.[holeIndex];
    if (holeDetail && typeof holeDetail.greens === 'boolean') {
      if (holeDetail.greens) {
        girHit++;
      }
    } else if (score <= par - 1) {
      // Only assume GIR for eagles and birdies when no data available
      girHit++;
    }

        // Fairway tracking (assume par 4+ have fairways)
    if (par >= 4) {
      fairwaysAttempted++;
      // Use actual fairway data if available
      if (holeDetail && typeof holeDetail.fairways === 'boolean') {
        if (holeDetail.fairways) {
          fairwaysHit++;
        }
      }
      // If no fairway data available, don't make assumptions
    }
  });

  const holesPlayed = scores.length;
  const scoreToPar = totalScore - (Object.values(coursePars).slice(0, holesPlayed).reduce((a, b) => a + b, 0));
  const scoreToParString = scoreToPar > 0 ? `+${scoreToPar}` : scoreToPar === 0 ? 'E' : `${scoreToPar}`;
  
  const fairwaysPercent = fairwaysAttempted > 0 ? Math.round((fairwaysHit / fairwaysAttempted) * 100) : 0;
  const greensPercent = holesPlayed > 0 ? Math.round((girHit / holesPlayed) * 100) : 0;
  const avgPutts = (totalPutts / holesPlayed).toFixed(1);

  return {
    playerId: player.playerId,
    playerName: player.name,
    holesPlayed,
    totalScore,
    scoreToParString,
    eagles,
    birdies,
    pars,
    bogeys,
    doublePlus,
    fairwaysHit,
    fairwaysAttempted,
    fairwaysPercent,
    girHit,
    greensPercent,
    totalPutts,
    avgPutts
  };
}
