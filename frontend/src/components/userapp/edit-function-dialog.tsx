import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RichSwitch } from "@/components/ui-extensions/rich-switch";
import { FunctionUpdate } from "@/lib/types/appfunction";
import {
  useUpdateUserAppFunction,
  useUserAppFunction,
  useGetAllFunctionTags,
} from "@/hooks/use-user-app";
import { MultiSelect, Option } from "@/components/ui-extensions/multi-select";
import { toast } from "sonner";

const editFunctionSchema = z.object({
  description: z.string().min(1, "Description is required"),
  tags: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

type EditFunctionFormData = z.infer<typeof editFunctionSchema>;

export interface EditFunctionDialogProps {
  functionName: string;
  appName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditFunctionDialog({
  functionName,
  appName,
  open = false,
  onOpenChange,
}: EditFunctionDialogProps) {
  const { data: func } = useUserAppFunction(appName, functionName);
  const { data: allTags = [] } = useGetAllFunctionTags();
  const { mutateAsync: updateFunction, isPending } = useUpdateUserAppFunction(
    appName,
    functionName,
  );

  const form = useForm<EditFunctionFormData>({
    resolver: zodResolver(editFunctionSchema),
    defaultValues: {
      description: "",
      tags: [],
      active: true,
    },
  });

  // Reset form when function data changes
  useEffect(() => {
    if (func) {
      form.reset({
        description: func.description,
        tags: func.tags || [],
        active: true, // Default to true since it's not in the AppFunction type
      });
    }
  }, [func, form]);

  const onSubmit = async (data: EditFunctionFormData) => {
    try {
      const updateData: FunctionUpdate = {
        description: data.description,
        tags: data.tags,
        active: data.active,
        visibility: "public", // Default visibility
      };

      await updateFunction(updateData);
      onOpenChange?.(false);
      toast.success("Function updated successfully");
    } catch (error) {
      toast.error(
        `Failed to update function: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  };

  // Convert tags to options for MultiSelect
  const tagOptions: Option[] = allTags.map((tag) => ({
    value: tag,
    label: tag,
  }));

  if (!func) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Function</DialogTitle>
          <DialogDescription>
            Modify the configuration and details for{" "}
            <strong>{func.display_name || func.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormItem>
                <FormLabel>Function Name</FormLabel>
                <FormControl>
                  <Input value={func.name} disabled />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what this function does..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <MultiSelect
                        value={field.value.map((tag) => ({
                          value: tag,
                          label: tag,
                        }))}
                        onChange={(selectedOptions: Option[]) => {
                          const newTags = selectedOptions.map(
                            (option) => option.value,
                          );
                          field.onChange(newTags);
                        }}
                        options={tagOptions}
                        placeholder="Select or add tags..."
                        creatable
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="border rounded-md p-4">
                        <RichSwitch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          label={
                            field.value ? "Enable Function" : "Disable Function"
                          }
                          description="Disabled functions will not be available for use."
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange?.(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Updating..." : "Update Function"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
