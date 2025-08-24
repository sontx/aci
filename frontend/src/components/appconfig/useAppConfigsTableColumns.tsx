import { useMemo } from "react";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { type AppConfig } from "@/lib/types/appconfig";
import { EnhancedSwitch } from "@/components/ui-extensions/enhanced-switch/enhanced-switch";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GoTrash } from "react-icons/go";
import { App } from "@/lib/types/app";
import { useDeleteAppConfig, useUpdateAppConfig } from "@/hooks/use-app-config";
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
import { ArrowUpDown, Eye } from "lucide-react";
import { AppItemDisplay } from "@/components/apps/app-item-display";
import { Badge } from "@/components/ui/badge";

const columnHelper = createColumnHelper<AppConfig>();

interface AppConfigsTableColumnsProps {
  linkedAccountsCountMap: Record<string, number>;
  mcpServersCountMap: Record<string, number>;
  appsMap: Record<string, App>;
}

export const useAppConfigsTableColumns = ({
  linkedAccountsCountMap,
  mcpServersCountMap,
  appsMap,
}: AppConfigsTableColumnsProps): ColumnDef<AppConfig>[] => {
  const updateAppConfigMutation = useUpdateAppConfig();
  const deleteAppConfigMutation = useDeleteAppConfig();

  return useMemo(() => {
    return [
      columnHelper.accessor("app_name", {
        header: ({ column }) => (
          <div className="text-left">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="w-full justify-start px-0"
            >
              App
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => {
          const appName = info.getValue();
          return <AppItemDisplay appName={appName} />;
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor((row) => appsMap[row.app_name]?.categories || [], {
        id: "categoriesDisplay",
        header: "Categories",
        cell: (info) => {
          const categories = info.getValue();
          return (
            <div className="flex gap-2">
              {categories.map((category: string) => (
                <Badge
                  key={category}
                  variant="normal"
                  className="text-nowrap"
                  // className="rounded-md bg-gray-100 px-3 py-1 text-xs text-nowrap font-medium text-gray-600 border border-gray-200"
                >
                  {category}
                </Badge>
              ))}
            </div>
          );
        },
        enableColumnFilter: true,
        filterFn: "arrIncludes",
      }),

      columnHelper.accessor(
        (row) => mcpServersCountMap[row.app_name] || 0,
        {
          id: "mcpServers",
          header: ({ column }) => (
            <div className="text-left">
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="w-full justify-start px-0"
              >
                MCP Servers
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          ),
          cell: (info) => info.getValue(),
          enableGlobalFilter: false,
        },
      ),

      columnHelper.accessor(
        (row) => linkedAccountsCountMap[row.app_name] || 0,
        {
          id: "linkedAccounts",
          header: ({ column }) => (
            <div className="text-left">
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="w-full justify-start px-0"
              >
                Linked Accounts
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          ),
          cell: (info) => info.getValue(),
          enableGlobalFilter: false,
        },
      ),

      columnHelper.accessor("enabled", {
        header: "Enabled",
        cell: (info) => {
          const config = info.row.original;
          return (
            <EnhancedSwitch
              checked={info.getValue()}
              onAsyncChange={async (checked) => {
                try {
                  await updateAppConfigMutation.mutateAsync({
                    app_name: config.app_name,
                    enabled: checked,
                  });
                  return true;
                } catch (error) {
                  console.error("Failed to update app config:", error);
                  return false;
                }
              }}
              successMessage={(newState) => {
                return `${config.app_name} configurations ${newState ? "enabled" : "disabled"}`;
              }}
              errorMessage="Failed to update app configuration"
            />
          );
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor((row) => row, {
        id: "actions",
        header: "",
        cell: (info) => {
          const config = info.getValue();
          return (
            <div className="space-x-2 flex">
              <Link href={`/appconfigs/${config.app_name}`}>
                <Button variant="ghost" size="sm">
                  <Eye />
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-red-600">
                    <GoTrash />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Deletion?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the app configuration for &quot;
                      {config.app_name}&quot; and remove all the linked accounts
                      for this app.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await deleteAppConfigMutation.mutateAsync(
                            config.app_name,
                          );
                          toast.success(
                            "App configuration deleted successfully",
                          );
                        } catch (error) {
                          console.error(error);
                          toast.error("Failed to delete app configuration");
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
      }),
    ] as ColumnDef<AppConfig>[];
  }, [
    linkedAccountsCountMap,
    appsMap,
    updateAppConfigMutation,
    deleteAppConfigMutation,
  ]);
};
