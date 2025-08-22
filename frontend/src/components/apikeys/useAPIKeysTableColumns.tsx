import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APIKey } from "@/lib/types/apikey";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  ArrowUpDown,
  Key
} from "lucide-react";
import { useMemo } from "react";
import { RouterLink } from "../ui-extensions/router-link";

const columnHelper = createColumnHelper<APIKey>();

export const useAPIKeysTableColumns = (): ColumnDef<APIKey>[] => {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "disabled":
        return "secondary";
      case "deleted":
        return "destructive";
      default:
        return "outline";
    }
  };

  return useMemo(() => {
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
            <RouterLink href={`/api-keys/${name}`} className="text-nowrap">
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
    ] as ColumnDef<APIKey>[];
  }, []);
};
