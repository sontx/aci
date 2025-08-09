import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HttpLocation, OAuth2Scheme } from "@/lib/types/userapp";

interface OAuth2SchemeFormProps {
  config: OAuth2Scheme;
  onUpdate: (updates: Partial<OAuth2Scheme>) => void;
}

export function OAuth2SchemeForm({ config, onUpdate }: OAuth2SchemeFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Location</Label>
          <Select
            value={config.location}
            onValueChange={(value: HttpLocation) =>
              onUpdate({ location: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="header">Header</SelectItem>
              <SelectItem value="query">Query Parameter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={config.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="e.g., Authorization"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Prefix</Label>
          <Input
            value={config.prefix}
            onChange={(e) => onUpdate({ prefix: e.target.value })}
            placeholder="e.g., Bearer"
          />
        </div>
        <div className="space-y-2">
          <Label>Scope</Label>
          <Input
            value={config.scope}
            onChange={(e) => onUpdate({ scope: e.target.value })}
            placeholder="e.g., openid email profile"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Client ID</Label>
          <Input
            value={config.client_id}
            onChange={(e) => onUpdate({ client_id: e.target.value })}
            placeholder="OAuth2 Client ID"
          />
        </div>
        <div className="space-y-2">
          <Label>Client Secret</Label>
          <Input
            type="password"
            value={config.client_secret}
            onChange={(e) => onUpdate({ client_secret: e.target.value })}
            placeholder="OAuth2 Client Secret"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Authorize URL</Label>
        <Input
          value={config.authorize_url}
          onChange={(e) => onUpdate({ authorize_url: e.target.value })}
          placeholder="https://accounts.google.com/o/oauth2/v2/auth"
        />
      </div>

      <div className="space-y-2">
        <Label>Access Token URL</Label>
        <Input
          value={config.access_token_url}
          onChange={(e) => onUpdate({ access_token_url: e.target.value })}
          placeholder="https://oauth2.googleapis.com/token"
        />
      </div>

      <div className="space-y-2">
        <Label>Refresh Token URL</Label>
        <Input
          value={config.refresh_token_url}
          onChange={(e) => onUpdate({ refresh_token_url: e.target.value })}
          placeholder="https://oauth2.googleapis.com/token"
        />
      </div>

      <div className="space-y-2">
        <Label>Token Endpoint Auth Method</Label>
        <Select
          value={config.token_endpoint_auth_method || "none"}
          onValueChange={(value) =>
            onUpdate({
              token_endpoint_auth_method:
                value === "none"
                  ? null
                  : (value as "client_secret_basic" | "client_secret_post"),
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="client_secret_basic">
              Client Secret Basic
            </SelectItem>
            <SelectItem value="client_secret_post">
              Client Secret Post
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
