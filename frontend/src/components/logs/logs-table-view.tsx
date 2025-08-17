import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { type ColumnDef } from "@tanstack/react-table";
import { ExecutionLog } from "@/lib/types/log";

interface LogsTableViewProps {
  logs: ExecutionLog[];
  columns: ColumnDef<ExecutionLog>[];
  isLoading: boolean;
}

export function LogsTableView({
  logs,
  columns,
  isLoading,
}: LogsTableViewProps) {
  if (isLoading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md py-4">
      <div className="overflow-x-auto w-full">
        <EnhancedDataTable
          columns={columns}
          data={logs}
          defaultSorting={[{ id: "created_at", desc: true }]}
          loading={isLoading}
          paginationOptions={{
            initialPageIndex: 0,
            initialPageSize: 10,
          }}
        />
      </div>
    </div>
  );
}
