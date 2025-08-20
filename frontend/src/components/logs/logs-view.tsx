"use client";

import {
  LogDetailSheet,
  LogsDateFilter,
  LogsTableView,
  LogStatistics,
  useLogsTable,
  useLogsTableColumns,
} from "@/components/logs";
import { ExecutionLogSearchParams } from "@/lib/api/log";
import { useMemo } from "react";

interface LogsViewProps {
  appConfigId?: string;
  linkedAccountOwnerId?: string;
  showStatistics?: boolean;
}

export function LogsView({
  appConfigId,
  linkedAccountOwnerId,
  showStatistics = false,
}: LogsViewProps) {
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

  // Build statistics parameters from the same search parameters
  const statisticsParams = useMemo(() => {
    return {
      ...(dateRange && {
        start_time: dateRange.from.toISOString(),
        end_time: dateRange.to.toISOString(),
      }),
      app_configuration_id: appConfigId,
      linked_account_owner_id: linkedAccountOwnerId,
    } as ExecutionLogSearchParams;
  }, [dateRange, appConfigId, linkedAccountOwnerId]);

  return (
    <div className="space-y-4">
      <LogsDateFilter
        dateRange={dateRange}
        selectedDateOption={selectedDateOption}
        onDateRangeChange={setDateRangeAndOption}
        onRefresh={refetch}
        isLoading={isLoading}
      />

      {showStatistics && <LogStatistics params={statisticsParams} />}

      <LogsTableView logs={logs} columns={columns} isLoading={isLoading} />
      <LogDetailSheet
        selectedLogEntry={selectedLogEntry}
        isOpen={isDetailPanelOpen}
        onOpenChange={closeDetailPanel}
      />
    </div>
  );
}
