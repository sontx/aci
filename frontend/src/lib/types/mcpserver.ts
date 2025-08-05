export type MCPAuthType = "secret_link" | "oauth2";

export interface MCPServerCreate {
  name: string;
  app_config_id: string;
  auth_type: MCPAuthType;
  allowed_tools: string[];
  mcp_link?: string | null;
}

export interface MCPServerUpdate {
  name?: string | null;
  auth_type?: MCPAuthType | null;
  allowed_tools?: string[] | null;
  mcp_link?: string | null;
}

export interface MCPServerResponse {
  id: string;
  name: string;
  app_config_id: string;
  app_name: string;
  auth_type: MCPAuthType;
  allowed_tools: string[];
  mcp_link: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string;
}
