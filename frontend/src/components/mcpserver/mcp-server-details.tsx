"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { MCPServerResponse } from "@/lib/types/mcpserver";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MCPServerDetailsProps {
  children: React.ReactNode;
  mcpServer: MCPServerResponse;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MCPServerDetails({ 
  children, 
  mcpServer, 
  open: controlledOpen, 
  onOpenChange: controlledOnOpenChange 
}: MCPServerDetailsProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>MCP Server Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Name
                  </label>
                  <p className="text-sm font-mono mt-1">{mcpServer.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    App
                  </label>
                  <p className="text-sm font-mono mt-1">{mcpServer.app_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                    MCP Link Status
                  </label>
                  <div className="mt-1">
                    {mcpServer.mcp_link ? (
                      <Badge variant="outline" className="text-xs text-green-600">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-gray-500">
                        Not Connected
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {mcpServer.mcp_link && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    MCP Link
                  </label>
                  <p className="text-sm font-mono mt-1 break-all">
                    {mcpServer.mcp_link}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tools */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Allowed Tools ({mcpServer.allowed_tools.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mcpServer.allowed_tools.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {mcpServer.allowed_tools.map((tool, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tool}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tools configured
                </p>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Created At
                  </label>
                  <p className="text-sm font-mono mt-1">
                    {new Date(mcpServer.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Updated At
                  </label>
                  <p className="text-sm font-mono mt-1">
                    {new Date(mcpServer.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Server ID
                </label>
                <p className="text-sm font-mono mt-1 break-all">
                  {mcpServer.id}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  App Configuration ID
                </label>
                <p className="text-sm font-mono mt-1 break-all">
                  {mcpServer.app_config_id}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
