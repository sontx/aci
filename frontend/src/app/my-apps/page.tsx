"use client";

import { Button } from "@/components/ui/button";
import { GoPlus } from "react-icons/go";
import { AlertCircle, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  EnhancedDataTable,
  SearchBarProps,
} from "@/components/ui-extensions/enhanced-data-table/data-table";
import { useSearchUserApps } from "@/hooks/use-user-app";
import { useUserAppsTableColumns } from "@/components/userapp/useUserAppsTableColumns";
import { UserAppForm } from "@/components/userapp/user-app-form/user-app-form";
import { useCallback, useMemo, useState } from "react";
import { UserAppSearchParams } from "@/lib/types/userapp";
import { useDebounce } from "@uidotdev/usehooks";
import { usePagination } from "@/hooks/use-pagination";

export default function MyAppsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | undefined>(
    undefined,
  );
  const { beParams, feParams, resetPagination } = usePagination();
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const searchParams: UserAppSearchParams = {
    search: debouncedSearchQuery || null,
    categories: filterCategory ? [filterCategory] : undefined,
    ...beParams,
  };

  const {
    data: searchResult,
    isPending,
    isError,
  } = useSearchUserApps(searchParams);

  const columns = useUserAppsTableColumns();

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      resetPagination();
    },
    [resetPagination],
  );

  const searchBarProps: SearchBarProps = useMemo(() => {
    return {
      placeholder: "Search user apps...",
      serverSearchFn: handleSearchChange,
    };
  }, [handleSearchChange]);

  const serverFilterFn = useCallback(
    (columnName: string, value: string | undefined) => {
      if (columnName === "categories") {
        setFilterCategory(value);
        resetPagination();
      }
    },
    [resetPagination],
  );

  return (
    <div>
      <div className="m-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Apps</h1>
            <p className="text-sm text-muted-foreground">
              Manage your organization&#39;s applications and their
              configurations.
            </p>
          </div>
          <UserAppForm title="Create User App">
            <Button>
              <GoPlus className="h-4 w-4" />
              Create App
            </Button>
          </UserAppForm>
        </div>
      </div>
      <Separator />

      <div className="m-4">
        {isPending ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="animate-spin h-10 w-10 text-gray-500 mr-4" />
            Loading user apps...
          </div>
        ) : isError ? (
          <div className="flex justify-center items-center py-16">
            <AlertCircle className="h-10 w-10 text-red-500 mr-4" />
            Failed to load user apps. Please try to refresh the page.
          </div>
        ) : (
          <EnhancedDataTable
            columns={columns}
            data={searchResult?.items || []}
            searchBarProps={searchBarProps}
            serverFilterFn={serverFilterFn}
            paginationOptions={{
              ...feParams,
              totalCount: searchResult?.total,
            }}
          />
        )}
      </div>
    </div>
  );
}
