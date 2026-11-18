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
    };

    settingsList.forEach((s) => {
      // MCP credentials are never exposed here (masked preview only).
      if (s.key === 'mcpKey') return;
      if (s.value === 'true') defaults[s.key] = true;
      else if (s.value === 'false') defaults[s.key] = false;
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
    ]);

    for (const [key, val] of Object.entries(body)) {
      if (!ALLOWED.has(String(key))) continue;
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(val) },
        create: { key, value: String(val) },
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
