"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

enum FilterCategory {
  ALL = "all",
  CONFIGURED = "configured",
  UNCONFIGURED = "unconfigured",
}

enum SortOption {
  DEFAULT = "default",
  ALPHABETICAL = "alphabetical",
  REVERSE_ALPHABETICAL = "reverse-alphabetical",
}

interface AppFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  sortOrder: string;
  onSortChange: (sort: string) => void;
  categories: string[];
}

export function AppFilter({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  sortOrder,
  onSortChange,
  categories,
}: AppFilterProps) {
  return (
    <div className="flex items-center gap-3">
      <Input
        placeholder="Search apps by name or description..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-xs"
      />

      <Select
        onValueChange={onCategoryChange}
        defaultValue={FilterCategory.ALL}
        value={selectedCategory}
      >
        <SelectTrigger className="w-auto min-w-[200px]">
          <div className="pr-2">
            <span className="text-muted-foreground mr-1">Category:</span>
            <SelectValue placeholder="all" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FilterCategory.ALL}>All Apps</SelectItem>
          <SelectItem value={FilterCategory.CONFIGURED}>
            Configured Apps
          </SelectItem>
          <SelectItem value={FilterCategory.UNCONFIGURED}>
            Unconfigured Apps
          </SelectItem>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={onSortChange}
        defaultValue={SortOption.DEFAULT}
        value={sortOrder}
      >
        <SelectTrigger className="w-auto min-w-[180px]">
          <div className="pr-2">
            <span className="text-muted-foreground mr-1">Sort:</span>
            <SelectValue placeholder="Default" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SortOption.DEFAULT}>Default</SelectItem>
          <SelectItem value={SortOption.ALPHABETICAL}>Ascending A-Z</SelectItem>
          <SelectItem value={SortOption.REVERSE_ALPHABETICAL}>
            Descending Z-A
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export { FilterCategory, SortOption };
