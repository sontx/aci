import { useCallback, useState } from "react";
import { PaginationOptions } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { PaginationParams } from "@/lib/types/common";

const DEFAULT_PAGE_SIZE = 15;

export function usePagination() {
  const [currentPage, setCurrentPage] = useState(0); // 0-based for table
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const handlePageChange = useCallback((pageIndex: number) => {
    setCurrentPage(pageIndex);
  }, []);

  const resetPagination = useCallback(() => {
    setCurrentPage(0);
  }, []);

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      setPageSize(newPageSize);
      resetPagination(); // Reset to first page when changing page size
    },
    [resetPagination],
  );

  return {
    feParams: {
      initialPageIndex: 0,
      initialPageSize: DEFAULT_PAGE_SIZE,
      onPageChange: handlePageChange,
      onPageSizeChange: handlePageSizeChange,
    },
    beParams: {
      pageSize,
      offset: currentPage * pageSize,
    },
    resetPagination,
  } as {
    feParams: Omit<PaginationOptions, "totalCount">;
    beParams: PaginationParams;
    resetPagination: () => void;
  };
}
