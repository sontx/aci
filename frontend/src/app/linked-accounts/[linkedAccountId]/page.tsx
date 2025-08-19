"use client";

import { IdDisplay } from "@/components/apps/id-display";
import { LinkedAccountOverview } from "@/components/linkedaccount/linked-account-overview";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/hooks/use-app";
import {
  useDeleteLinkedAccount,
  useLinkedAccount,
  useUpdateLinkedAccount,
} from "@/hooks/use-linked-account";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { GoTrash } from "react-icons/go";
import { toast } from "sonner";

export default function LinkedAccountDetailPage() {
  const { linkedAccountId } = useParams<{ linkedAccountId: string }>();
  const router = useRouter();

  const { data: linkedAccount, isLoading: isLinkedAccountLoading } =
    useLinkedAccount(linkedAccountId);
  const { data: app } = useApp(linkedAccount?.app_name || "");
  const { mutateAsync: updateLinkedAccount } = useUpdateLinkedAccount();
  const { mutateAsync: deleteLinkedAccount } = useDeleteLinkedAccount();

  const toggleAccountStatus = useCallback(
    async (accountId: string, newStatus: boolean) => {
      try {
        await updateLinkedAccount({
          linkedAccountId: accountId,
          enabled: newStatus,
        });
        return true;
      } catch (error) {
        console.error("Failed to update linked account:", error);
        return false;
      }
    },
    [updateLinkedAccount],
  );

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
            <IdDisplay id={linkedAccount.id} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <GoTrash className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Deletion?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  linked account for owner ID &quot;
                  {linkedAccount.linked_account_owner_id}&quot;.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Account Details</TabsTrigger>
          <TabsTrigger value="logs">Execution Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <LinkedAccountOverview
            linkedAccount={linkedAccount}
            onToggleStatus={toggleAccountStatus}
          />
        </TabsContent>

        <TabsContent value="logs">
          <LogsView
            linkedAccountOwnerId={linkedAccount.linked_account_owner_id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
