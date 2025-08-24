"use client";

import { Column } from "@tanstack/react-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCallback, useEffect, useMemo, useState } from "react";

interface ColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
  options?: string[];
  serverFilterFn?: (value: string | undefined) => void;
}

export function ColumnFilter<TData, TValue>({
  column,
  options,
  serverFilterFn,
}: ColumnFilterProps<TData, TValue>) {
  const [selectedValue, setSelectedValue] = useState("_all_");
  const effectiveOptions = useMemo(
    () => options ?? column.columnDef.meta?.filterOptions,
    [column.columnDef.meta?.filterOptions, options],
  );

  useEffect(() => {
    const filterValue = column.getFilterValue() as string;
    if (filterValue) {
      setSelectedValue(filterValue);
    }
  }, [column]);

  const handleChange = useCallback(
    (value: string) => {
      setSelectedValue(value);
      const effectiveValue = value === "_all_" ? undefined : value;
      if (serverFilterFn) {
        serverFilterFn(effectiveValue);
      } else {
        column.setFilterValue(effectiveValue);
      }
    },
    [column, serverFilterFn],
  );

  const filterPrefix =
    typeof column.columnDef.header === "string"
      ? column.columnDef.header
      : column.columnDef.meta?.filterPrefix;

  return (
    <Select value={selectedValue} onValueChange={handleChange}>
      <SelectTrigger className="min-w-[120px]">
        {filterPrefix && selectedValue ? (
          <div className="flex gap-1 items-center select-none pr-2">
            <span className="text-muted-foreground">{filterPrefix}:</span>
            <SelectValue />
          </div>
        ) : (
          <SelectValue placeholder="Select..." />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_all_">{"all"}</SelectItem>
        {effectiveOptions?.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
