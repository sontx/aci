import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { APIKey } from "@/lib/types/apikey";
import { useDeleteAPIKey, useUpdateAPIKey } from "@/hooks/use-api-key";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowUpDown,
  Key,
  MoreHorizontal,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RouterLink } from "../ui-extensions/router-link";
import { toast } from "sonner";

const columnHelper = createColumnHelper<APIKey>();

export const useAPIKeysTableColumns = (): ColumnDef<APIKey>[] => {
  const updateAPIKey = useUpdateAPIKey();
  const deleteAPIKey = useDeleteAPIKey();

  const [deletingApiKey, setDeletingApiKey] = useState<APIKey | null>(null);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "disabled":
        return "destructive";
      default:
        return "outline";
    }
  };

  return useMemo(() => {
    const handleStatusToggle = async (apiKey: APIKey) => {
      const newStatus = apiKey.status === "active" ? "disabled" : "active";
      try {
        await updateAPIKey.mutateAsync({
          name: apiKey.name,
          data: { status: newStatus },
        });
      } catch (error) {
        console.error("Failed to update API key status:", error);
      }
    };

    const handleDelete = async (apiKey: APIKey) => {
      try {
        await deleteAPIKey.mutateAsync(apiKey.name);
        toast.success(`API key "${apiKey.name}" deleted successfully.`);
      } catch (error) {
        console.error("Failed to delete API key:", error);
        toast.error("Failed to delete API key. Please try again.");
      } finally {
        setDeletingApiKey(null);
      }
    };

    return [
      columnHelper.accessor("name", {
        header: ({ column }) => (
          <div className="text-left">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="w-full justify-start px-0"
            >
              Name
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => {
          const name = info.getValue();
          return (
            <RouterLink
              href={`/api-keys/${name}`}
              className="flex items-center gap-2 text-nowrap"
            >
              <Key className="w-4 h-4 inline" /> {name}
            </RouterLink>
          );
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("key", {
        header: ({ column }) => (
          <div className="text-left">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="w-full justify-start px-0"
            >
              API Key
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => {
          const truncatedKey = info.getValue(); // This is already truncated from the list API

          return (
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{truncatedKey}...</span>
            </div>
          );
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("status", {
        header: ({ column }) => (
          <div className="text-left">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="w-full justify-start px-0"
            >
              Status
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => {
          const status = info.getValue();
          return (
            <Badge variant={getStatusVariant(status)} className="capitalize">
              {status}
            </Badge>
          );
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor("created_at", {
        header: ({ column }) => (
          <div className="text-left">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="w-full justify-start px-0"
            >
              Created
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => {
          const date = new Date(info.getValue());
          return (
            <div className="text-sm text-gray-600">
              {format(date, "MMM dd, yyyy 'at' HH:mm")}
            </div>
          );
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor("updated_at", {
        header: ({ column }) => (
          <div className="text-left">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="w-full justify-start px-0"
            >
              Last Updated
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => {
          const date = new Date(info.getValue());
          return (
            <div className="text-sm text-gray-600">
              {format(date, "MMM dd, yyyy 'at' HH:mm")}
            </div>
          );
        },
        enableGlobalFilter: false,
      }),

      columnHelper.display({
        id: "actions",
        header: () => null,
        cell: (info) => {
          const apiKey = info.row.original;

          return (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleStatusToggle(apiKey)}
                    disabled={
                      updateAPIKey.isPending || apiKey.status === "deleted"
                    }
                  >
                    {apiKey.status === "active" ? (
                      <>
                        <Pause className="h-4 w-4" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Activate
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeletingApiKey(apiKey)}
                    disabled={deleteAPIKey.isPending}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog
                open={deletingApiKey !== null}
                onOpenChange={(open) => {
                  if (!open) setDeletingApiKey(null);
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the API key{" "}
                      <strong>{deletingApiKey?.name}</strong>? This action
                      cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeletingApiKey(null)}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (deletingApiKey) {
                          handleDelete(deletingApiKey);
                        }
                      }}
                      destructive
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          );
        },
      }),
    ] as ColumnDef<APIKey>[];
  }, [updateAPIKey, deleteAPIKey, deletingApiKey, setDeletingApiKey]);
};
