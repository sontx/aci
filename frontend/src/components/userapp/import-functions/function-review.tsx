"use client";

import React, { useCallback, useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  AlertTriangle,
  Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FunctionUpsert } from "@/lib/types/appfunction";
import type { OpenAPIV3 } from "openapi-types";
import { useUserAppFunctions } from "@/hooks/use-user-app";

export type ConflictStrategy = "overwrite" | "skip";

export interface SelectableFunction extends FunctionUpsert {
  selected?: boolean;
  originalIndex?: number;
  isDuplicate?: boolean;
  isEditing?: boolean;
  tempName?: string;
}

export interface FunctionGroup {
  tag: string;
  functions: SelectableFunction[];
  expanded: boolean;
  selected: boolean;
  indeterminate: boolean;
  originalIndex?: number;
}

interface FunctionReviewProps {
  appName: string;
  openApiDocument: OpenAPIV3.Document | null;
  functionGroups: FunctionGroup[];
  conflictStrategy: ConflictStrategy;
  onConflictStrategyChange: (strategy: ConflictStrategy) => void;
  removePrevious?: boolean;
  onRemovePreviousChange?: (remove: boolean) => void;
  onToggleGroup: (groupIndex: number) => void;
  onToggleGroupSelection: (groupIndex: number) => void;
  onToggleFunctionSelection: (
    groupIndex: number,
    functionIndex: number,
  ) => void;
  onEditFunctionName: (
    groupIndex: number,
    functionIndex: number,
    newName: string,
  ) => void;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  isCreating: boolean;
}

const FunctionGroupItem = React.memo<{
  group: FunctionGroup;
  groupIndex: number;
  hasExpandedGroups: boolean;
  existingFunctionNames: Set<string>;
  onToggleGroup: (groupIndex: number) => void;
  onToggleGroupSelection: (groupIndex: number) => void;
  onToggleFunctionSelection: (
    groupIndex: number,
    functionIndex: number,
  ) => void;
  onEditFunctionName: (
    groupIndex: number,
    functionIndex: number,
    newName: string,
  ) => void;
}>(
  ({
    group,
    groupIndex,
    hasExpandedGroups,
    onToggleGroup,
    onToggleGroupSelection,
    onToggleFunctionSelection,
    onEditFunctionName,
  }) => {
    const originalIndex = group.originalIndex ?? groupIndex;

    // Check if group has any warnings
    const groupHasWarnings = useMemo(() => {
      return group.functions.some((func) => func.isDuplicate);
    }, [group.functions]);

    const handleGroupClick = useCallback(() => {
      onToggleGroup(originalIndex);
    }, [originalIndex, onToggleGroup]);

    const handleGroupSelectionChange = useCallback(() => {
      onToggleGroupSelection(originalIndex);
    }, [originalIndex, onToggleGroupSelection]);

    const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
    }, []);

    const handleFunctionSelectionChange = useCallback(
      (functionIndex: number) => () => {
        const func = group.functions[functionIndex];
        const originalFunctionIndex = func.originalIndex ?? functionIndex;
        onToggleFunctionSelection(originalIndex, originalFunctionIndex);
      },
      [originalIndex, onToggleFunctionSelection, group.functions],
    );

    const handleEditStart = useCallback(
      (functionIndex: number) => {
        // This will be handled by parent component to update the function's editing state
        const func = group.functions[functionIndex];
        const originalFunctionIndex = func.originalIndex ?? functionIndex;
        onEditFunctionName(originalIndex, originalFunctionIndex, func.name);
      },
      [originalIndex, onEditFunctionName, group.functions],
    );

    const handleEditSave = useCallback(
      (functionIndex: number, newName: string) => {
        const func = group.functions[functionIndex];
        const originalFunctionIndex = func.originalIndex ?? functionIndex;
        onEditFunctionName(originalIndex, originalFunctionIndex, newName);
      },
      [originalIndex, onEditFunctionName, group.functions],
    );

    return (
      <div
        className={cn(
          "border rounded-lg",
          hasExpandedGroups && !group.expanded && "blur-sm",
        )}
      >
        <div
          className="flex items-center justify-between space-x-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/70"
          onClick={handleGroupClick}
        >
          <div className="flex items-center space-x-3">
            <Checkbox
              checked={group.indeterminate ? "indeterminate" : group.selected}
              onCheckedChange={handleGroupSelectionChange}
              onClick={handleCheckboxClick}
            />
            <div className="flex items-center space-x-2 flex-1 text-left">
              <span className="font-medium">{group.tag}</span>
              <Badge variant="secondary" className="text-xs">
                {group.functions.length}
              </Badge>
              {groupHasWarnings && (
                <div title="Contains duplicate function names (existing in app or within import)">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                </div>
              )}
            </div>
          </div>

          {group.expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>

        {group.expanded && (
          <div className="border-t">
            {group.functions.map((func, functionIndex) => (
              <div
                key={`${group.tag}-${functionIndex}`}
                className="group flex items-start space-x-3 p-3 border-b last:border-b-0 hover:bg-muted/20"
              >
                <Checkbox
                  id={`function-${group.tag}-${func.name}`}
                  className="mt-0.5"
                  checked={group.selected || func.selected}
                  onCheckedChange={handleFunctionSelectionChange(functionIndex)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      {func.isEditing ? (
                        <Input
                          defaultValue={func.tempName || func.name}
                          className="h-6 text-sm font-medium"
                          onBlur={(e) =>
                            handleEditSave(functionIndex, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleEditSave(
                                functionIndex,
                                e.currentTarget.value,
                              );
                            } else if (e.key === "Escape") {
                              handleEditSave(functionIndex, func.name); // Cancel editing
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <label
                          htmlFor={`function-${group.tag}-${func.name}`}
                          className={cn(
                            "font-medium text-sm truncate cursor-pointer",
                            func.isDuplicate && "text-yellow-700",
                          )}
                          title={func.name}
                        >
                          {func.name}
                        </label>
                      )}
                      {func.isDuplicate && !func.isEditing && (
                        <div title="Duplicate function name - already exists in the app or appears multiple times in import">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        </div>
                      )}
                      {!func.isEditing && (
                        <button
                          onClick={() => handleEditStart(functionIndex)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all"
                          title="Edit function name"
                        >
                          <Edit2 className="h-3 w-3 text-gray-500" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <label
                        className="text-xs text-muted-foreground font-mono"
                        title={func.protocol_data.path}
                      >
                        {func.protocol_data.path}
                      </label>
                    </div>
                  </div>
                  {func.description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {func.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);

FunctionGroupItem.displayName = "FunctionGroupItem";

export const FunctionReview = React.memo<FunctionReviewProps>(
  ({
    appName,
    openApiDocument,
    functionGroups,
    conflictStrategy,
    onConflictStrategyChange,
    removePrevious,
    onRemovePreviousChange,
    onToggleGroup,
    onToggleGroupSelection,
    onToggleFunctionSelection,
    onEditFunctionName,
    onBack,
    onCancel,
    onConfirm,
    isCreating,
  }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [showWarningsOnly, setShowWarningsOnly] = useState(false);

    // Fetch existing functions to detect duplicates
    const { data: existingFunctions } = useUserAppFunctions(appName);

    const existingFunctionNames = useMemo(() => {
      return new Set(existingFunctions?.map((func) => func.name) || []);
    }, [existingFunctions]);

    const filteredFunctionGroups = useMemo(() => {
      // First, collect all function names from all groups to detect internal duplicates
      const allFunctionNames = new Map<string, number>();
      functionGroups.forEach((group) => {
        group.functions.forEach((func) => {
          const count = allFunctionNames.get(func.name) || 0;
          allFunctionNames.set(func.name, count + 1);
        });
      });

      let groups = functionGroups.map((group, index) => ({
        ...group,
        originalIndex: index,
        functions: group.functions.map((func, funcIndex) => ({
          ...func,
          originalIndex: funcIndex,
          isDuplicate:
            existingFunctionNames.has(func.name) ||
            (allFunctionNames.get(func.name) || 0) > 1,
        })),
      }));

      // Apply search filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        groups = groups
          .map((group) => ({
            ...group,
            functions: group.functions.filter((func) =>
              func.name.toLowerCase().includes(searchLower),
            ),
          }))
          .filter((group) => group.functions.length > 0);
      }

      // Apply warnings filter
      if (showWarningsOnly) {
        groups = groups
          .map((group) => ({
            ...group,
            functions: group.functions.filter((func) => func.isDuplicate),
          }))
          .filter((group) => group.functions.length > 0);
      }

      return groups;
    }, [functionGroups, searchTerm, showWarningsOnly, existingFunctionNames]);

    const hasExpandedGroups = useMemo(
      () => filteredFunctionGroups.some((group) => group.expanded),
      [filteredFunctionGroups],
    );

    const selectedFunctionsCount = useMemo(() => {
      return filteredFunctionGroups.reduce((count, group) => {
        return (
          count +
          group.functions.filter((f) => group.selected || f.selected).length
        );
      }, 0);
    }, [filteredFunctionGroups]);

    const totalFunctionsCount = useMemo(() => {
      return filteredFunctionGroups.reduce((count, group) => {
        return count + group.functions.length;
      }, 0);
    }, [filteredFunctionGroups]);

    // Check if there are any warnings (duplicate function names)
    const hasWarnings = useMemo(() => {
      return filteredFunctionGroups.some((group) =>
        group.functions.some(
          (func) => func.isDuplicate && (group.selected || func.selected),
        ),
      );
    }, [filteredFunctionGroups]);

    // Count total warnings
    const warningsCount = useMemo(() => {
      return functionGroups.reduce((count, group) => {
        return (
          count +
          group.functions.filter((func) => {
            const allFunctionNames = functionGroups.flatMap((g) =>
              g.functions.map((f) => f.name),
            );
            const isDuplicateInImport =
              allFunctionNames.filter((name) => name === func.name).length > 1;
            const isDuplicateInExisting = existingFunctionNames.has(func.name);
            return isDuplicateInImport || isDuplicateInExisting;
          }).length
        );
      }, 0);
    }, [functionGroups, existingFunctionNames]);

    // Reset warnings filter if there are no warnings
    useEffect(() => {
      if (warningsCount === 0 && showWarningsOnly) {
        setShowWarningsOnly(false);
      }
    }, [warningsCount, showWarningsOnly]);

    const selectAllState = useMemo(() => {
      if (totalFunctionsCount === 0) return false;
      if (selectedFunctionsCount === 0) return false;
      if (selectedFunctionsCount === totalFunctionsCount) return true;
      return "indeterminate";
    }, [selectedFunctionsCount, totalFunctionsCount]);

    const handleSelectAllChange = useCallback(() => {
      if (selectAllState === true) {
        // Unselect all - toggle off all selected groups
        filteredFunctionGroups.forEach((group) => {
          const originalIndex = group.originalIndex ?? 0;
          if (group.selected || group.indeterminate) {
            onToggleGroupSelection(originalIndex);
          }
        });
      } else {
        // Select all - toggle on all unselected groups
        filteredFunctionGroups.forEach((group) => {
          const originalIndex = group.originalIndex ?? 0;
          if (!group.selected) {
            onToggleGroupSelection(originalIndex);
          }
        });
      }
    }, [selectAllState, filteredFunctionGroups, onToggleGroupSelection]);

    return (
      <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
        {openApiDocument && (
          <div className="flex items-center gap-2">
            {openApiDocument.info.title || "Untitled"}
            <Badge variant="outline">
              {openApiDocument.info.version || "N/A"}
            </Badge>
          </div>
        )}

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search functions by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 focus-visible:ring-0"
            />
          </div>
          {warningsCount > 0 && (
            <Button
              variant={showWarningsOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowWarningsOnly(!showWarningsOnly)}
              className={cn(
                "flex items-center gap-2",
                warningsCount > 0 &&
                  !showWarningsOnly &&
                  "border-yellow-300 hover:border-yellow-400 hover:bg-yellow-50",
                showWarningsOnly && "bg-yellow-600 hover:bg-yellow-700",
              )}
              title="Show only functions with duplicate names"
            >
              <AlertTriangle className="h-4 w-4" />
              Warnings {warningsCount > 0 && `(${warningsCount})`}
            </Button>
          )}
          <div className="flex items-center">
            <Checkbox
              id="select-all-functions"
              checked={selectAllState}
              onCheckedChange={handleSelectAllChange}
              disabled={totalFunctionsCount === 0}
            />
            <label
              htmlFor="select-all-functions"
              className="ml-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Select All
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-auto space-y-2">
          {filteredFunctionGroups.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {showWarningsOnly
                ? "No functions with duplicate names found"
                : searchTerm.trim()
                  ? "No functions match your search criteria"
                  : "No functions available"}
            </div>
          ) : (
            filteredFunctionGroups.map((group, groupIndex) => (
              <FunctionGroupItem
                key={group.tag}
                group={group}
                groupIndex={groupIndex}
                hasExpandedGroups={hasExpandedGroups}
                existingFunctionNames={existingFunctionNames}
                onToggleGroup={onToggleGroup}
                onToggleGroupSelection={onToggleGroupSelection}
                onToggleFunctionSelection={onToggleFunctionSelection}
                onEditFunctionName={onEditFunctionName}
              />
            ))
          )}
        </div>

        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <label>On duplicated endpoints</label>
            <Select
              value={conflictStrategy}
              onValueChange={onConflictStrategyChange}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overwrite">Overwrite</SelectItem>
                <SelectItem value="skip">Skip</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="remove-previous">Remove old functions</label>
            <Checkbox
              id="remove-previous"
              checked={removePrevious}
              onCheckedChange={onRemovePreviousChange}
            />
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <div className="space-x-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={
                isCreating || selectedFunctionsCount === 0 || hasWarnings
              }
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                `Create ${selectedFunctionsCount} function${
                  selectedFunctionsCount !== 1 ? "s" : ""
                }`
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  },
);

FunctionReview.displayName = "FunctionReview";
