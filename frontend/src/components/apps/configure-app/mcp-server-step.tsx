import { MCPServerFormContent } from "@/components/mcpserver/mcp-server-form-content";

interface MCPServerStepProps {
  onNext: () => void;
  appConfigId: string;
}

export function MCPServerStep({ onNext, appConfigId }: MCPServerStepProps) {
  return (
    <MCPServerFormContent
      defaultAppConfigId={appConfigId}
      onSuccess={onNext}
      onCancel={onNext}
      cancelButtonText="Skip"
    />
  );
}
