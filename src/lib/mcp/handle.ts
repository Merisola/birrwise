import { getMcpState, keyMatches } from './access';
import { MCP_TOOLS, publicToolList } from './tools';

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'birrwise-mcp', version: '1.1.0' };
const INSTRUCTIONS = [
  'Birrwise is a personal finance ledger.',
  'READ freely: summary, accounts, transactions, budgets, categories, rules, settings (never API keys), wishlist.',
  'WRITE freely only for: budgets, categories, rules, accounts, settings, wishlist items (add/edit).',
  'TRANSACTIONS, wishlist PURCHASES and ALL DELETES are two-level: call the stage_* tool first, show the preview to the user, wait for explicit approval, and ONLY then call confirm_action(token). Never confirm without the user saying yes.',
  'Amounts are always positive; the type field carries direction (income/expense/transfer). Transfers are excluded from income/expense totals.',
  'Wishlist purchases are atomic and hard-blocked when the chosen account is short. Items still cooling off need acknowledgeCooling=true at stage time, and only after the user explicitly agrees to buy during cooling-off. Budget conflicts and budget pace are warnings, not blocks.',
].join(' ');

function json(body: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function rpcResult(result: any, id: any) {
  return json({ jsonrpc: '2.0', id, result });
}

function rpcError(code: number, message: string, id: any) {
  return json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}

export async function handleMcpRequest(
  req: Request,
  pathKey?: string
): Promise<Response> {
  const state = await getMcpState();

  // Disabled or no key configured: do not advertise the endpoint's existence.
  if (!state.enabled || !state.key) {
    return json({ error: 'Not found' }, 404);
  }

  const authHeader = req.headers.get('authorization') || '';
  const headerKey = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const presented = headerKey || (pathKey || '').trim();
  if (!presented || !keyMatches(presented, state.key)) {
    return json({ error: 'Unauthorized' }, 401, {
      'WWW-Authenticate': 'Bearer',
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
  }

  let msg: any;
  try {
    msg = await req.json();
  } catch {
    return rpcError(-32700, 'Parse error', null);
  }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    return rpcError(-32600, 'Invalid Request: expected a single JSON-RPC message', null);
  }

  const { id, method, params } = msg;

  // Notifications carry no id and expect no response body.
  if (id === undefined || id === null) {
    if (
      typeof method === 'string' &&
      (method.startsWith('notifications/') || method === 'ping')
    ) {
      return new Response(null, { status: 202 });
    }
    return rpcError(-32600, 'Invalid Request', null);
  }

  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion;
      const protocolVersion =
        typeof requested === 'string' &&
        SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : SUPPORTED_PROTOCOL_VERSIONS[0];
      return rpcResult(
        {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
        id
      );
    }
    case 'ping':
      return rpcResult({}, id);
    case 'tools/list':
      return rpcResult({ tools: publicToolList() }, id);
    case 'tools/call': {
      const name = params?.name;
      const tool = MCP_TOOLS.find((t) => t.name === name);
      if (!tool) {
        return rpcError(-32602, `Unknown tool: ${String(name)}`, id);
      }
      try {
        const result = await tool.handler(params?.arguments ?? {});
        return rpcResult(
          {
            content: [
              { type: 'text', text: JSON.stringify(result, null, 2) },
            ],
          },
          id
        );
      } catch (error: any) {
        const message =
          error instanceof Error ? error.message : 'Tool execution failed';
        return rpcResult(
          {
            content: [{ type: 'text', text: `Error: ${message}` }],
            isError: true,
          },
          id
        );
      }
    }
    default:
      return rpcError(-32601, `Method not found: ${String(method)}`, id);
  }
}
