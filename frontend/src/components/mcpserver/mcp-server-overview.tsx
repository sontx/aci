"use client";

import { MCPServerResponse } from "@/lib/types/mcpserver";
import { Badge } from "@/components/ui/badge";
import { IdDisplay } from "@/components/apps/id-display";
import { useApp } from "@/hooks/use-app";
import Image from "next/image";

interface MCPServerOverviewProps {
  mcpServer: MCPServerResponse;
}

export function MCPServerOverview({ mcpServer }: MCPServerOverviewProps) {
  const { app } = useApp(mcpServer.app_name);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        {app && (
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg">
              <Image
                src={app.logo}
                alt={`${app.display_name} logo`}
                fill
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-medium">{app.display_name}</p>
              <p className="text-xs text-muted-foreground">
                {app.description}
              </p>
            </div>
          </div>
        )}
        {!app && <p className="text-sm font-mono">{mcpServer.app_name}</p>}
      </div>

      <div>
        <label className="text-sm font-medium text-muted-foreground">
          Authentication Type
        </label>
        <div className="mt-1">
          <Badge variant="outline" className="text-xs">
            {mcpServer.auth_type}
          </Badge>
        </div>
      </div>

      {mcpServer.mcp_link && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            MCP Link
          </label>
          <div className="mt-1">
            <IdDisplay id={mcpServer.mcp_link} dim={false} />
          </div>
        </div>
      )}
    </div>
  );
}
