import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAppFunction,
  useExecuteAppFunction,
} from "@/hooks/use-app-functions";
import { useAppLinkedAccounts } from "@/hooks/use-linked-account";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FunctionExecutionResult } from "@/lib/types/appfunction";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import SchemaGuardForm from "@/components/ui-extensions/schema-guard-form";
import { tryParseJson } from "@/utils/object-utils";

export interface RunFunctionFormContentProps {
  functionName: string;
  appName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export interface RunFunctionDialogProps {
  children: React.ReactNode;
  functionName: string;
  appName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Content component for use in dialog
function RunFunctionFormContent({
  functionName,
  appName,
  onSuccess,
  onCancel,
}: RunFunctionFormContentProps) {
  const [selectedLinkedAccountId, setSelectedLinkedAccountId] =
    useState<string>("");
  const [functionInput, setFunctionInput] = useState<Record<string, unknown>>(
    {},
  );
  const [executionResult, setExecutionResult] =
    useState<FunctionExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const { mutateAsync: executeFunction } = useExecuteAppFunction();
  const { data: functionData, isLoading: isFunctionLoading } = useAppFunction(
    functionName,
    "raw",
  );
  const { data: linkedAccounts, isLoading: isLinkedAccountsLoading } =
    useAppLinkedAccounts(appName);

  useEffect(() => {
    if (linkedAccounts?.length) {
      setSelectedLinkedAccountId(linkedAccounts[0]!.linked_account_owner_id);
    }
  }, [linkedAccounts]);

  // JsonSchema for function input
  const functionInputSchema = useMemo(
    () => tryParseJson(functionData?.parameters, {}),
    [functionData?.parameters],
  );

  const handleFunctionInputChange = useCallback(
    (input: Record<string, unknown>) => {
      setFunctionInput(input);
    },
    [setFunctionInput],
  );

  const handleExecuteFunction = async () => {
    if (!selectedLinkedAccountId) {
      toast.error("Please select a linked account");
      return;
    }

    if (!functionInputSchema) {
      toast.error("Function schema not loaded");
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await executeFunction({
        functionName,
        parameters: functionInput,
        linkedAccountOwnerId: selectedLinkedAccountId,
      });

      setExecutionResult(result);
      toast.success("Function executed successfully");
      onSuccess?.();
    } catch (error) {
      console.error("Function execution failed:", error);
      setExecutionResult({
        success: false,
        data: {},
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
      toast.error("Function execution failed");
    } finally {
      setIsExecuting(false);
    }
  };

  if (isFunctionLoading || isLinkedAccountsLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (!functionData) {
    return (
      <Alert>
        <AlertDescription>
          Function &quot;{functionName}&quot; not found or failed to load.
        </AlertDescription>
      </Alert>
    );
  }

  if (!linkedAccounts || linkedAccounts.length === 0) {
    return (
      <Alert className="my-4">
        <AlertTitle>No Linked Accounts Available</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          No linked accounts found for app <strong>{appName}</strong>. Please
          create a linked account first.
        </AlertDescription>
      </Alert>
    );
  }

  const enabledLinkedAccounts = linkedAccounts.filter(
    (account) => account.enabled,
  );

  if (enabledLinkedAccounts.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No enabled linked accounts found for app &quot;{appName}&quot;. Please
          enable at least one linked account.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Run &#34;{functionData.display_name || functionName}&#34;
        </DialogTitle>
        <DialogDescription>
          {functionData.description && (
            <p className="text-sm text-muted-foreground">
              {functionData.description}
            </p>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Linked Account Selection */}
        <div className="space-y-2">
          <Label htmlFor="linked-account">Linked Account</Label>
          <Select
            value={selectedLinkedAccountId}
            onValueChange={setSelectedLinkedAccountId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a linked account" />
            </SelectTrigger>
            <SelectContent>
              {enabledLinkedAccounts.map((account) => (
                <SelectItem
                  key={account.id}
                  value={account.linked_account_owner_id}
                >
                  {account.linked_account_owner_id}{" "}
                  <span className="text-muted-foreground">
                    ({account.security_scheme})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Function Parameters Form */}
        {functionInputSchema && (
          <div className="space-y-2">
            <Label>Function Parameters</Label>
            <SchemaGuardForm
              schema={functionInputSchema}
              value={functionInput}
              onValueChange={handleFunctionInputChange}
            />
          </div>
        )}

        {/* Execution Result */}
        {executionResult && (
          <Card>
            <CardHeader>
              <CardTitle
                className={
                  executionResult.success ? "text-green-600" : "text-red-600"
                }
              >
                Execution Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              {executionResult.success ? (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Success</p>
                  <pre className="bg-muted p-3 rounded-lg overflow-auto text-sm overflow-y-auto max-h-96">
                    {JSON.stringify(executionResult.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Error</p>
                  <Alert variant="destructive">
                    <AlertDescription>
                      {executionResult.error || "Unknown error occurred"}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog Footer with buttons */}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isExecuting}
        >
          Close
        </Button>
        <Button
          onClick={handleExecuteFunction}
          disabled={!selectedLinkedAccountId || isExecuting}
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Executing...
            </>
          ) : (
            "Run Function"
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

// Dialog wrapper component
export function RunFunctionDialog({
  children,
  functionName,
  appName,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: RunFunctionDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen =
    controlledOnOpenChange !== undefined
      ? controlledOnOpenChange
      : setInternalOpen;

  const handleCancel = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px]" preventCloseOnClickOutside>
        {open && (
          <RunFunctionFormContent
            functionName={functionName}
            appName={appName}
            onCancel={handleCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
