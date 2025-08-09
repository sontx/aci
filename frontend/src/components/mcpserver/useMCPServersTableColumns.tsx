import { useMemo } from "react";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { MCPServerResponse } from "@/lib/types/mcpserver";
import { Button } from "@/components/ui/button";
import { GoTrash } from "react-icons/go";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useDeleteMCPServer } from "@/hooks/use-mcp-server";
import { AppItemDisplay } from "@/components/apps/app-item-display";
import { RouterLink } from "@/components/ui-extensions/router-link";
import { formatRelativeTime, formatToLocalTime } from "@/utils/time";

const columnHelper = createColumnHelper<MCPServerResponse>();

export const useMCPServersTableColumns = (): ColumnDef<MCPServerResponse>[] => {
  const { mutateAsync: deleteMCPServer } = useDeleteMCPServer();

  return useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => {
          const server = info.row.original;
          return (
            <RouterLink
              href={`/mcp-servers/${server.id}`}
              className="text-nowrap"
            >
              {info.getValue()}
            </RouterLink>
          );
        },
        enableGlobalFilter: true,
      }) as ColumnDef<MCPServerResponse>,

      columnHelper.accessor("app_name", {
        header: "App",
        cell: (info) => {
          const appName = info.getValue();
          return <AppItemDisplay appName={appName} />;
        },
        enableGlobalFilter: true,
      }) as ColumnDef<MCPServerResponse>,

      columnHelper.accessor("auth_type", {
        header: "Auth Type",
        cell: (info) => (
          <Badge variant="outline" className="text-xs">
            {info.getValue()}
          </Badge>
        ),
        enableGlobalFilter: true,
      }) as ColumnDef<MCPServerResponse>,

      columnHelper.accessor("created_at", {
        header: "Created At",
        cell: (info) => (
          <div className="text-nowrap">
            {formatToLocalTime(info.getValue())}
          </div>
        ),
        enableGlobalFilter: false,
      }) as ColumnDef<MCPServerResponse>,

      columnHelper.accessor("updated_at", {
        header: "Updated At",
        cell: (info) => (
          <div className="text-nowrap">
            {formatToLocalTime(info.getValue())}
          </div>
        ),
        enableGlobalFilter: false,
      }) as ColumnDef<MCPServerResponse>,

      columnHelper.accessor("last_used_at", {
        header: "Last Used At",
        cell: (info) => {
          const lastUsedAt = info.getValue();
          return (
            <div className="text-nowrap">
              {lastUsedAt ? formatRelativeTime(lastUsedAt) : "Never"}
            </div>
          );
        },
        enableGlobalFilter: false,
      }) as ColumnDef<MCPServerResponse>,

      columnHelper.accessor((row) => row, {
        id: "actions",
        header: () => null,
        cell: (info) => {
          const server = info.getValue();
          return (
            <div className="flex justify-center">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-800"
                  >
                    <GoTrash className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete MCP Server</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the MCP server &ldquo;
                      {server.name}&rdquo;? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await deleteMCPServer(server.id);
                        } catch (error) {
                          console.error("Failed to delete MCP server:", error);
                          toast.error("Failed to delete MCP server");
                        }
                      }}
                      destructive
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
        enableGlobalFilter: false,
      }) as ColumnDef<MCPServerResponse>,
    ],
    [deleteMCPServer],
  );
};
