"use client";

import { type AppFunction } from "@/lib/types/appfunction";
import { useMemo } from "react";
import { IdDisplay } from "@/components/apps/id-display";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GoTrash } from "react-icons/go";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useDeleteUserAppFunction } from "@/hooks/use-user-app";

const columnHelper = createColumnHelper<AppFunction>();

export const useUserAppFunctionsColumns = (): ColumnDef<AppFunction>[] => {
  const { appName } = useParams<{ appName: string }>();
  const { mutateAsync: deleteUserAppFunction } = useDeleteUserAppFunction(
    appName,
    "",
  );

  return useMemo(() => {
    return [
      columnHelper.accessor("display_name", {
        header: "Function Name",
        cell: (info) => (
          <IdDisplay
            href={`/my-apps/${appName}/${info.row.original.name}`}
            id={info.row.original.name}
            displayName={info.getValue()}
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
        cell: (info) => (
          <div className="max-w-[500px] line-clamp-2" title={info.getValue()}>
            {info.getValue()}
          </div>
        ),
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("tags", {
        header: "Tags",
        cell: (info) => (
          <div className="flex flex-wrap gap-2 overflow-hidden">
            {(info.getValue() || []).map((tag: string) => (
              <Badge key={tag} variant="normal" className="text-nowrap">
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

      columnHelper.accessor((row) => row, {
        id: "actions",
        header: () => null,
        cell: (info) => {
          const functionItem = info.getValue();
          return (
            <div className="flex justify-center">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-800"
                  >
                    <GoTrash className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Function</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the function{" "}
                      <strong>
                        {functionItem.display_name || functionItem.name}
                      </strong>
                      ? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await deleteUserAppFunction(functionItem.name);
                        } catch (error) {
                          console.error("Failed to delete function:", error);
                          toast.error("Failed to delete function");
                        }
                      }}
                      destructive
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
        enableGlobalFilter: false,
      }),
    ] as ColumnDef<AppFunction>[];
  }, [appName, deleteUserAppFunction]);
};
