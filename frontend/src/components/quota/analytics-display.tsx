import { UsageBarChart } from "@/components/charts/usage-bar-chart";
import { TimeSeriesDatapoint } from "@/lib/types/analytics";

interface AnalyticsDisplayProps {
  appTimeSeriesData: TimeSeriesDatapoint[];
  functionTimeSeriesData: TimeSeriesDatapoint[];
}

export function AnalyticsDisplay({
  functionTimeSeriesData,
  appTimeSeriesData,
}: AnalyticsDisplayProps) {
  return (
    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
      <div>
        <UsageBarChart title="Function Usage" data={functionTimeSeriesData} />
      </div>
      <div>
        <UsageBarChart title="App Usage" data={appTimeSeriesData} />
      </div>
    </div>
  );
}
