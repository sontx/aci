"use client";

import {
  LogDetailSheet,
  LogsDateFilter,
  LogsTableView,
  useLogsTable,
  useLogsTableColumns,
} from "@/components/logs";
import { Separator } from "@/components/ui/separator";

export default function LogsPage() {
  const {
    // Data
    logs,
    isLoading,

    // Detail panel state
    selectedLogEntry,
    isDetailPanelOpen,

    // Date range
    dateRange,
    selectedDateOption,

    // Actions
    handleViewDetails,
    closeDetailPanel,
    setDateRangeAndOption,
    refetch,
  } = useLogsTable();

 
  const columns = useLogsTableColumns({
    onViewDetails: handleViewDetails,
  });

  return (
    <div className="w-full">
      <div className="m-4">
        <h1 className="text-2xl font-bold">Logs</h1>
        <p className="text-sm text-muted-foreground">
          View and analyze function execution logs for your applications.
        </p>
      </div>

      <Separator />

      <div className="m-4">
        <LogsDateFilter
          dateRange={dateRange}
          selectedDateOption={selectedDateOption}
          onDateRangeChange={setDateRangeAndOption}
          onRefresh={refetch}
          isLoading={isLoading}
        />

        <LogsTableView
          logs={logs}
          columns={columns}
          isLoading={isLoading}
        />
        <LogDetailSheet
          selectedLogEntry={selectedLogEntry}
          isOpen={isDetailPanelOpen}
          onOpenChange={closeDetailPanel}
        />
      </div>
    </div>
  );
}
