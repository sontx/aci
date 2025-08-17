import { DatePickerWithRange } from "@/components/ui-extensions/enhanced-date-picker/date-picker";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import {
  type DashboardDateRange,
  type DashboardDateRangeOptions,
} from "@/utils/date-range-utils";
import { useQuota } from "@/hooks/use-quota";

interface LogsDateFilterProps {
  dateRange?: DashboardDateRange;
  selectedDateOption: DashboardDateRangeOptions;
  onDateRangeChange: (
    option: DashboardDateRangeOptions,
    dateRange?: DashboardDateRange,
  ) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function LogsDateFilter({
  dateRange,
  selectedDateOption,
  onDateRangeChange,
  onRefresh,
  isLoading,
}: LogsDateFilterProps) {
  // Get quota information for log retention limits
  const { data: quotaUsage } = useQuota();
  const logRetentionDays = quotaUsage?.plan.features.log_retention_days || 3;

  return (
    <div className="flex items-center justify-between">
      <DatePickerWithRange
        dateRange={dateRange}
        selectedOption={selectedDateOption}
        setDateRangeAndOption={onDateRangeChange}
        logRetentionDays={logRetentionDays}
      />
      <Button
        onClick={onRefresh}
        variant="default"
        size="sm"
        className="gap-2"
        disabled={isLoading}
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
  );
}
