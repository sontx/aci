import { MCPServerFormContent } from "@/components/mcpserver/mcp-server-form-content";

interface MCPServerStepProps {
  onNext: () => void;
  appConfigId: string;
}

export function MCPServerStep({ onNext, appConfigId }: MCPServerStepProps) {
  const handleSuccess = () => {
    onNext();
  };

  return (
    <MCPServerFormContent
      defaultAppConfigId={appConfigId}
      onSuccess={handleSuccess}
      cancelButtonText="Skip"
    />
  );
}
