import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { MCPServerResponse } from "@/lib/types/mcpserver";
import { Button } from "@/components/ui/button";
import { GoTrash } from "react-icons/go";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { IdDisplay } from "@/components/apps/id-display";
import { App } from "@/lib/types/app";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useDeleteMCPServer } from "@/hooks/use-mcp-server";
import Link from "next/link";

const columnHelper = createColumnHelper<MCPServerResponse>();

interface MCPServersTableColumnsProps {
  appsMap: Record<string, App>;
}

export const useMCPServersTableColumns = ({
  appsMap,
}: MCPServersTableColumnsProps): ColumnDef<MCPServerResponse>[] => {
  const { mutateAsync: deleteMCPServer } = useDeleteMCPServer();
  const router = useRouter();

  return useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "NAME",
        cell: (info) => {
          const server = info.row.original;
          return (
            <Link
              className="cursor-pointer hover:text-blue-600 hover:underline"
              href={`/mcp-servers/${server.id}`}
            >
              {info.getValue()}
            </Link>
          );
        },
        enableGlobalFilter: true,
      }) as ColumnDef<MCPServerResponse>,

      columnHelper.accessor("app_name", {
        header: "APP",
        cell: (info) => {
          const appName = info.getValue();
          return (
            <div className="flex items-center gap-3">
              <div className="relative h-5 w-5 flex-shrink-0 overflow-hidden">
                {appsMap[appName]?.logo && (
                  <Image
                    src={appsMap[appName]?.logo || ""}
                    alt={`${appName} logo`}
                    fill
                    className="object-contain"
                  />
                )}
              </div>
              <IdDisplay id={appName} dim={false} />
            </div>
          );
        },
        enableGlobalFilter: true,
      }) as ColumnDef<MCPServerResponse>,

      columnHelper.accessor("auth_type", {
        header: "AUTH TYPE",
        cell: (info) => (
          <Badge variant="outline" className="text-xs">
            {info.getValue()}
          </Badge>
        ),
        enableGlobalFilter: true,
      }) as ColumnDef<MCPServerResponse>,

      columnHelper.accessor("created_at", {
        header: "CREATED",
        cell: (info) => (
          <div className="text-sm text-muted-foreground">
            {new Date(info.getValue()).toLocaleDateString()}
          </div>
        ),
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
                      className="bg-red-600 hover:bg-red-700"
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
    [router, deleteMCPServer, appsMap],
  );
};
