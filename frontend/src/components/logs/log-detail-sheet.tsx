import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ExecutionLog, ExecutionStatus } from "@/lib/types/log";
import { useExecutionLogDetails } from "@/hooks/use-log";
import { getRelativeTimestampFromNow } from "@/utils/dates";

interface LogDetailSheetProps {
  selectedLogEntry: ExecutionLog | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function LogDetailSheet({
  selectedLogEntry,
  isOpen,
  onOpenChange,
}: LogDetailSheetProps) {
  // Fetch detailed information for the selected log
  const { data: logDetails, isLoading } = useExecutionLogDetails(
    selectedLogEntry?.id || ""
  );

  if (!selectedLogEntry) return null;

  const formatJson = (data: unknown) => {
    if (!data) return "";
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="min-w-[600px] sm:min-w-[800px] max-w-[60vw]">
        <SheetHeader>
          <SheetTitle>Execution Log Details</SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-8rem)] mt-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Created At
                  </label>
                  <p className="text-sm">
                    {getRelativeTimestampFromNow(new Date(selectedLogEntry.created_at))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedLogEntry.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Log ID
                  </label>
                  <p className="font-mono text-sm">
                    {selectedLogEntry.id}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    App Name
                  </label>
                  <p className="font-medium">
                    {selectedLogEntry.app_name || "-"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Function Name
                  </label>
                  <p className="font-mono text-sm">
                    {selectedLogEntry.function_name || "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* Execution Status */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Execution Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Status
                  </label>
                  <div className="mt-1">
                    <Badge
                      variant={
                        selectedLogEntry.status === ExecutionStatus.SUCCESS
                          ? "default"
                          : "destructive"
                      }
                    >
                      {selectedLogEntry.status === ExecutionStatus.SUCCESS
                        ? "Success"
                        : "Failed"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Execution Time
                  </label>
                  <p className="font-mono text-sm">
                    {selectedLogEntry.execution_time
                      ? `${selectedLogEntry.execution_time}ms`
                      : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Project ID
                  </label>
                  <p className="font-mono text-sm">
                    {selectedLogEntry.project_id}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Account Owner ID
                  </label>
                  <p className="font-mono text-sm">
                    {selectedLogEntry.linked_account_owner_id || "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* Configuration Information */}
            {selectedLogEntry.app_configuration_id && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Configuration</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      App Configuration ID
                    </label>
                    <p className="font-mono text-sm">
                      {selectedLogEntry.app_configuration_id}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Request/Response Data */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-muted-foreground">Loading details...</span>
              </div>
            ) : logDetails ? (
              <>
                {/* Request Data */}
                {logDetails.request && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Request Data</h3>
                    <div className="bg-gray-50 border rounded-md p-4 max-h-[400px] overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap overflow-x-auto">
                        {formatJson(logDetails.request)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Response Data */}
                {logDetails.response && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Response Data</h3>
                    <div className="bg-gray-50 border rounded-md p-4 max-h-[400px] overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap overflow-x-auto">
                        {formatJson(logDetails.response)}
                      </pre>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No detailed request/response data available</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
