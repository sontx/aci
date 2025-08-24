"use client";

import { MCPServerResponse } from "@/lib/types/mcpserver";
import { Badge } from "@/components/ui/badge";
import { IdDisplay } from "@/components/apps/id-display";
import { useApp } from "@/hooks/use-app";
import Image from "next/image";
import { RefreshCcw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useRegenerateMCPLink } from "@/hooks/use-mcp-server";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatToLocalTime } from "@/utils/time";

interface MCPServerOverviewProps {
  mcpServer: MCPServerResponse;
}

export function MCPServerOverview({ mcpServer }: MCPServerOverviewProps) {
  const { data: app } = useApp(mcpServer.app_name);
  const { mutate: regenerateMCPLink, isPending: isGenerating } =
    useRegenerateMCPLink();

  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        {app && (
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg">
              <Image
                src={app.logo || "/icon/default-app-icon.svg"}
                alt={`${app.display_name} logo`}
                fill
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-medium">{app.display_name}</p>
              <p className="text-xs text-muted-foreground">{app.description}</p>
            </div>
          </div>
        )}
        {!app && <p className="text-sm font-mono">{mcpServer.app_name}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
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
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Created At
          </label>
          <div className="mt-1 text-sm">
            {formatToLocalTime(mcpServer.created_at)}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Last Used At
          </label>
          <div className="mt-1 text-sm">
            {mcpServer.last_used_at
              ? formatToLocalTime(mcpServer.last_used_at)
              : "Never"}
          </div>
        </div>
      </div>

      {mcpServer.mcp_link && (
        <div>
          <label className="flex gap-2 items-center text-sm font-medium text-muted-foreground">
            <span>MCP Link</span>
            {mcpServer.auth_type === "secret_link" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0"
                      onClick={(e) => {
                        e.preventDefault();
                        regenerateMCPLink(mcpServer.id);
                      }}
                      disabled={isGenerating}
                    >
                      <RefreshCcw
                        className={cn("h-4 w-4", {
                          "animate-spin": isGenerating,
                        })}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Regenerate MCP Link</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </label>
          <div className="mt-1">
            <IdDisplay id={mcpServer.mcp_link} dim={false} />
          </div>
        </div>
      )}
    </div>
  );
}
