import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type PendingKind =
  | 'txn.create'
  | 'txn.update'
  | 'txn.delete'
  | 'txn.setLabel'
  | 'budget.delete'
  | 'category.delete'
  | 'rule.delete';

export interface PendingActionPayload {
  kind: PendingKind;
  args: Record<string, any>;
  preview: Record<string, any>;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function stageAction(
  kind: PendingKind,
  args: Record<string, any>,
  preview: Record<string, any>
): Promise<{ id: string; token: string; expiresAt: Date }> {
  const token = 'mcp_cf_' + crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS);
  const created = await prisma.pendingAction.create({
    data: {
      kind,
      payload: JSON.stringify({ kind, args, preview }),
      tokenHash: hashToken(token),
      expiresAt,
    },
  });
  return { id: created.id, token, expiresAt };
}

export async function findPendingAction(token: string) {
  return prisma.pendingAction.findUnique({
    where: { tokenHash: hashToken(token) },
  });
}

export async function consumePendingAction(id: string): Promise<void> {
  await prisma.pendingAction.update({
    where: { id },
    data: { consumedAt: new Date() },
  });
}

export async function cancelPendingAction(id: string): Promise<void> {
  await prisma.pendingAction.update({
    where: { id },
    data: { consumedAt: new Date() },
  });
}

export async function listPendingActions() {
  const now = new Date();
  const rows = await prisma.pendingAction.findMany({
    where: { consumedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    preview: safeParse(r.payload)?.preview ?? null,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }));
}

export function safeParse(text: string): PendingActionPayload | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && parsed.kind) return parsed;
    return null;
  } catch {
    return null;
  }
}
