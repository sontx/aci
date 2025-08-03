export interface AppFunction {
  id: string;
  app_name: string;
  name: string;
  display_name: string;
  description: string;
  tags: string[];
  parameters: string;
  response?: string;
  protocol: "rest" | "connector" | "graphql" | "websocket" | "grpc";
}

export interface FunctionExecute {
  function_input: object;
  linked_account_owner_id: string;
}

export interface FunctionExecutionResult {
  success: boolean;
  data: object;
  error?: string;
}

export interface FunctionsSearchParams {
  app_names?: string[];
  intent?: string;
  allowed_apps_only?: boolean;
  format?: "basic" | "openai" | "anthropic";
  limit?: number;
  offset?: number;
}
