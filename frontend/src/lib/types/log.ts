export interface FunctionExecution {
  app_name: string;
  function_name: string;
  linked_account_owner_id: string;
  function_execution_start_time: string;
  function_execution_end_time: string;
  function_execution_duration: number;
  function_input: string;
  function_execution_result_success: boolean;
  function_execution_result_error: string | null;
  function_execution_result_data: string;
  function_execution_result_data_size: number;
}

export interface LogEntry {
  "@timestamp": string;
  level: string;
  message: string;
  function_execution: FunctionExecution;
  request_id: string;
  api_key_id: string;
  project_id: string;
  agent_id: string;
  org_id: string;
}

export interface LogSearchResponse {
  logs: LogEntry[];
  total_count: number;
  cursor: string | null;
}

export interface LogSearchParams {
  log_type?: string;
  project_id?: string;
  agent_id?: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
  cursor?: string;
}

export interface ExecutionLog {
  id: string; // UUID
  function_name: string;
  app_name: string;
  linked_account_owner_id?: string | null;
  app_configuration_id?: string | null; // UUID
  status: ExecutionStatus;
  execution_time: number; // in milliseconds
  created_at: string; // ISO 8601 datetime string
  project_id: string; // UUID
}

export interface ExecutionDetail {
  id: string; // UUID
  request?: Record<string, unknown> | null;
  response?: unknown | null;
}

// Enums for ExecutionStatus
export enum ExecutionStatus {
  SUCCESS = "success",
  FAILED = "failed",
}
