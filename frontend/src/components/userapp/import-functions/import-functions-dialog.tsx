"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openApiToFunctionUpserts } from "@/lib/openapi-to-function-def";
import { FunctionUpsert } from "@/lib/types/appfunction";
import { toast } from "sonner";
import type { OpenAPIV3 } from "openapi-types";
import {
  type ImportSource,
  ImportSourceSelector,
  type BasicAuthInfo,
} from "./import-source-selector";
import {
  type ConflictStrategy,
  type FunctionGroup,
  FunctionReview,
  type SelectableFunction,
} from "./function-review";
import { useCreateUserAppFunctions } from "@/hooks/use-user-app";

interface ImportFunctionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
}

type DialogStep = "source" | "review";

export function ImportFunctionsDialog({
  isOpen,
  onClose,
  appName,
}: ImportFunctionsDialogProps) {
  const [step, setStep] = useState<DialogStep>("source");
  const [importSource, setImportSource] = useState<ImportSource>("file");
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [functionGroups, setFunctionGroups] = useState<FunctionGroup[]>([]);
  const [openApiDocument, setOpenApiDocument] =
    useState<OpenAPIV3.Document | null>(null);
  const [conflictStrategy, setConflictStrategy] =
    useState<ConflictStrategy>("overwrite");
  const [removePrevious, setRemovePrevious] = useState(false);
  const [basicAuth, setBasicAuth] = useState(false);
  const [basicAuthInfo, setBasicAuthInfo] = useState<BasicAuthInfo>({
    username: "",
    password: "",
  });

  const createFunctionsMutation = useCreateUserAppFunctions(appName);

  const resetDialog = useCallback(() => {
    setStep("source");
    setImportSource("file");
    setUrl("");
    setIsLoading(false);
    setFunctionGroups([]);
    setConflictStrategy("overwrite");
    setBasicAuth(false);
    setBasicAuthInfo({ username: "", password: "" });
  }, []);

  const handleClose = useCallback(() => {
    resetDialog();
    onClose();
  }, [resetDialog, onClose]);

  const parseOpenApiData = useCallback(
    async (
      data: string,
    ): Promise<{
      functions: FunctionUpsert[];
      document: OpenAPIV3.Document;
    }> => {
      try {
        const jsonData: OpenAPIV3.Document = JSON.parse(data);
        const functions = await openApiToFunctionUpserts(jsonData, {
          dereference: true,
        });
        return { functions, document: jsonData };
      } catch {
        throw new Error("Invalid OpenAPI JSON format");
      }
    },
    [],
  );

  const groupFunctionsByTag = useCallback(
    (functions: FunctionUpsert[]): FunctionGroup[] => {
      const grouped = new Map<string, SelectableFunction[]>();

      functions.forEach((func) => {
        const tag = func.tags.length > 0 ? func.tags[0] : "Uncategorized";
        const selectableFunc: SelectableFunction = { ...func, selected: true };
        if (!grouped.has(tag)) {
          grouped.set(tag, []);
        }
        grouped.get(tag)!.push(selectableFunc);
      });

      return Array.from(grouped.entries()).map(([tag, functions]) => ({
        tag,
        functions,
        expanded: false,
        selected: true,
        indeterminate: false,
      }));
    },
    [],
  );

  const handleImport = useCallback(
    async (file?: File) => {
      setIsLoading(true);
      try {
        let openApiData: string;

        if (importSource === "file") {
          if (!file) {
            toast.error("Please select a file");
            return;
          }
          openApiData = await file.text();
        } else {
          if (!url.trim()) {
            toast.error("Please enter a URL");
            return;
          }

          const headers: Record<string, string> = {};
          if (basicAuth && basicAuthInfo.username && basicAuthInfo.password) {
            const credentials = btoa(
              `${basicAuthInfo.username}:${basicAuthInfo.password}`,
            );
            headers.Authorization = `Basic ${credentials}`;
          }

          const response = await fetch(url, { headers });
          if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.statusText}`);
          }
          openApiData = await response.text();
        }

        const { functions, document } = await parseOpenApiData(openApiData);

        if (functions.length === 0) {
          toast.error("No functions found in the OpenAPI specification");
          return;
        }

        const groups = groupFunctionsByTag(functions);
        setFunctionGroups(groups);
        setOpenApiDocument(document);
        setStep("review");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to import OpenAPI data",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      importSource,
      url,
      basicAuth,
      basicAuthInfo,
      parseOpenApiData,
      groupFunctionsByTag,
    ],
  );

  const toggleGroup = useCallback((groupIndex: number) => {
    setFunctionGroups((prev) =>
      prev.map((group, index) => {
        if (index === groupIndex) {
          return {
            ...group,
            expanded: !group.expanded,
          };
        }
        return {
          ...group,
          expanded: false,
        };
      }),
    );
  }, []);

  const toggleGroupSelection = useCallback((groupIndex: number) => {
    setFunctionGroups((prev) =>
      prev.map((group, index) => {
        if (index === groupIndex) {
          const newSelected = !group.selected;
          return {
            ...group,
            selected: newSelected,
            indeterminate: false,
            functions: group.functions.map((func) => ({
              ...func,
              selected: newSelected,
            })),
          };
        }
        return group;
      }),
    );
  }, []);

  const toggleFunctionSelection = useCallback(
    (groupIndex: number, functionIndex: number) => {
      setFunctionGroups((prev) => {
        const newGroups = [...prev];
        const group = { ...newGroups[groupIndex] };
        const selectedFunctions = [...group.functions];

        selectedFunctions[functionIndex] = {
          ...selectedFunctions[functionIndex],
          selected: !selectedFunctions[functionIndex].selected,
        };

        group.functions = selectedFunctions;

        const selectedCount = group.functions.filter((f) => f.selected).length;
        if (selectedCount === 0) {
          group.selected = false;
          group.indeterminate = false;
        } else if (selectedCount === group.functions.length) {
          group.selected = true;
          group.indeterminate = false;
        } else {
          group.selected = false;
          group.indeterminate = true;
        }

        newGroups[groupIndex] = group;
        return newGroups;
      });
    },
    [],
  );

  const handleEditFunctionName = useCallback(
    (groupIndex: number, functionIndex: number, newName: string) => {
      setFunctionGroups((prev) => {
        const newGroups = [...prev];
        const group = { ...newGroups[groupIndex] };
        const functions = [...group.functions];

        if (functions[functionIndex].isEditing) {
          // Save the edit
          functions[functionIndex] = {
            ...functions[functionIndex],
            name: newName,
            isEditing: false,
            tempName: undefined,
          };
        } else {
          // Start editing
          functions[functionIndex] = {
            ...functions[functionIndex],
            isEditing: true,
            tempName: newName,
          };
        }

        group.functions = functions;
        newGroups[groupIndex] = group;
        return newGroups;
      });
    },
    [],
  );

  const getSelectedFunctions = useMemo((): FunctionUpsert[] => {
    return functionGroups.flatMap((group) =>
      group.functions.filter((f) => group.selected || f.selected),
    );
  }, [functionGroups]);

  const handleConfirm = useCallback(async () => {
    const selectedFunctions = getSelectedFunctions;
    if (selectedFunctions.length === 0) {
      toast.error("Please select at least one function");
      return;
    }

    try {
      await createFunctionsMutation.mutateAsync({
        functionDefinitions: selectedFunctions,
        overrideExisting: conflictStrategy === "overwrite",
        removePrevious: removePrevious,
      });
      handleClose();
    } catch {
      // Error handling is done in the mutation
    }
  }, [
    getSelectedFunctions,
    createFunctionsMutation,
    conflictStrategy,
    removePrevious,
    handleClose,
  ]);

  const handleBackToSource = useCallback(() => {
    setStep("source");
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        preventCloseOnClickOutside
        preventCloseOnEscapeKeyDown
      >
        <DialogHeader>
          <DialogTitle>Import Functions from OpenAPI</DialogTitle>
          {step === "source" && (
            <DialogDescription>
              Select the OpenAPI source to import functions from
            </DialogDescription>
          )}
          {step === "review" && (
            <DialogDescription>
              Review and select the functions to import
            </DialogDescription>
          )}
        </DialogHeader>

        {step === "source" && (
          <ImportSourceSelector
            importSource={importSource}
            onImportSourceChange={setImportSource}
            url={url}
            onUrlChange={setUrl}
            isLoading={isLoading}
            onImport={handleImport}
            basicAuth={basicAuth}
            onBasicAuthChange={setBasicAuth}
            basicAuthInfo={basicAuthInfo}
            onBasicAuthInfoChange={setBasicAuthInfo}
          />
        )}

        {step === "review" && (
          <FunctionReview
            appName={appName}
            openApiDocument={openApiDocument}
            functionGroups={functionGroups}
            conflictStrategy={conflictStrategy}
            onConflictStrategyChange={setConflictStrategy}
            removePrevious={removePrevious}
            onRemovePreviousChange={setRemovePrevious}
            onToggleGroup={toggleGroup}
            onToggleGroupSelection={toggleGroupSelection}
            onToggleFunctionSelection={toggleFunctionSelection}
            onEditFunctionName={handleEditFunctionName}
            onBack={handleBackToSource}
            onCancel={handleClose}
            onConfirm={handleConfirm}
            isCreating={createFunctionsMutation.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
