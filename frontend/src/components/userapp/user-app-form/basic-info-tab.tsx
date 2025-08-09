import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import React from "react";
import { MultiSelect, Option } from "@/components/ui-extensions/multi-select";
import { useCategories } from "@/hooks/use-app";
import { UserAppFormData } from "@/components/userapp/user-app-form/user-app-schema";

interface BasicInfoTabProps {
  register: UseFormRegister<UserAppFormData>;
  errors: FieldErrors<UserAppFormData>;
  setValue: UseFormSetValue<UserAppFormData>;
  watch: UseFormWatch<UserAppFormData>;
  generatedName: string;
  isEditing: boolean;
  userAppName?: string;
}

export function BasicInfoTab({
  register,
  errors,
  setValue,
  watch,
  generatedName,
  isEditing,
  userAppName,
}: BasicInfoTabProps) {
  const categories = watch("categories");
  const active = watch("active");

  // Get available categories from API
  const { data: availableCategories = [] } = useCategories();

  // Convert categories to options for MultiSelect
  const categoryOptions: Option[] = availableCategories.map((category) => ({
    value: category,
    label: category,
  }));

  // Convert current selected categories to options
  const selectedCategoryOptions: Option[] =
    categories?.map((category) => ({
      value: category,
      label: category,
    })) ?? [];

  const handleCategoryChange = (selectedOptions: Option[]) => {
    const newCategories = selectedOptions.map((option) => option.value);
    setValue("categories", newCategories);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="display_name" required>
            Display Name
          </Label>
          <Input
            id="display_name"
            {...register("display_name")}
            placeholder="e.g., My Awesome App"
          />
          <p className="text-xs text-muted-foreground">
            Display name should be unique across all applications
          </p>
          {errors.display_name && (
            <p className="text-sm text-red-600">
              {errors.display_name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>App Name</Label>
          <div className="p-2 bg-gray-50 rounded border text-sm font-mono">
            {isEditing ? userAppName : generatedName || "ORG_EXAMPLE_APP"}
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-generated from display name{" "}
            {isEditing ? "(cannot be changed)" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="provider" required>
            Provider
          </Label>
          <Input
            id="provider"
            {...register("provider")}
            placeholder="e.g., Your Company"
          />
          {errors.provider && (
            <p className="text-sm text-red-600">{errors.provider.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="version" required>
            Version
          </Label>
          <Input
            id="version"
            {...register("version")}
            placeholder="e.g., 1.0.0"
          />
          {errors.version && (
            <p className="text-sm text-red-600">{errors.version.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Describe what your app does..."
          rows={3}
        />
        {errors.description && (
          <p className="text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="logo">Logo URL</Label>
        <Input
          id="logo"
          {...register("logo")}
          placeholder="https://example.com/logo.png"
        />
        {errors.logo && (
          <p className="text-sm text-red-600">{errors.logo.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Categories</Label>
        <MultiSelect
          value={selectedCategoryOptions}
          onChange={handleCategoryChange}
          options={categoryOptions}
          placeholder="Select or add categories..."
          creatable
          className="w-full"
        />
        {errors.categories && (
          <p className="text-sm text-red-600">{errors.categories.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Switch
            id="active"
            checked={active}
            onCheckedChange={(checked) => setValue("active", checked)}
          />
          <label htmlFor="active" className="text-sm text-muted-foreground">
            {active ? "Active" : "Inactive"}
          </label>
        </div>
      </div>
    </div>
  );
}
