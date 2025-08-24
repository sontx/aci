"use client";

import { useParams } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { useMCPServer } from "@/hooks/use-mcp-server";
import { MCPServerOverview } from "@/components/mcpserver/mcp-server-overview";
import { MCPServerFunctions } from "@/components/mcpserver/mcp-server-functions";
import { AlertCircle, Loader2 } from "lucide-react";
import * as React from "react";
import { McpIcon } from "@/components/icons/mcp";

export default function MCPServerDetailsPage() {
  const params = useParams();
  const mcpServerId = params.mcpServerId as string;

  const { data: mcpServer, isPending, isError } = useMCPServer(mcpServerId);

  if (isPending) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin h-10 w-10 text-gray-500 mr-4" />
        Loading MCP server details...
      </div>
    );
  }

  if (isError || !mcpServer) {
    return (
      <div className="flex justify-center items-center py-16">
        <AlertCircle className="h-10 w-10 text-red-500 mr-4" />
        Failed to load MCP server details. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="m-4">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
            <McpIcon className="w-12 h-12" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{mcpServer.name}</h1>
            <p className="text-sm text-muted-foreground">
              MCP Server details and configuration
            </p>
          </div>
        </div>
      </div>

      <Separator className="!my-4" />

      {/* Section 1: MCP Overview */}
      <div className="m-4">
        <MCPServerOverview mcpServer={mcpServer} />
      </div>

      <Separator />

      {/* Section 2: Functions Management */}
      <div className="m-4">
        <MCPServerFunctions mcpServer={mcpServer} />
      </div>
    </div>
  );
}
