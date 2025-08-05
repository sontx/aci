"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllMCPServers,
  getMCPServer,
  createMCPServer,
  updateMCPServer,
  deleteMCPServer,
  addToolToMCPServer,
  removeToolFromMCPServer,
  regenerateMCPLink,
} from "@/lib/api/mcpserver";
import { useMetaInfo } from "@/components/context/metainfo";
import {
  MCPServerCreate,
  MCPServerUpdate,
  MCPServerResponse,
} from "@/lib/types/mcpserver";
import { toast } from "sonner";

export const mcpServerKeys = {
  all: (projectId: string) => [projectId, "mcpservers"] as const,
  detail: (projectId: string, mcpServerId: string) =>
    [projectId, "mcpservers", mcpServerId] as const,
};

export const useMCPServers = () => {
  const { activeProject } = useMetaInfo();

  return useQuery<MCPServerResponse[], Error>({
    queryKey: mcpServerKeys.all(activeProject.id),
    queryFn: () => getAllMCPServers(),
  });
};

export const useMCPServer = (mcpServerId?: string) => {
  const { activeProject } = useMetaInfo();

  return useQuery<MCPServerResponse, Error>({
    queryKey: mcpServerKeys.detail(activeProject.id, mcpServerId || ""),
    queryFn: () => getMCPServer(mcpServerId!),
    enabled: !!mcpServerId,
  });
};

export const useCreateMCPServer = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<MCPServerResponse, Error, MCPServerCreate>({
    mutationFn: (data) => createMCPServer(data),
    onSuccess: (newMCPServer) => {
      queryClient.setQueryData<MCPServerResponse[]>(
        mcpServerKeys.all(activeProject.id),
        (old = []) => [...old, newMCPServer],
      );
      queryClient.invalidateQueries({
        queryKey: mcpServerKeys.all(activeProject.id),
      });
      toast.success("MCP server created successfully");
    },
    onError: (error) => {
      console.error("Create MCP server failed:", error);
      toast.error("Failed to create MCP server");
    },
  });
};

type UpdateMCPServerParams = {
  mcpServerId: string;
  data: MCPServerUpdate;
};

export const useUpdateMCPServer = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<MCPServerResponse, Error, UpdateMCPServerParams>({
    mutationFn: (params) => updateMCPServer(params.mcpServerId, params.data),
    onSuccess: (updatedMCPServer, variables) => {
      queryClient.setQueryData<MCPServerResponse[]>(
        mcpServerKeys.all(activeProject.id),
        (old = []) =>
          old.map((server) =>
            server.id === variables.mcpServerId ? updatedMCPServer : server,
          ),
      );
      queryClient.invalidateQueries({
        queryKey: mcpServerKeys.all(activeProject.id),
      });
      queryClient.invalidateQueries({
        queryKey: mcpServerKeys.detail(activeProject.id, variables.mcpServerId),
      });
      toast.success("MCP server updated successfully");
    },
    onError: (error) => {
      console.error("Update MCP server failed:", error);
      toast.error("Failed to update MCP server");
    },
  });
};

export const useDeleteMCPServer = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<void, Error, string>({
    mutationFn: (mcpServerId) => deleteMCPServer(mcpServerId),
    onSuccess: (_, mcpServerId) => {
      queryClient.setQueryData<MCPServerResponse[]>(
        mcpServerKeys.all(activeProject.id),
        (old = []) => old.filter((server) => server.id !== mcpServerId),
      );
      queryClient.invalidateQueries({
        queryKey: mcpServerKeys.all(activeProject.id),
      });
      queryClient.removeQueries({
        queryKey: mcpServerKeys.detail(activeProject.id, mcpServerId),
      });
      toast.success("MCP server deleted successfully");
    },
    onError: (error) => {
      console.error("Delete MCP server failed:", error);
      toast.error("Failed to delete MCP server");
    },
  });
};

type AddToolParams = {
  mcpServerId: string;
  toolFunctionId: string;
};

export const useAddToolToMCPServer = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<MCPServerResponse, Error, AddToolParams>({
    mutationFn: (params) =>
      addToolToMCPServer(params.mcpServerId, params.toolFunctionId),
    onSuccess: (updatedMCPServer, variables) => {
      queryClient.setQueryData<MCPServerResponse[]>(
        mcpServerKeys.all(activeProject.id),
        (old = []) =>
          old.map((server) =>
            server.id === variables.mcpServerId ? updatedMCPServer : server,
          ),
      );
      queryClient.invalidateQueries({
        queryKey: mcpServerKeys.all(activeProject.id),
      });
      queryClient.invalidateQueries({
        queryKey: mcpServerKeys.detail(activeProject.id, variables.mcpServerId),
      });
      toast.success("Tool added to MCP server successfully");
    },
    onError: (error) => {
      console.error("Add tool to MCP server failed:", error);
      toast.error("Failed to add tool to MCP server");
    },
  });
};

type RemoveToolParams = {
  mcpServerId: string;
  toolFunctionId: string;
};

export const useRemoveToolFromMCPServer = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<MCPServerResponse, Error, RemoveToolParams>({
    mutationFn: (params) =>
      removeToolFromMCPServer(params.mcpServerId, params.toolFunctionId),
    onSuccess: (updatedMCPServer, variables) => {
      queryClient.setQueryData<MCPServerResponse[]>(
        mcpServerKeys.all(activeProject.id),
        (old = []) =>
          old.map((server) =>
            server.id === variables.mcpServerId ? updatedMCPServer : server,
          ),
      );
      queryClient.invalidateQueries({
        queryKey: mcpServerKeys.all(activeProject.id),
      });
      queryClient.invalidateQueries({
        queryKey: mcpServerKeys.detail(activeProject.id, variables.mcpServerId),
      });
      toast.success("Tool removed from MCP server successfully");
    },
    onError: (error) => {
      console.error("Remove tool from MCP server failed:", error);
      toast.error("Failed to remove tool from MCP server");
    },
  });
};

export const useRegenerateMCPLink = () => {
  const queryClient = useQueryClient();
  const { activeProject } = useMetaInfo();

  return useMutation<MCPServerResponse, Error, string>({
    mutationFn: (mcpServerId) => regenerateMCPLink(mcpServerId),
    onSuccess: (updatedMCPServer, mcpServerId) => {
      queryClient.setQueryData<MCPServerResponse[]>(
        mcpServerKeys.all(activeProject.id),
        (old = []) =>
          old.map((server) =>
            server.id === mcpServerId ? updatedMCPServer : server,
          ),
      );
      queryClient.invalidateQueries({
        queryKey: mcpServerKeys.all(activeProject.id),
      });
      queryClient.invalidateQueries({
        queryKey: mcpServerKeys.detail(activeProject.id, mcpServerId),
      });
      toast.success("MCP link regenerated successfully");
    },
    onError: (error) => {
      console.error("Regenerate MCP link failed:", error);
      toast.error("Failed to regenerate MCP link");
    },
  });
};
