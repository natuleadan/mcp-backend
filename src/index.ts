import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { seedTools } from "./tools/seed.tools.js";
import { queryTools } from "./tools/query.tools.js";
import { executeTools } from "./tools/execute.tools.js";
import { storageTools } from "./tools/storage.tools.js";
import { rpcTools } from "./tools/rpc.tools.js";
import { icebergTools } from "./tools/iceberg.tools.js";
import { bootstrapTools } from "./tools/bootstrap.tools.js";

const server = new McpServer({
  name: "mcp-backend",
  version: "1.0.0",
});

const allTools = [...seedTools, ...queryTools, ...executeTools, ...storageTools, ...rpcTools, ...icebergTools, ...bootstrapTools];

for (const tool of allTools) {
  server.tool(tool.name, tool.description, tool.inputSchema.shape, async (args) => {
    try {
      const result = await tool.handler(args as never);
      return { content: [{ type: "text" as const, text: String(result) }] };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `❌ Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("mcp-backend running on stdio");
