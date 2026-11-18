import { handleMcpRequest } from '@/lib/mcp/handle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function GET() {
  // Stateless server: no SSE stream to offer.
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: 'POST' },
  });
}

export async function DELETE() {
  return GET();
}
