"use client";

import { useParams, useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { useDeleteUserApp, useUserApp } from "@/hooks/use-user-app";
import { UserAppOverview } from "@/components/userapp/user-app-overview";
import { UserAppFunctions } from "@/components/userapp/user-app-functions";
import { AlertCircle, Edit, Loader2, Trash2 } from "lucide-react";
import { IdDisplay } from "@/components/apps/id-display";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { UserAppForm } from "@/components/userapp/user-app-form/user-app-form";
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

export default function UserAppDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const appName = params.appName as string;

  const { data: userApp, isPending, isError } = useUserApp(appName);
  const { mutateAsync: deleteUserApp } = useDeleteUserApp();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const secondaryActions = useMemo<SecondaryAction[]>(
    () => [
      {
        label: "Delete App",
        description: "Permanently delete this user app and all functions",
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
        Loading user app details...
      </div>
    );
  }

  if (isError || !userApp) {
    return (
      <div className="flex justify-center items-center py-16">
        <AlertCircle className="h-10 w-10 text-red-500 mr-4" />
        Failed to load user app details. Please try again.
      </div>
    );
  }

  return (
    <>
      <div className="m-4 flex items-center justify-between">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
              <Image
                src={userApp.logo || "/icon/default-app-icon.svg"}
                alt={`${userApp.display_name} logo`}
                fill
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{userApp.display_name}</h1>
              <IdDisplay id={userApp.name} />
            </div>
          </div>
          {userApp.description && (
            <div className="max-w-3xl text-sm text-muted-foreground">
              {userApp.description}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <MoreButton
            primaryActionComponent={
              <UserAppForm title="Edit User App" userAppName={userApp.name}>
                <Button className="rounded-r-none border-r-0">
                  <Edit className="h-4 w-4" />
                  Edit App
                </Button>
              </UserAppForm>
            }
            secondaryActions={secondaryActions}
          />
        </div>
      </div>

      <Separator />

      <div className="m-4 mb-5">
        <UserAppOverview userApp={userApp} />
      </div>

      <Separator />

      <div className="m-4">
        <UserAppFunctions userApp={userApp} />
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User App</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the user app{" "}
              <strong>{userApp.display_name}</strong>? This action cannot be
              undone and will remove all associated functions and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await deleteUserApp(userApp.name);
                  router.push("/my-apps");
                } catch (error) {
                  console.error("Failed to delete user app:", error);
                  toast.error("Failed to delete user app");
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
