import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();
const LEVEL_KEYS = ['1','2','3','4','5'] as const;
type LevelKey = typeof LEVEL_KEYS[number];

function mapRow(row: any) {
  if (!row) return { levels: {}, lastUpdated: null };
  const levels: Record<string, { games: number; wins: number }> = {};
  for (const k of LEVEL_KEYS) {
    levels[k] = {
      games: row[`level${k}Games`] ?? 0,
      wins: row[`level${k}Wins`] ?? 0
    };
  }
  return { levels, lastUpdated: row.lastUpdated ? new Date(row.lastUpdated).toISOString() : null };
}

async function ensureRow() {
  const row = await prisma.aiStats.findUnique({ where: { id: 'global' } });
  if (!row) await prisma.aiStats.create({ data: { id: 'global' } });
}

export async function GET() {
  await ensureRow();
  const row = await prisma.aiStats.findUnique({ where: { id: 'global' } });
  return new Response(JSON.stringify(mapRow(row)), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req: NextRequest) {
  try {
    const incoming = (await req.json()) as any;
    if (!incoming || typeof incoming !== 'object' || !incoming.levels) {
      return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400 });
    }
    await ensureRow();
    const update: Record<string, any> = { lastUpdated: new Date() };
    for (const k of LEVEL_KEYS) {
      const inc = incoming.levels[k];
      if (inc && typeof inc.games === 'number' && typeof inc.wins === 'number') {
        // merge via max like before
        // need current values
        const row = await prisma.aiStats.findUnique({ where: { id: 'global' }, select: { [`level${k}Games`]: true, [`level${k}Wins`]: true } as any });
        const curGames = (row as any)?.[`level${k}Games`] ?? 0;
        const curWins = (row as any)?.[`level${k}Wins`] ?? 0;
        const gField = `level${k}Games`;
        const wField = `level${k}Wins`;
        if (inc.games > curGames) update[gField] = inc.games; // set absolute
        if (inc.wins > curWins) update[wField] = inc.wins;
      }
    }
    const saved = await prisma.aiStats.update({ where: { id: 'global' }, data: update });
    return new Response(JSON.stringify(mapRow(saved)), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return new Response(JSON.stringify({ error: 'Save failed', detail: msg }), { status: 500 });
  }
}
