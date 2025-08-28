
import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';


export const dynamic = 'force-dynamic';


const LEVELS = ['1','2','3','4','5'] as const;
type LevelKey = typeof LEVELS[number];
const FILE_PATH = path.join(process.cwd(), 'data', 'ai-stats.json');

interface AILevelStats { games: number; wins: number; }
interface AIStatsFile { levels: Record<string, AILevelStats>; lastUpdated: string | null; }

async function loadFile(): Promise<AIStatsFile> {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const data = JSON.parse(raw) as AIStatsFile;
    for (const k of LEVELS) if (!data.levels[k]) data.levels[k] = { games:0, wins:0 };
    return data;
  } catch {
    const base: AIStatsFile = { levels: {}, lastUpdated: null };
    for (const k of LEVELS) base.levels[k] = { games:0, wins:0 };
    return base;
  }
}

async function saveFile(stats: AIStatsFile) {
  stats.lastUpdated = new Date().toISOString();
  await fs.writeFile(FILE_PATH, JSON.stringify(stats, null, 2), 'utf8');
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { aiLevel, winner } = body || {};
    const lvlKey = String(aiLevel) as LevelKey;
    if (!LEVELS.includes(lvlKey) || !['player','ai','draw'].includes(winner)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }
    const stats = await loadFile();
    if (!stats.levels[lvlKey]) stats.levels[lvlKey] = { games:0, wins:0 };
    stats.levels[lvlKey].games += 1;
    if (winner === 'ai') stats.levels[lvlKey].wins += 1;
    await saveFile(stats);
    return new Response(JSON.stringify({ ok:true, stats }), { status: 200, headers: { 'Content-Type':'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return new Response(JSON.stringify({ error: 'Increment failed', detail: msg }), { status: 500 });
  }
}


export async function GET() {
  const stats = await loadFile();
  return new Response(JSON.stringify(stats), { status: 200, headers: { 'Content-Type':'application/json' } });
}