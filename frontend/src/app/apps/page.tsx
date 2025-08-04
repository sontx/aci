"use client";

import {
  AppFilter,
  FilterCategory,
  SortOption,
} from "@/components/apps/app-filter";
import { AppGridContent } from "@/components/apps/app-grid-content";
import { Separator } from "@/components/ui/separator";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { useCategories, useSearchApps } from "@/hooks/use-app";
import { useAppConfigs } from "@/hooks/use-app-config";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useDebounce } from "@uidotdev/usehooks";

const ITEMS_PER_PAGE = 18;

export default function AppStorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(
    FilterCategory.ALL,
  );
  const [sortOrder, setSortOrder] = useState<string>(SortOption.DEFAULT);
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Reset page when search parameters change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleSortChange = (sort: string) => {
    setSortOrder(sort);
    setCurrentPage(1);
  };

  const searchParams = {
    search: debouncedSearchQuery || undefined,
    categories:
      selectedCategory !== FilterCategory.ALL &&
      selectedCategory !== FilterCategory.CONFIGURED &&
      selectedCategory !== FilterCategory.UNCONFIGURED
        ? [selectedCategory]
        : undefined,
    limit: ITEMS_PER_PAGE,
    offset: (currentPage - 1) * ITEMS_PER_PAGE,
  };

  const {
    data: searchResult,
    isPending,
    isError,
  } = useSearchApps(searchParams);
  const { data: appConfigs = [] } = useAppConfigs();

  const configuredAppNames = useMemo(() => {
    return new Set(appConfigs.map((config) => config.app_name));
  }, [appConfigs]);

  const { data: categories = [] } = useCategories();

  // Filter apps based on configuration status
  const filteredApps = useMemo(() => {
    if (!searchResult?.items) return [];

    let filtered = searchResult.items;

    if (selectedCategory === FilterCategory.CONFIGURED) {
      filtered = filtered.filter((app) => configuredAppNames.has(app.name));
    } else if (selectedCategory === FilterCategory.UNCONFIGURED) {
      filtered = filtered.filter((app) => !configuredAppNames.has(app.name));
    }

    // Apply sorting
    switch (sortOrder) {
      case SortOption.ALPHABETICAL:
        return [...filtered].sort((a, b) =>
          a.display_name.localeCompare(b.display_name),
        );
      case SortOption.REVERSE_ALPHABETICAL:
        return [...filtered].sort((a, b) =>
          b.display_name.localeCompare(a.display_name),
        );
      default:
        return filtered;
    }
  }, [searchResult?.items, selectedCategory, configuredAppNames, sortOrder]);

  const totalPages = Math.ceil((searchResult?.total || 0) / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div>
      <div className="m-4">
        <h1 className="text-2xl font-bold">App Store</h1>
        <p className="text-sm text-muted-foreground">
          Browse and connect with your favorite apps and tools.
        </p>
      </div>
      <Separator />

      <div className="m-4 space-y-6">
        <AppFilter
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          categories={categories}
        />

        {isPending ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="animate-spin h-10 w-10 text-gray-500" />
            Loading apps...
          </div>
        ) : isError ? (
          <div className="flex justify-center items-center py-16">
            <AlertCircle className="h-10 w-10 text-red-500" />
            Failed to load apps. Please try to refresh the page.
          </div>
        ) : (
          <>
            <AppGridContent
              apps={filteredApps}
              configuredAppNames={configuredAppNames}
              showComingSoon={currentPage === 1 && !debouncedSearchQuery}
            />

            {totalPages > 1 && (
              <Pagination className="pb-2">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        currentPage > 1 && handlePageChange(currentPage - 1)
                      }
                      className={
                        currentPage <= 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>

                  {generatePageNumbers().map((page, index) => (
                    <PaginationItem key={index}>
                      {page === "ellipsis" ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          onClick={() => handlePageChange(page as number)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        currentPage < totalPages &&
                        handlePageChange(currentPage + 1)
                      }
                      className={
                        currentPage >= totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>
    </div>
  );
}
