import { api, json, readBody } from "@/lib/http";
import { handleMcpRpcRequest, KADRA_MCP_TOOLS, MCP_RPC_REQUEST_SCHEMA } from "@/lib/mcp-server";
import { MCP_AGENT_SKILLS } from "@/lib/studio-draft";
import { AppError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return api(request, async () =>
    json({
      protocol: "mcp",
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: "kadra-higgsfield-mcp",
        version: "2.0.0",
      },
      tools: KADRA_MCP_TOOLS,
      skills: MCP_AGENT_SKILLS,
    }),
  );
}

export async function POST(request: Request) {
  return api(request, async () => {
    const site = request.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") {
      throw new AppError(403, "Farklı bir siteden MCP isteği gönderilemez.");
    }
    const rpcReq = await readBody(request, MCP_RPC_REQUEST_SCHEMA);
    const rpcRes = await handleMcpRpcRequest(rpcReq);
    return json(rpcRes);
  });
}
