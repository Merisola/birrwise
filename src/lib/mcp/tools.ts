import { ToolDef } from './helpers';
import { readTools } from './readTools';
import { moreReadTools } from './readTools2';
import { writeTools } from './writeTools';
import { stageTools } from './stageTools';
import { stageDeleteTools } from './stageDeleteTools';
import { confirmTools } from './confirmTools';
import { wishlistReadTools, wishlistWriteTools, wishlistStageTools } from './wishlistTools';

export const MCP_TOOLS: ToolDef[] = [
  ...readTools,
  ...moreReadTools,
  ...wishlistReadTools,
  ...writeTools,
  ...wishlistWriteTools,
  ...stageTools,
  ...wishlistStageTools,
  ...stageDeleteTools,
  ...confirmTools,
];

export function publicToolList() {
  return MCP_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}
