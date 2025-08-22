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
          <label className="flex gap-2 items-center text-sm font-medium text-muted-foreground">
            <span>MCP Link</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      regenerateMCPLink(mcpServer.id);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                    disabled={isGenerating}
                  >
                    <RefreshCcw
                      className={cn("h-4 w-4", {
                        "animate-spin": isGenerating,
                      })}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Regenerate MCP Link</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </label>
          <div className="mt-1">
            <IdDisplay id={mcpServer.mcp_link} dim={false} />
          </div>
        </div>
      )}
    </div>
  );
}
