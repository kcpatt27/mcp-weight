import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const tools = [
  {
    name: "fixture_alpha",
    description: "A tiny tool that echoes a string. Used by the end-to-end test.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Text to echo." } },
      required: ["text"],
    },
  },
  {
    name: "fixture_beta",
    description:
      "A deliberately verbose tool. ".repeat(8) +
      "It exists so mcp-weight has a measurably heavier tool to tokenize.",
    inputSchema: {
      type: "object",
      properties: {
        n: { type: "number", description: "A number." },
        mode: { type: "string", enum: ["fast", "slow"] },
      },
    },
  },
  {
    name: "fixture_gamma",
    description: "A no-argument fixture tool.",
    inputSchema: { type: "object", properties: {} },
  },
];

const server = new Server(
  { name: "mcp-weight-fixture", version: "9.9.9" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

await server.connect(new StdioServerTransport());