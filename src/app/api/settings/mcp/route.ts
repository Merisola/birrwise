import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getMcpState,
  generateMcpKey,
  maskKey,
  MCP_ENABLED_SETTING,
  MCP_KEY_SETTING,
} from '@/lib/mcp/access';

/**
 * MCP access management for the single logged-in user.
 * Session-protected by the app middleware (cookie auth).
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    const state = await getMcpState();

    switch (action) {
      case 'enable': {
        let generated = false;
        let key: string | null = null;
        if (!state.key) {
          key = generateMcpKey();
          generated = true;
          await prisma.setting.upsert({
            where: { key: MCP_KEY_SETTING },
            update: { value: key },
            create: { key: MCP_KEY_SETTING, value: key },
          });
        }
        await prisma.setting.upsert({
          where: { key: MCP_ENABLED_SETTING },
          update: { value: 'true' },
          create: { key: MCP_ENABLED_SETTING, value: 'true' },
        });
        return NextResponse.json({
          success: true,
          enabled: true,
          generated,
          ...(generated ? { key } : {}),
        });
      }
      case 'disable': {
        await prisma.setting.upsert({
          where: { key: MCP_ENABLED_SETTING },
          update: { value: 'false' },
          create: { key: MCP_ENABLED_SETTING, value: 'false' },
        });
        return NextResponse.json({ success: true, enabled: false });
      }
      case 'rotate': {
        const key = generateMcpKey();
        await prisma.setting.upsert({
          where: { key: MCP_KEY_SETTING },
          update: { value: key },
          create: { key: MCP_KEY_SETTING, value: key },
        });
        return NextResponse.json({ success: true, key, enabled: state.enabled });
      }
      case 'reveal': {
        if (!state.key) {
          return NextResponse.json({ error: 'No MCP key yet' }, { status: 404 });
        }
        return NextResponse.json({ key: state.key, enabled: state.enabled });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error managing MCP access:', error);
    return NextResponse.json(
      { error: 'Failed to manage MCP access' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
