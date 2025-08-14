"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FunctionDetailContent } from "@/components/apps/function-detail-content";
import {
  useDeleteUserAppFunction,
  useUserAppFunction,
} from "@/hooks/use-user-app";
import {
  MoreButton,
  SecondaryAction,
} from "@/components/ui-extensions/more-button";
import { RunFunctionDialog } from "@/components/userapp/run-function-form";
import { EditFunctionDialog } from "@/components/userapp/edit-function-dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Play, Trash } from "lucide-react";
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

const FunctionDetailPage = () => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const router = useRouter();

  const { functionName, appName } = useParams<{
    functionName: string;
    appName: string;
  }>();
  const { data: func } = useUserAppFunction(appName, functionName);
  const { mutateAsync: deleteFunction } = useDeleteUserAppFunction(
    appName,
    functionName,
  );

  const handleDeleteConfirm = useCallback(async () => {
    try {
      await deleteFunction(functionName);
      // Navigate back to the app's functions list after successful deletion
      router.push(`/my-apps/${appName}`);
    } catch (error) {
      toast.error(
        `Failed to delete function: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsDeleteDialogOpen(false);
    }
  }, [appName, deleteFunction, functionName, router]);

  const secondaryActions = useMemo<SecondaryAction[]>(
    () => [
      {
        label: "Edit Function",
        description: "Modify this function's configuration and details",
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => {
          setIsEditDialogOpen(true);
        },
      },
      {
        label: "Delete Function",
        description: "Permanently delete this function from the app",
        icon: <Trash className="h-4 w-4" />,
        onClick: () => {
          setIsDeleteDialogOpen(true);
        },
        destructive: true,
      },
    ],
    [],
  );

  if (!func) {
    return (
      <div className="m-4">
        <div className="text-center py-8">
          <h1 className="text-xl font-semibold text-muted-foreground">
            Function not found
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            The function &quot;{decodeURIComponent(functionName)}&quot; could
            not be found in this app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="m-4">
      <div className="max-w-6xl">
        <FunctionDetailContent
          func={func}
          actions={
            <MoreButton
              secondaryActions={secondaryActions}
              primaryActionComponent={
                <RunFunctionDialog
                  functionName={func.name}
                  appName={func.app_name}
                >
                  <Button className="rounded-r-none">
                    <Play className="h-4 w-4" />
                    Run Function
                  </Button>
                </RunFunctionDialog>
              }
            />
          }
        />
      </div>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Function</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the function{" "}
              <strong>{func?.name}</strong>? This action cannot be undone and
              will permanently remove the function from your app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={handleDeleteConfirm}>
              Delete Function
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditFunctionDialog
        functionName={func.name}
        appName={func.app_name}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </div>
  );
};

export default FunctionDetailPage;
