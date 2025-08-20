"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { LinkedAccount } from "@/lib/types/linkedaccount";
import { useUpdateLinkedAccount } from "@/hooks/use-linked-account";
import { toast } from "sonner";
import { GoGear } from "react-icons/go";
import { RichSwitch } from "../ui-extensions/rich-switch";

const editFormSchema = z.object({
  description: z.string().optional(),
  enabled: z.boolean(),
});

type EditFormValues = z.infer<typeof editFormSchema>;

interface EditLinkedAccountFormProps {
  linkedAccount: LinkedAccount;
  children?: React.ReactNode;
}

export function EditLinkedAccountForm({
  linkedAccount,
  children,
}: EditLinkedAccountFormProps) {
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateLinkedAccount, isPending } =
    useUpdateLinkedAccount();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      description: linkedAccount.description || "",
      enabled: linkedAccount.enabled,
    },
  });

  const onSubmit = async (values: EditFormValues) => {
    try {
      await updateLinkedAccount({
        linkedAccountId: linkedAccount.id,
        enabled: values.enabled,
        description: values.description,
      });

      toast.success("Linked account updated successfully");
      setOpen(false);
    } catch (error) {
      console.error("Error updating linked account:", error);
      toast.error("Failed to update linked account");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (open) {
          // Reset form to current values when opening
          form.reset({
            description: linkedAccount.description || "",
            enabled: linkedAccount.enabled,
          });
        }
      }}
    >
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <GoGear className="h-4 w-4 mr-2" />
            Edit Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Linked Account</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description for this linked account"
                      className="min-h-[80px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center rounded-lg border p-4">
                  <FormControl>
                    <RichSwitch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      label="Account Status"
                      description="Enable or disable this linked account"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
