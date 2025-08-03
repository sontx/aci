import { MCPServerCreate, MCPServerUpdate, MCPServerResponse } from "@/lib/types/mcpserver";
import axiosInstance from "@/lib/axios";

export async function getAllMCPServers(): Promise<MCPServerResponse[]> {
  const response = await axiosInstance.get('/v1/mcp-servers');
  return response.data;
}

export async function getMCPServer(mcpServerId: string): Promise<MCPServerResponse> {
  const response = await axiosInstance.get(`/v1/mcp-servers/${mcpServerId}`);
  return response.data;
}

export async function createMCPServer(data: MCPServerCreate): Promise<MCPServerResponse> {
  const response = await axiosInstance.post('/v1/mcp-servers', data);
  return response.data;
}

export async function updateMCPServer(
  mcpServerId: string,
  data: MCPServerUpdate,
): Promise<MCPServerResponse> {
  const response = await axiosInstance.put(`/v1/mcp-servers/${mcpServerId}`, data);
  return response.data;
}

export async function deleteMCPServer(mcpServerId: string): Promise<void> {
  await axiosInstance.delete(`/v1/mcp-servers/${mcpServerId}`);
}

export async function addToolToMCPServer(
  mcpServerId: string,
  toolFunctionId: string,
): Promise<MCPServerResponse> {
  const response = await axiosInstance.post(
    `/v1/mcp-servers/${mcpServerId}/tools/${toolFunctionId}`
  );
  return response.data;
}

export async function removeToolFromMCPServer(
  mcpServerId: string,
  toolFunctionId: string,
): Promise<MCPServerResponse> {
  const response = await axiosInstance.delete(
    `/v1/mcp-servers/${mcpServerId}/tools/${toolFunctionId}`
  );
  return response.data;
}
