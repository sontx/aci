import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  SecurityScheme,
  APIKeyScheme,
  OAuth2Scheme,
  NoAuthScheme,
} from "@/lib/types/userapp";
import {
  SecuritySchemeForm,
  SecuritySchemeConfig,
} from "./security-scheme-form";

interface SecurityTabProps {
  securitySchemes: SecuritySchemeConfig[];
  addSecurityScheme: (type: SecurityScheme) => void;
  updateSecurityScheme: (
    id: string,
    config: APIKeyScheme | OAuth2Scheme | NoAuthScheme,
  ) => void;
  removeSecurityScheme: (id: string) => void;
}

export function SecurityTab({
  securitySchemes,
  addSecurityScheme,
  updateSecurityScheme,
  removeSecurityScheme,
}: SecurityTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addSecurityScheme("no_auth")}
            disabled={securitySchemes.some((s) => s.type === "no_auth")}
          >
            <Plus className="h-4 w-4" />
            No Auth
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addSecurityScheme("api_key")}
            disabled={securitySchemes.some((s) => s.type === "api_key")}
          >
            <Plus className="h-4 w-4" />
            API Key
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addSecurityScheme("oauth2")}
            disabled={securitySchemes.some((s) => s.type === "oauth2")}
          >
            <Plus className="h-4 w-4" />
            OAuth2
          </Button>
        </div>
      </div>

      {securitySchemes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No security schemes configured</p>
          <p className="text-sm">Add a security scheme to get started</p>
        </div>
      )}

      {securitySchemes.map((scheme) => (
        <SecuritySchemeForm
          key={scheme.id}
          scheme={scheme}
          onUpdate={(config) => updateSecurityScheme(scheme.id, config)}
          onRemove={() => removeSecurityScheme(scheme.id)}
        />
      ))}
    </div>
  );
}
