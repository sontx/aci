import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { SecurityScheme, APIKeyScheme, OAuth2Scheme, NoAuthScheme } from "@/lib/types/userapp";
import { APIKeySchemeForm } from "./api-key-scheme-form";
import { OAuth2SchemeForm } from "./oauth2-scheme-form";

interface SecuritySchemeConfig {
  id: string;
  type: SecurityScheme;
  config: APIKeyScheme | OAuth2Scheme | NoAuthScheme;
}

interface SecuritySchemeFormProps {
  scheme: SecuritySchemeConfig;
  onUpdate: (config: APIKeyScheme | OAuth2Scheme | NoAuthScheme) => void;
  onRemove: () => void;
}

export function SecuritySchemeForm({ scheme, onUpdate, onRemove }: SecuritySchemeFormProps) {
  const updateConfig = (updates: Partial<APIKeyScheme | OAuth2Scheme | NoAuthScheme>) => {
    onUpdate({ ...scheme.config, ...updates });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">
          {scheme.type === 'api_key' && 'API Key Authentication'}
          {scheme.type === 'oauth2' && 'OAuth2 Authentication'}
          {scheme.type === 'no_auth' && 'No Authentication'}
        </CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {scheme.type === 'no_auth' && (
          <p className="text-sm text-muted-foreground">
            No authentication required for this scheme.
          </p>
        )}

        {scheme.type === 'api_key' && (
          <APIKeySchemeForm 
            config={scheme.config as APIKeyScheme} 
            onUpdate={updateConfig} 
          />
        )}

        {scheme.type === 'oauth2' && (
          <OAuth2SchemeForm 
            config={scheme.config as OAuth2Scheme} 
            onUpdate={updateConfig} 
          />
        )}
      </CardContent>
    </Card>
  );
}

export type { SecuritySchemeConfig };
