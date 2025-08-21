"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useExecutionLogsStatistics } from "@/hooks/use-log";
import { ExecutionLogStatisticsParams } from "@/lib/api/log";
import { Activity, CheckCircle, Clock } from "lucide-react";

interface LogStatisticsProps {
  params: ExecutionLogStatisticsParams;
}

export function LogStatistics({ params }: LogStatisticsProps) {
  const {
    data: statistics,
    isLoading,
    error,
  } = useExecutionLogsStatistics(params);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Failed to load statistics
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const successRate =
    statistics.total_count > 0
      ? ((statistics.success_count / statistics.total_count) * 100).toFixed(1)
      : "0";
  const failedRate =
    statistics.total_count > 0
      ? (statistics.failure_count / statistics.total_count) * 100
      : 0;
  const failedWarningLevel =
    failedRate > 50
      ? "high"
      : failedRate > 20
        ? "medium"
        : failedRate > 1
          ? "low"
          : "none";
  const failedWarningMessage = {
    high: (
      <span className="text-red-500">
        App unavailable or invalid credentials.
      </span>
    ),
    medium: (
      <span className="text-orange-500">App may be experiencing issues.</span>
    ),
    low: (
      <span className="text-yellow-500">
        App may be experiencing minor issues.
      </span>
    ),
    none: (
      statistics.total_count > 0 && <span className="text-green-500">Everything is running smoothly</span>
    ),
  }[failedWarningLevel];

  const statisticsCards = [
    {
      title: "Total Executions",
      value: statistics.total_count.toLocaleString(),
      icon: Activity,
      description: "Total function calls",
      details: [
        `${statistics.success_count.toLocaleString()} successful`,
        `${statistics.failure_count.toLocaleString()} failed`,
      ],
    },
    {
      title: "Success Rate",
      value: `${successRate}%`,
      icon: CheckCircle,
      description: "Overall success percentage",
      details: [`${failedRate.toFixed(1)}% failed`, failedWarningMessage],
    },
    {
      title: "Performance",
      value: formatTime(statistics.average_execution_time),
      icon: Clock,
      description: "Average execution time",
      details: [
        `Min: ${formatTime(statistics.min_execution_time)}`,
        `Max: ${formatTime(statistics.max_execution_time)}`,
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {statisticsCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="relative">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold mb-2">
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {stat.description}
              </p>
              <div className="space-y-1">
                {stat.details?.map((detail, detailIndex) => (
                  <p
                    key={detailIndex}
                    className="text-xs text-muted-foreground"
                  >
                    {detail}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
