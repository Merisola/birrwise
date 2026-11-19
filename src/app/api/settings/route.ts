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
      wishlistCushion: null, // manual late-salary runway (ETB)
      wishlistIncomeOverride: null, // manual average income (ETB); unlocks cyclesAway
      wishlistCoolingDays: 14, // cooling-off before "Ready" (0-365)
      wishlistExcludedCategories: [] as string[], // one-off categories excluded from surplus estimate
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
      else if (s.key === 'wishlistCushion' || s.key === 'wishlistIncomeOverride') {
        const n = Number(s.value);
        defaults[s.key] = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
      }
      else if (s.key === 'wishlistCoolingDays') {
        const n = Number(s.value);
        defaults[s.key] = Number.isFinite(n) && n >= 0 ? Math.min(365, Math.floor(n)) : 14;
      }
      else if (s.key === 'wishlistExcludedCategories') {
        try {
          const parsed = JSON.parse(s.value);
          defaults[s.key] = Array.isArray(parsed)
            ? parsed.filter((x): x is string => typeof x === 'string')
            : [];
        } catch {
          defaults[s.key] = [];
        }
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
      'wishlistCushion',
      'wishlistIncomeOverride',
      'wishlistCoolingDays',
      'wishlistExcludedCategories',
    ]);

    for (const [key, val] of Object.entries(body)) {
      if (!ALLOWED.has(String(key))) continue;

      // Wishlist values validate and store as JSON/normalized strings.
      if (key === 'wishlistCushion' || key === 'wishlistIncomeOverride') {
        // Empty string / null clears the setting.
        if (val === '' || val === null || val === undefined) {
          await prisma.setting.deleteMany({ where: { key } });
          continue;
        }
        const n = Number(val);
        if (!Number.isFinite(n) || n < 0) continue;
        if (key === 'wishlistIncomeOverride' && n <= 0) continue; // income must be positive
        const value = String(Math.round(n * 100) / 100);
        await prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
        continue;
      }
      if (key === 'wishlistCoolingDays') {
        const n = Number(val);
        const value = Number.isFinite(n) ? String(Math.max(0, Math.min(365, Math.floor(n)))) : '14';
        await prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
        continue;
      }
      if (key === 'wishlistExcludedCategories') {
        let list: unknown = val;
        if (typeof val === 'string') {
          try { list = JSON.parse(val); } catch { continue; }
        }
        if (!Array.isArray(list)) continue;
        const cleaned = Array.from(
          new Set(
            list
              .filter((x): x is string => typeof x === 'string')
              .map((x) => x.trim().slice(0, 80))
              .filter(Boolean)
          )
        ).slice(0, 50);
        await prisma.setting.upsert({
          where: { key },
          update: { value: JSON.stringify(cleaned) },
          create: { key, value: JSON.stringify(cleaned) },
        });
        continue;
      }

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
