"use client";

import { useParams, useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { useAPIKey, useDeleteAPIKey } from "@/hooks/use-api-key";
import { AlertCircle, Edit, Key, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import {
  MoreButton,
  SecondaryAction,
} from "@/components/ui-extensions/more-button";
import { useMemo, useState } from "react";
import { APIKeyDetailSection } from "@/components/apikeys/api-key-detail-section";
import { EditAPIKeyDialog } from "@/components/apikeys/edit-api-key-dialog";
import { LogsView } from "@/components/logs/logs-view";

export default function APIKeyDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const apiKeyName = params.apiKeyName as string;

  const { data: apiKey, isPending, isError } = useAPIKey(apiKeyName);
  const { mutateAsync: deleteAPIKey } = useDeleteAPIKey();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const secondaryActions = useMemo<SecondaryAction[]>(
    () => [
      {
        label: "Delete API Key",
        description: "Permanently delete this API key",
        icon: <Trash2 className="h-4 w-4" />,
        onClick: () => {
          setShowDeleteDialog(true);
        },
        destructive: true,
      },
    ],
    [],
  );

  if (isPending) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin h-10 w-10 text-gray-500 mr-4" />
        Loading API key details...
      </div>
    );
  }

  if (isError || !apiKey) {
    return (
      <div className="flex justify-center items-center py-16">
        <AlertCircle className="h-10 w-10 text-red-500 mr-4" />
        Failed to load API key details. Please try again.
      </div>
    );
  }

  return (
    <>
      <div className="m-4 flex items-center justify-between">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4">
              <Key className="w-12 h-12 hidden md:block" />
              <div>
                <h1 className="text-2xl font-bold">{apiKey.name}</h1>
                <div className="text-sm text-muted-foreground hidden md:block">
                  This API key allows secure programmatic access to your
                  account&apos;s API endpoints.
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <MoreButton
            primaryActionComponent={
              <EditAPIKeyDialog apiKeyName={apiKey.name}>
                <Button className="rounded-r-none border-r-0">
                  <Edit className="h-4 w-4" />
                  Edit API Key
                </Button>
              </EditAPIKeyDialog>
            }
            secondaryActions={secondaryActions}
          />
        </div>
      </div>

      <Separator />

      <div className="m-4 mb-5">
        <APIKeyDetailSection apiKey={apiKey} />
      </div>

      <Separator />

      <div className="m-4">
        <h2 className="text-xl font-semibold mb-4">Usage Logs</h2>
        <LogsView apiKeyName={apiKey.name} showStatistics={false} />
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the API key{" "}
              <strong>{apiKey.name}</strong>? This action cannot be undone and
              will permanently revoke access for any applications using this
              key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await deleteAPIKey(apiKey.name);
                  router.push("/api-keys");
                } catch (error) {
                  console.error("Failed to delete API key:", error);
                  toast.error("Failed to delete API key");
                }
              }}
              destructive
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
