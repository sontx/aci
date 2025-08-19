"use client";

import {
  LogDetailSheet,
  LogsDateFilter,
  LogsTableView,
  useLogsTable,
  useLogsTableColumns,
} from "@/components/logs";

interface LogsViewProps {
  appConfigId?: string;
  linkedAccountOwnerId?: string;
}

export function LogsView({ appConfigId, linkedAccountOwnerId }: LogsViewProps) {
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
  } = useLogsTable({
    appConfigId,
    linkedAccountOwnerId,
  });

  const columns = useLogsTableColumns({
    onViewDetails: handleViewDetails,
  });

  return (
    <>
      <LogsDateFilter
        dateRange={dateRange}
        selectedDateOption={selectedDateOption}
        onDateRangeChange={setDateRangeAndOption}
        onRefresh={refetch}
        isLoading={isLoading}
      />

      <LogsTableView logs={logs} columns={columns} isLoading={isLoading} />
      <LogDetailSheet
        selectedLogEntry={selectedLogEntry}
        isOpen={isDetailPanelOpen}
        onOpenChange={closeDetailPanel}
      />
    </>
  );
}
