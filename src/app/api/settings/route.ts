import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const settingsList = await prisma.setting.findMany();
    const defaults: Record<string, any> = {
      workspace: 'My workspace',
      currency: 'ETB',
      dateFormat: 'DD/MM/YYYY',
      budget80: true,
      budget100: true,
      review: true,
      cycleStartDay: 7, // default pay-cycle start day (1-28)
    };

    settingsList.forEach((s) => {
      // MCP credentials are never exposed here (masked preview only).
      if (s.key === 'mcpKey') return;
      if (s.value === 'true') defaults[s.key] = true;
      else if (s.value === 'false') defaults[s.key] = false;
      else if (s.key === 'cycleStartDay') {
        const n = Number(s.value);
        defaults[s.key] = Number.isFinite(n) && n >= 1 && n <= 28 ? Math.floor(n) : 7;
      }
      else defaults[s.key] = s.value;
    });

    const mcpKeyRow = settingsList.find((s) => s.key === 'mcpKey');
    defaults.mcpEnabled = settingsList.some(
      (s) => s.key === 'mcpEnabled' && s.value === 'true'
    );
    defaults.hasMcpKey = Boolean(mcpKeyRow?.value);
    defaults.mcpKeyPreview = mcpKeyRow?.value
      ? 'mcp_' + '•'.repeat(12) + mcpKeyRow.value.slice(-4)
      : null;

    return NextResponse.json(defaults);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Strict allowlist: MCP credentials are managed only via /api/settings/mcp,
    // and client-side MCP metadata (hasMcpKey, mcpKeyPreview…) is never stored.
    const ALLOWED = new Set([
      'workspace',
      'currency',
      'dateFormat',
      'budget80',
      'budget100',
      'review',
      'cycleStartDay',
    ]);

    for (const [key, val] of Object.entries(body)) {
      if (!ALLOWED.has(String(key))) continue;
      let value = String(val);
      if (key === 'cycleStartDay') {
        // Clamp to 1-28; invalid values fall back to 7.
        const n = Number(val);
        if (!Number.isFinite(n) || n < 1 || n > 28) value = '7';
        else value = String(Math.floor(n));
      }
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return NextResponse.json({ success: true, settings: body });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
