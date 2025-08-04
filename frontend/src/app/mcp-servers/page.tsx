"use client";

import { Button } from "@/components/ui/button";
import { GoPlus } from "react-icons/go";
import { AlertCircle, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { useMCPServers } from "@/hooks/use-mcp-server";
import { useMCPServersTableColumns } from "@/components/mcpserver/useMCPServersTableColumns";
import { MCPServerForm } from "@/components/mcpserver/mcp-server-form";

export default function MCPServersPage() {
  const { data: mcpServers, isPending, isError } = useMCPServers();

  const columns = useMCPServersTableColumns();

  return (
    <div>
      <div className="m-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">MCP Servers</h1>
            <p className="text-sm text-muted-foreground">
              Manage your Model Context Protocol servers and their
              configurations.
            </p>
          </div>
          <MCPServerForm title="Create MCP Server">
            <Button>
              <GoPlus className="h-4 w-4" />
              Create MCP Server
            </Button>
          </MCPServerForm>
        </div>
      </div>
      <Separator />

      <div className="m-4">
        {isPending ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="animate-spin h-10 w-10 text-gray-500 mr-4" />
            Loading MCP servers...
          </div>
        ) : isError ? (
          <div className="flex justify-center items-center py-16">
            <AlertCircle className="h-10 w-10 text-red-500 mr-4" />
            Failed to load MCP servers. Please try to refresh the page.
          </div>
        ) : (
          <EnhancedDataTable
            columns={columns}
            data={mcpServers || []}
            searchBarProps={{ placeholder: "Search MCP servers..." }}
            paginationOptions={{
              initialPageIndex: 0,
              initialPageSize: 15,
            }}
          />
        )}
      </div>
    </div>
  );
}
