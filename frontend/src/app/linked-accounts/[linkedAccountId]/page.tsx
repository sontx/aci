"use client";

import {
  EditLinkedAccountForm,
  LinkedAccountOverview,
} from "@/components/linkedaccount";
import { LogsView } from "@/components/logs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MoreButton,
  SecondaryAction,
} from "@/components/ui-extensions/more-button";
import { useApp } from "@/hooks/use-app";
import {
  useDeleteLinkedAccount,
  useLinkedAccount,
} from "@/hooks/use-linked-account";
import { Edit, Trash2 } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export default function LinkedAccountDetailPage() {
  const { linkedAccountId } = useParams<{ linkedAccountId: string }>();
  const router = useRouter();

  const { data: linkedAccount, isLoading: isLinkedAccountLoading } =
    useLinkedAccount(linkedAccountId);
  const { data: app } = useApp(linkedAccount?.app_name || "");
  const { mutateAsync: deleteLinkedAccount } = useDeleteLinkedAccount();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!linkedAccount) return;

    try {
      await deleteLinkedAccount({
        linkedAccountId: linkedAccount.id,
      });
      toast.success(
        `Linked account ${linkedAccount.linked_account_owner_id} deleted`,
      );
      router.push("/linked-accounts");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete linked account");
    }
  }, [linkedAccount, deleteLinkedAccount, router]);

  const secondaryActions = useMemo<SecondaryAction[]>(
    () => [
      {
        label: "Delete Account",
        description: "Permanently delete this linked account",
        icon: <Trash2 className="h-4 w-4" />,
        onClick: () => {
          setShowDeleteDialog(true);
        },
        destructive: true,
      },
    ],
    [],
  );

  if (isLinkedAccountLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!linkedAccount) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Linked account not found
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
            {app && (
              <Image
                src={app?.logo || "/icon/default-app-icon.svg"}
                alt={`${app?.display_name} logo`}
                fill
                className="object-contain"
              />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">
              {linkedAccount.linked_account_owner_id}
            </h1>
            <span className="text-sm text-muted-foreground">
              {linkedAccount.description}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <MoreButton
            primaryActionComponent={
              <EditLinkedAccountForm linkedAccount={linkedAccount}>
                <Button className="rounded-r-none border-r-0">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Account
                </Button>
              </EditLinkedAccountForm>
            }
            secondaryActions={secondaryActions}
          />
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Account Details</TabsTrigger>
          <TabsTrigger value="logs">Execution Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <LinkedAccountOverview linkedAccount={linkedAccount} />
        </TabsContent>

        <TabsContent value="logs" className="pt-4">
          <LogsView
            linkedAccountOwnerId={linkedAccount.linked_account_owner_id}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Linked Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the linked account for owner ID{" "}
              <strong>{linkedAccount.linked_account_owner_id}</strong>? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              destructive
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
