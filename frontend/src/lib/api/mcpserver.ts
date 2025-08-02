import { MCPServerCreate, MCPServerUpdate, MCPServerResponse } from "@/lib/types/mcpserver";

export async function getAllMCPServers(apiKey: string): Promise<MCPServerResponse[]> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/mcp-servers`,
    {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch MCP servers: ${response.status} ${response.statusText}`,
    );
  }

  const mcpServers = await response.json();
  return mcpServers;
}

export async function getMCPServer(
  mcpServerId: string,
  apiKey: string,
): Promise<MCPServerResponse> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/mcp-servers/${mcpServerId}`,
    {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch MCP server: ${response.status} ${response.statusText}`,
    );
  }

  const mcpServer = await response.json();
  return mcpServer;
}

export async function createMCPServer(
  data: MCPServerCreate,
  apiKey: string,
): Promise<MCPServerResponse> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/mcp-servers`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to create MCP server: ${response.status} ${response.statusText}`,
    );
  }

  const mcpServer = await response.json();
  return mcpServer;
}

export async function updateMCPServer(
  mcpServerId: string,
  data: MCPServerUpdate,
  apiKey: string,
): Promise<MCPServerResponse> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/mcp-servers/${mcpServerId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to update MCP server: ${response.status} ${response.statusText}`,
    );
  }

  const mcpServer = await response.json();
  return mcpServer;
}

export async function deleteMCPServer(
  mcpServerId: string,
  apiKey: string,
): Promise<void> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/mcp-servers/${mcpServerId}`,
    {
      method: "DELETE",
      headers: {
        "X-API-KEY": apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to delete MCP server: ${response.status} ${response.statusText}`,
    );
  }
}

export async function addToolToMCPServer(
  mcpServerId: string,
  toolFunctionId: string,
  apiKey: string,
): Promise<MCPServerResponse> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/mcp-servers/${mcpServerId}/tools/${toolFunctionId}`,
    {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to add tool to MCP server: ${response.status} ${response.statusText}`,
    );
  }

  const mcpServer = await response.json();
  return mcpServer;
}

export async function removeToolFromMCPServer(
  mcpServerId: string,
  toolFunctionId: string,
  apiKey: string,
): Promise<MCPServerResponse> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/mcp-servers/${mcpServerId}/tools/${toolFunctionId}`,
    {
      method: "DELETE",
      headers: {
        "X-API-KEY": apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to remove tool from MCP server: ${response.status} ${response.statusText}`,
    );
  }

  const mcpServer = await response.json();
  return mcpServer;
}
