"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppFunctions } from "@/hooks/use-app-functions";

interface FunctionsSelectorProps {
  appName?: string;
  selectedFunctions: string[];
  onSelectionChange: (selectedFunctions: string[]) => void;
  disabled?: boolean;
  noFixHeight?: boolean;
}

export function FunctionsSelector({
  appName,
  selectedFunctions,
  onSelectionChange,
  disabled = false,
  noFixHeight = false,
}: FunctionsSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Use React Query hook to fetch functions
  const { 
    data: functions = [], 
    isLoading, 
    error: queryError 
  } = useAppFunctions(appName);
  
  const error = queryError ? "Failed to load functions" : null;

  // Filter functions based on search query
  const filteredFunctions = useMemo(() => {
    if (!searchQuery.trim()) return functions;
    
    const query = searchQuery.toLowerCase();
    return functions.filter(
      (func) =>
        func.name.toLowerCase().includes(query) ||
        func.description.toLowerCase().includes(query)
    );
  }, [functions, searchQuery]);

  // Check if all visible functions are selected
  const allVisibleSelected = useMemo(() => {
    if (filteredFunctions.length === 0) return false;
    return filteredFunctions.every((func) => selectedFunctions.includes(func.name));
  }, [filteredFunctions, selectedFunctions]);

  // Check if some (but not all) visible functions are selected
  const someVisibleSelected = useMemo(() => {
    return filteredFunctions.some((func) => selectedFunctions.includes(func.name));
  }, [filteredFunctions, selectedFunctions]);

  const handleSelectAll = () => {
    if (allVisibleSelected) {
      // Unselect all visible functions
      const visibleFunctionNames = filteredFunctions.map((func) => func.name);
      const newSelection = selectedFunctions.filter(
        (name) => !visibleFunctionNames.includes(name)
      );
      onSelectionChange(newSelection);
    } else {
      // Select all visible functions
      const visibleFunctionNames = filteredFunctions.map((func) => func.name);
      const newSelection = Array.from(
        new Set([...selectedFunctions, ...visibleFunctionNames])
      );
      onSelectionChange(newSelection);
    }
  };

  const handleFunctionToggle = (functionName: string, checked: boolean) => {
    if (checked) {
      if (!selectedFunctions.includes(functionName)) {
        onSelectionChange([...selectedFunctions, functionName]);
      }
    } else {
      onSelectionChange(selectedFunctions.filter((name) => name !== functionName));
    }
  };

  if (!appName) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        Select an app configuration to view available functions
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search functions by name or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          disabled={disabled || isLoading}
        />
      </div>

      {/* Check All/Uncheck All */}
      {filteredFunctions.length > 0 && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={
              allVisibleSelected 
                ? true 
                : someVisibleSelected && !allVisibleSelected 
                ? "indeterminate" 
                : false
            }
            onCheckedChange={handleSelectAll}
            disabled={disabled || isLoading}
          />
          <Label htmlFor="select-all" className="text-sm font-medium">
            {allVisibleSelected
              ? "Unselect all"
              : someVisibleSelected
              ? "Select all"
              : "Select all"}
            {searchQuery && ` (${filteredFunctions.length} filtered)`}
          </Label>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Loading functions...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-sm text-red-600 p-4 text-center bg-red-50 rounded-md">
          {error}
        </div>
      )}

      {/* Functions List */}
      {!isLoading && !error && (
        <ScrollArea className={noFixHeight ? "border rounded-md" : "h-64 border rounded-md"}>
          <div className="p-4 space-y-3">
            {filteredFunctions.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? "No functions match your search" : "No functions available"}
              </div>
            ) : (
              filteredFunctions.map((func) => (
                <div key={func.name} className="flex items-start space-x-3">
                  <Checkbox
                    id={func.name}
                    checked={selectedFunctions.includes(func.name)}
                    onCheckedChange={(checked) =>
                      handleFunctionToggle(func.name, checked as boolean)
                    }
                    disabled={disabled}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={func.name}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {func.name}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 break-words">
                      {func.description}
                    </p>
                    {func.tags && func.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {func.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}

      {/* Selected Count */}
      {selectedFunctions.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selectedFunctions.length} function{selectedFunctions.length !== 1 ? "s" : ""} selected
        </div>
      )}
    </div>
  );
}
