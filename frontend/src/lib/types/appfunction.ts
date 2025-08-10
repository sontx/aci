/* eslint @typescript-eslint/no-explicit-any:0 */

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
  protocol_data: RestMetadata;
}

export interface FunctionExecute {
  function_input: object;
  linked_account_owner_id?: string;
  app_name?: string; // Optional, only needed if the function is part of a user app
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

type Visibility = "public";
type Protocol = "rest" | "connector";
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export interface RestMetadata {
  method: HttpMethod;
  path: string;
  server_url: string;
}

export interface FunctionUpsert {
  name: string;
  description: string;
  tags: string[];
  visibility: Visibility; // "PUBLIC"
  active: boolean; // true
  protocol: Protocol; // "REST"
  protocol_data: RestMetadata;
  parameters: Record<string, any>;
  response: Record<string, any>;
}
