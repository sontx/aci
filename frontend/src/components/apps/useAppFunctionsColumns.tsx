"use client";

import { type AppFunction } from "@/lib/types/appfunction";
import { useMemo } from "react";
import { IdDisplay } from "@/components/apps/id-display";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";

const columnHelper = createColumnHelper<AppFunction>();

export const useAppFunctionsColumns = (): ColumnDef<AppFunction>[] => {
  const { appName } = useParams<{ appName: string }>();
  return useMemo(() => {
    return [
      columnHelper.accessor("name", {
        header: "Function Name",
        cell: (info) => (
          <IdDisplay
            href={`/apps/${appName}/functions/${encodeURIComponent(info.getValue())}`}
            id={info.getValue()}
            dim={false}
          />
        ),
        enableGlobalFilter: true,
        size: 50,
        /** Column ID needed for default sorting */
        id: "name",
        meta: {
          defaultSort: true,
          defaultSortDesc: true,
        },
      }),

      columnHelper.accessor("description", {
        header: "Description",
        cell: (info) => <div className="max-w-[500px]">{info.getValue()}</div>,
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("tags", {
        header: "Tags",
        cell: (info) => (
          <div className="flex flex-wrap gap-2 overflow-hidden">
            {(info.getValue() || []).map((tag: string) => (
              <Badge key={tag} variant="normal">
                {tag}
              </Badge>
            ))}
          </div>
        ),
        enableGlobalFilter: true,
        /** Set filterFn to "arrIncludes" for array filtering support */
        filterFn: "arrIncludes",
        enableColumnFilter: true,
      }),
    ] as ColumnDef<AppFunction>[];
  }, [appName]);
};
