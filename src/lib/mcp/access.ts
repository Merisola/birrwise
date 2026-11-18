import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const MCP_KEY_SETTING = 'mcpKey';
export const MCP_ENABLED_SETTING = 'mcpEnabled';

export interface McpAccessState {
  enabled: boolean;
  key: string | null;
}

export async function getMcpState(): Promise<McpAccessState> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [MCP_KEY_SETTING, MCP_ENABLED_SETTING] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    enabled: map.get(MCP_ENABLED_SETTING) === 'true',
    key: map.get(MCP_KEY_SETTING) || null,
  };
}

/** Constant-time compare (hashed first to avoid length leakage). */
export function keyMatches(presented: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(presented).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function generateMcpKey(): string {
  return 'mcp_' + crypto.randomBytes(32).toString('base64url');
}

/** Mask all but the last 4 characters for display. */
export function maskKey(key: string): string {
  if (!key) return '';
  const tail = key.slice(-4);
  return 'mcp_' + '•'.repeat(12) + tail;
}
