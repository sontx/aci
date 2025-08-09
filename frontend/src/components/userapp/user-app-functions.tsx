"use client";

import { UserAppDetails } from "@/lib/types/userapp";
import { useUserAppFunctions } from "@/hooks/use-user-app";
import { AlertCircle, Code, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import { ImportFunctionsDialog } from "./import-functions/import-functions-dialog";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { useUserAppFunctionsColumns } from "@/components/userapp/useUserAppFunctionsColumns";

interface UserAppFunctionsProps {
  userApp: UserAppDetails;
}

export function UserAppFunctions({ userApp }: UserAppFunctionsProps) {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const {
    data: functions,
    isPending,
    isError,
  } = useUserAppFunctions(userApp.name);
  const columns = useUserAppFunctionsColumns();

  return (
    <>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Functions</h2>
          <span className="text-sm text-muted-foreground">
            ({functions ? functions.length : 0})
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Functions allow your app to perform specific tasks or operations.
        </p>
      </div>

      {isError ? (
        <div className="flex justify-center items-center py-16">
          <AlertCircle className="h-10 w-10 text-red-500 mr-4" />
          Failed to load functions. Please try again.
        </div>
      ) : !functions || functions.length === 0 ? (
        <div className="text-center py-16">
          <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No functions available for this app.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Import from OpenAPI
          </Button>
        </div>
      ) : (
        <EnhancedDataTable
          loading={isPending}
          columns={columns}
          data={functions}
          searchBarProps={{ placeholder: "Search functions..." }}
          paginationOptions={{
            initialPageIndex: 0,
            initialPageSize: 15,
          }}
          extraActionComponent={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportDialogOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Import from OpenAPI
            </Button>
          }
        />
      )}

      <ImportFunctionsDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        appName={userApp.name}
      />
    </>
  );
}
