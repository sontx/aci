import { useMetaInfo } from "@/components/context/metainfo";
import {
  ExecutionLogSearchParams,
  ExecutionLogStatisticsParams,
  getExecutionLogDetail,
  getExecutionLogs,
  getExecutionLogsStatistics,
} from "@/lib/api/log";
import { useQuery } from "@tanstack/react-query";

export const logKeys = {
  search: (projectId: string, params: ExecutionLogSearchParams) =>
    [projectId, "logs", "search", params] as const,
  getDetails: (projectId: string, logId: string) =>
    [projectId, "logs", "details", logId] as const,
  statistics: (projectId: string, params: ExecutionLogStatisticsParams) =>
    [projectId, "logs", "statistics", params] as const,
};

export function useExecutionLogs(params: ExecutionLogSearchParams) {
  const { activeProject } = useMetaInfo();
  return useQuery({
    queryKey: logKeys.search(activeProject.id, params),
    queryFn: () => getExecutionLogs(params),
  });
}

export function useExecutionLogDetails(logId: string) {
  const { activeProject } = useMetaInfo();
  return useQuery({
    queryKey: logKeys.getDetails(activeProject.id, logId),
    queryFn: () => getExecutionLogDetail(logId),
    enabled: !!logId,
  });
}

export function useExecutionLogsStatistics(params: ExecutionLogStatisticsParams) {
  const { activeProject } = useMetaInfo();
  return useQuery({
    queryKey: logKeys.statistics(activeProject.id, params),
    queryFn: () => getExecutionLogsStatistics(params),
  });
}
