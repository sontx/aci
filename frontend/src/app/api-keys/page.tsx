"use client";

import { Separator } from "@/components/ui/separator";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { useAPIKeys } from "@/hooks/use-api-key";
import { useAPIKeysTableColumns } from "@/components/apikeys/useAPIKeysTableColumns";
import { CreateAPIKeyDialog } from "@/components/apikeys/create-api-key-dialog";
import { usePagination } from "@/hooks/use-pagination";

export default function APIKeysPage() {
  const pagination = usePagination();
  
  const { data: apiKeysData, isPending: isLoading } = useAPIKeys({
    limit: pagination.beParams.limit || 15,
    offset: pagination.beParams.offset || 0,
  });

  const apiKeys = apiKeysData?.items || [];
  const apiKeysColumns = useAPIKeysTableColumns();

  return (
    <div>
      <div className="m-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your API keys for accessing the platform programmatically
          </p>
        </div>
        <CreateAPIKeyDialog />
      </div>
      <Separator />

      <div className="m-4">
        {isLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-sm text-gray-500">Loading API keys...</p>
            </div>
          </div>
        )}
        {!isLoading && (
          <EnhancedDataTable
            data={apiKeys}
            columns={apiKeysColumns}
            defaultSorting={[{ id: "created_at", desc: true }]}
            searchBarProps={{
              placeholder: "Search API keys",
            }}
            paginationOptions={{
              ...pagination.feParams,
              totalCount: apiKeysData?.total,
            }}
          />
        )}
      </div>
    </div>
  );
}
