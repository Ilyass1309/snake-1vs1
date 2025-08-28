import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic'; // ensure not cached

interface AILevelStats { games: number; wins: number; }
interface AIStatsFile { levels: Record<string, AILevelStats>; lastUpdated: string | null; }

const FILE_PATH = path.join(process.cwd(), 'data', 'ai-stats.json');
const LEVEL_KEYS = ['1','2','3','4','5'] as const;

async function loadFile(): Promise<AIStatsFile> {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const data = JSON.parse(raw) as AIStatsFile;
    for (const k of LEVEL_KEYS) {
      if (!data.levels[k]) data.levels[k] = { games:0, wins:0 };
    }
    return data;
  } catch {
  return { levels: { '1': { games:0, wins:0 }, '2': { games:0, wins:0 }, '3': { games:0, wins:0 }, '4': { games:0, wins:0 }, '5': { games:0, wins:0 } }, lastUpdated: null };
  }
}

async function saveFile(stats: AIStatsFile) {
  stats.lastUpdated = new Date().toISOString();
  await fs.writeFile(FILE_PATH, JSON.stringify(stats, null, 2), 'utf8');
}

export async function GET() {
  const stats = await loadFile();
  return new Response(JSON.stringify(stats), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  try {
    const incoming = (await req.json()) as Partial<AIStatsFile> | undefined;
    if (!incoming || typeof incoming !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
    }
    const current = await loadFile();
    // Merge additive (on ajoute les nouvelles valeurs si supérieures)
    if (incoming.levels) {
      for (const k of LEVEL_KEYS) {
        const inc = incoming.levels[k];
        if (inc) {
          const cur = current.levels[k] || { games:0, wins:0 };
          // On prend la valeur max (au cas où client renvoie déjà cumulée) ou on additionne ? Ici on choisit max pour éviter double comptage.
          current.levels[k] = {
            games: Math.max(cur.games, inc.games),
            wins: Math.max(cur.wins, inc.wins)
          };
        }
      }
    }
    await saveFile(current);
    return new Response(JSON.stringify(current), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return new Response(JSON.stringify({ error: 'Save failed', detail: msg }), { status: 500 });
  }
}
