import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APIKeyScheme, HttpLocation } from "@/lib/types/userapp";

interface APIKeySchemeFormProps {
  config: APIKeyScheme;
  onUpdate: (updates: Partial<APIKeyScheme>) => void;
}

export function APIKeySchemeForm({ config, onUpdate }: APIKeySchemeFormProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Location</Label>
        <Select
          value={config.location}
          onValueChange={(value: HttpLocation) => onUpdate({ location: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="header">Header</SelectItem>
            <SelectItem value="query">Query Parameter</SelectItem>
            <SelectItem value="cookie">Cookie</SelectItem>
            <SelectItem value="body">Request Body</SelectItem>
            <SelectItem value="path">Path Parameter</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          value={config.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="e.g., x-api-key"
        />
      </div>
      <div className="space-y-2 col-span-2">
        <Label>Prefix (optional)</Label>
        <Input
          value={config.prefix || ""}
          onChange={(e) => onUpdate({ prefix: e.target.value || null })}
          placeholder="e.g., Bearer"
        />
      </div>
    </div>
  );
}
