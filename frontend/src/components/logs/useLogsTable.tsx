import { useState } from "react";
import { useExecutionLogs } from "@/hooks/use-log";
import { ExecutionLog } from "@/lib/types/log";
import {
  type DashboardDateRange,
  type DashboardDateRangeOptions,
  DEFAULT_DASHBOARD_AGGREGATION_SELECTION,
} from "@/utils/date-range-utils";
import { ExecutionLogSearchParams } from "@/lib/api/log";

export function useLogsTable({
  appConfigId,
  linkedAccountOwnerId,
  apiKeyName,
}: {
  appConfigId?: string;
  linkedAccountOwnerId?: string;
  apiKeyName?: string;
}) {
  const [selectedLogEntry, setSelectedLogEntry] = useState<ExecutionLog | null>(
    null,
  );
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DashboardDateRange | undefined>();
  const [selectedDateOption, setSelectedDateOption] =
    useState<DashboardDateRangeOptions>(
      DEFAULT_DASHBOARD_AGGREGATION_SELECTION,
    );

  const setDateRangeAndOption = (
    option: DashboardDateRangeOptions,
    date?: DashboardDateRange,
  ) => {
    setSelectedDateOption(option);
    setDateRange(date);
  };

  // Build search parameters
  const searchParams: ExecutionLogSearchParams = {
    // Remove pagination params since EnhancedDataTable handles client-side pagination
    ...(dateRange && {
      start_time: dateRange.from.toISOString(),
      end_time: dateRange.to.toISOString(),
    }),
    app_configuration_id: appConfigId,
    linked_account_owner_id: linkedAccountOwnerId,
    api_key_name: apiKeyName,
  };

  // Use the new execution logs hook
  const {
    data: logsResponse,
    isLoading,
    error,
    refetch,
  } = useExecutionLogs(searchParams);

  const handleViewDetails = (log: ExecutionLog) => {
    setSelectedLogEntry(log);
    setIsDetailPanelOpen(true);
  };

  const closeDetailPanel = () => {
    setIsDetailPanelOpen(false);
    setSelectedLogEntry(null);
  };

  return {
    // Data
    logs: logsResponse?.items || [],
    isLoading,
    error,

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
  };
}
