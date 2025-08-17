import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExecutionLog, ExecutionStatus } from "@/lib/types/log";
import { formatToLocalTime } from "@/utils/time";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { useMemo } from "react";
import { AppItemDisplay } from "../apps/app-item-display";
import { RouterLink } from "../ui-extensions/router-link";
import { generateFunctionDisplayName } from "@/utils/string";
import { cn } from "@/lib/utils";

const columnHelper = createColumnHelper<ExecutionLog>();

interface LogsTableColumnsProps {
  onViewDetails: (log: ExecutionLog) => void;
}

export function useLogsTableColumns({
  onViewDetails,
}: LogsTableColumnsProps): ColumnDef<ExecutionLog>[] {
  return useMemo(() => {
    return [
      columnHelper.accessor("created_at", {
        header: "Timestamp",
        cell: (info) => {
          return (
            <div className="text-nowrap text-sm">
              {formatToLocalTime(info.getValue())}
            </div>
          );
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("app_name", {
        header: "App",
        cell: (info) => {
          const appName = info.getValue();
          return <AppItemDisplay appName={appName} />;
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("function_name", {
        header: "Function",
        cell: (info) => {
          const functionName = info.getValue();
          const appName = info.row.original.app_name;
          return (
            <RouterLink
              href={`/apps/${appName}/functions/${functionName}`}
              className="text-nowrap"
              title={functionName}
            >
              {generateFunctionDisplayName(appName, functionName)}
            </RouterLink>
          );
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const status = info.getValue();
          return (
            <Badge
              variant={
                status === ExecutionStatus.SUCCESS ? "default" : "destructive"
              }
              className={cn({
                "bg-green-600": status === ExecutionStatus.SUCCESS,
              })}
            >
              {status === ExecutionStatus.SUCCESS ? "Success" : "Failed"}
            </Badge>
          );
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor("execution_time", {
        header: "Duration",
        cell: (info) => {
          const executionTime = info.getValue();
          return (
            <span className="text-nowrap">
              {executionTime ? `${executionTime}ms` : "-"}
            </span>
          );
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor("linked_account_owner_id", {
        header: () => <span className="text-nowrap">Account Owner</span>,
        cell: (info) => {
          const ownerId = info.getValue();
          return <span className="text-nowrap">{ownerId || "-"}</span>;
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor((row) => row, {
        id: "actions",
        header: "",
        cell: (info) => {
          const log = info.getValue();
          return (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewDetails(log)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          );
        },
        enableGlobalFilter: false,
      }),
    ] as ColumnDef<ExecutionLog>[];
  }, [onViewDetails]);
}
