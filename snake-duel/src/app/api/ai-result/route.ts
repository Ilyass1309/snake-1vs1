
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
  // Désactivé pour déploiement Vercel : ne fait rien, retourne juste ok
  return new Response(JSON.stringify({ ok:true, disabled:true }), { status: 200, headers: { 'Content-Type':'application/json' } });
}


export async function GET() {
  const stats = await loadFile();
  return new Response(JSON.stringify(stats), { status: 200, headers: { 'Content-Type':'application/json' } });
}