import { handleMcpRequest } from '@/lib/mcp/handle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Secret-URL variant for clients that cannot send an Authorization header
// (e.g. Claude Desktop / ChatGPT custom connectors).
export async function POST(
  request: Request,
  { params }: { params: { key: string } }
) {
  return handleMcpRequest(request, params.key);
}

export async function GET(
  _request: Request,
  { params: _params }: { params: { key: string } }
) {
  void _params;
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: 'POST' },
  });
}
