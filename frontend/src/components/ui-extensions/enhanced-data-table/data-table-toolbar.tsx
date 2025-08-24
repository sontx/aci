"use client";

import { Table } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import React, { useState } from "react";

interface EnhancedDataTableToolbarProps<TData> {
  table: Table<TData>;
  placeholder?: string;
  showSearchInput?: boolean;
  filterComponent?: React.ReactNode;
  extraActionComponent?: React.ReactNode;
  serverSearchFn?: (query: string) => void;
}

export function EnhancedDataTableToolbar<TData>({
  table,
  placeholder = "Search...",
  showSearchInput,
  filterComponent,
  extraActionComponent,
  serverSearchFn,
}: EnhancedDataTableToolbarProps<TData>) {
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = (value: string) => {
    setSearchValue(value);
    if (serverSearchFn) {
      serverSearchFn(value);
    } else {
      table.setGlobalFilter(value);
    }
  };

  const isFiltered =
    (serverSearchFn && searchValue) || !!table.getState().globalFilter;

  // Don't render toolbar if there's no search input and no filter component
  if (!showSearchInput && !filterComponent) {
    return null;
  }

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-4">
        {showSearchInput && (
          <div className="relative">
            <Input
              placeholder={placeholder}
              value={searchValue}
              onChange={(event) => handleSearch(event.target.value)}
              className="w-[250px] pr-8"
            />
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSearch("")}
                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0 hover:bg-transparent"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </Button>
            )}
          </div>
        )}

        {filterComponent}
      </div>
      {extraActionComponent}
    </div>
  );
}
