"use client";

import { useState } from "react";
import { MCPServerResponse } from "@/lib/types/mcpserver";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import { FunctionsSelector } from "./functions-selector";
import { useUpdateMCPServer } from "@/hooks/use-mcp-server";
import { toast } from "sonner";

interface MCPServerFunctionsProps {
  mcpServer: MCPServerResponse;
}

export function MCPServerFunctions({ mcpServer }: MCPServerFunctionsProps) {
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>(
    mcpServer.allowed_tools || [],
  );
  const [isSaving, setIsSaving] = useState(false);

  const updateMCPServerMutation = useUpdateMCPServer();

  const hasChanges =
    JSON.stringify(selectedFunctions.sort()) !==
    JSON.stringify((mcpServer.allowed_tools || []).sort());

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateMCPServerMutation.mutateAsync({
        mcpServerId: mcpServer.id,
        data: {
          allowed_tools: selectedFunctions,
        },
      });
    } catch (error) {
      console.error("Failed to update MCP server functions:", error);
      toast.error("Failed to update functions");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedFunctions(mcpServer.allowed_tools || []);
  };

  return (
    <div className="space-y-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">Tools</span>
            {hasChanges && (
              <Badge variant="outline" className="text-xs">
                {selectedFunctions.length} selected (unsaved changes)
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Select the tools this MCP server is allowed to use.
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isSaving}
              >
                Reset
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <FunctionsSelector
        appName={mcpServer.app_name}
        selectedFunctions={selectedFunctions}
        onSelectionChange={setSelectedFunctions}
        disabled={isSaving}
        noFixHeight={true}
      />
    </div>
  );
}
