import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();
const LEVELS = ['1','2','3','4','5'] as const;
type LevelKey = typeof LEVELS[number];

async function ensureRow() {
  const row = await prisma.aiStats.findUnique({ where: { id: 'global' } });
  if (!row) {
    await prisma.aiStats.create({ data: { id: 'global' } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { aiLevel, winner } = body || {};
  const lvlKey = String(aiLevel) as LevelKey;
  if (!LEVELS.includes(lvlKey) || !['player','ai','draw'].includes(winner)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }
    await ensureRow();
    const dataUpdate: Record<string, any> = { lastUpdated: new Date() };
  const gField = `level${lvlKey}Games` as keyof typeof dataUpdate;
  const wField = `level${lvlKey}Wins` as keyof typeof dataUpdate;
    (dataUpdate as any)[gField] = { increment: 1 };
    if (winner === 'ai') (dataUpdate as any)[wField] = { increment: 1 };
    const updated = await prisma.aiStats.update({ where: { id: 'global' }, data: dataUpdate });
    return new Response(JSON.stringify({ ok:true, stats: updated }), { status: 200, headers: { 'Content-Type':'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return new Response(JSON.stringify({ error: 'Increment failed', detail: msg }), { status: 500 });
  }
}

export async function GET() {
  await ensureRow();
  const stats = await prisma.aiStats.findUnique({ where: { id: 'global' } });
  return new Response(JSON.stringify(stats), { status: 200, headers: { 'Content-Type':'application/json' } });
}