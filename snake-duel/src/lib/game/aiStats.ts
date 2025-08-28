// Gestion des statistiques IA (winrate par niveau)
// Stockage persistant côté client (localStorage) + fichier JSON initial (fallback build time)

export interface AILevelStats { games: number; wins: number; }
export interface AIStatsFile { levels: Record<string, AILevelStats>; lastUpdated: string | null; }

const LS_KEY = 'snake_ai_stats_v1';
const API_URL = '/api/ai-stats';
const API_INCREMENT_URL = '/api/ai-result';

const empty: AIStatsFile = {
  levels: { '1': { games:0, wins:0 }, '2': { games:0, wins:0 }, '3': { games:0, wins:0 }, '4': { games:0, wins:0 }, '5': { games:0, wins:0 } },
  lastUpdated: null
};

export function loadAIStats(): AIStatsFile {
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as AIStatsFile;
      // normalise clés
  for (const lvl of ['1','2','3','4','5']) {
        if (!data.levels[lvl]) data.levels[lvl] = { games:0, wins:0 };
      }
      return data;
    }
  } catch {}
  return empty;
}

export function saveAIStats(stats: AIStatsFile) {
  if (typeof window === 'undefined') return;
  try {
    stats.lastUpdated = new Date().toISOString();
    localStorage.setItem(LS_KEY, JSON.stringify(stats));
    // Sync serveur (fire & forget)
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stats)
    }).catch(()=>{});
  } catch {}
}

export function recordGameResult(aiLevel: number, winner: 'player' | 'ai' | 'draw') {
  const stats = loadAIStats();
  const key = String(aiLevel) as '1'|'2'|'3'|'4'|'5';
  if (!stats.levels[key]) stats.levels[key] = { games:0, wins:0 };
  stats.levels[key].games += 1;
  if (winner === 'ai') stats.levels[key].wins += 1;
  saveAIStats(stats);
  // Envoie un incrément serveur (données minimales) pour éviter double comptage entre onglets
  try { fetch(API_INCREMENT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ aiLevel, winner }) }).catch(()=>{}); } catch {}
  return stats;
}

export function computeWinrate(l: AILevelStats): number {
  if (!l.games) return 0;
  return +( (l.wins / l.games) * 100 ).toFixed(1);
}
