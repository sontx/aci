import { useMemo } from "react";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { UserAppDetails } from "@/lib/types/userapp";
import { Button } from "@/components/ui/button";
import { GoTrash } from "react-icons/go";
import { Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { useDeleteUserApp } from "@/hooks/use-user-app";
import { formatToLocalTime } from "@/utils/time";
import { UserAppForm } from "./user-app-form/user-app-form";
import { AppItemDisplay } from "@/components/apps/app-item-display";

const columnHelper = createColumnHelper<UserAppDetails>();

export const useUserAppsTableColumns = (): ColumnDef<UserAppDetails>[] => {
  const { mutateAsync: deleteUserApp } = useDeleteUserApp();

  return useMemo(
    () => [
      columnHelper.accessor("display_name", {
        header: () => <span className="text-nowrap">App</span>,
        cell: (info) => (
          <AppItemDisplay
            app={info.row.original}
            link={`/my-apps/${info.row.original.name}`}
          />
        ),
        enableGlobalFilter: true,
      }) as ColumnDef<UserAppDetails>,

      columnHelper.accessor("version", {
        header: "Version",
        cell: (info) => (
          <Badge variant="secondary" className="text-xs">
            v{info.getValue()}
          </Badge>
        ),
        enableGlobalFilter: true,
      }) as ColumnDef<UserAppDetails>,

      columnHelper.accessor("provider", {
        header: "Provider",
        cell: (info) => info.getValue(),
        enableGlobalFilter: true,
      }) as ColumnDef<UserAppDetails>,

      columnHelper.accessor("categories", {
        header: "Categories",
        cell: (info) => {
          const categories = info.getValue();
          return (
            <div className="flex flex-wrap gap-1 max-w-48">
              {categories.slice(0, 2).map((category) => (
                <Badge key={category} variant="outline" className="text-xs">
                  {category}
                </Badge>
              ))}
              {categories.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{categories.length - 2}
                </Badge>
              )}
            </div>
          );
        },
        enableGlobalFilter: true,
      }) as ColumnDef<UserAppDetails>,

      columnHelper.accessor("active", {
        header: "Status",
        cell: (info) => {
          const active = info.getValue();
          return (
            <Badge
              variant={active ? "default" : "destructive"}
              className="text-xs"
            >
              {active ? "Active" : "Inactive"}
            </Badge>
          );
        },
        enableGlobalFilter: false,
      }) as ColumnDef<UserAppDetails>,

      columnHelper.accessor("created_at", {
        header: "Created At",
        cell: (info) => (
          <div className="text-nowrap">
            {formatToLocalTime(info.getValue())}
          </div>
        ),
        enableGlobalFilter: false,
      }) as ColumnDef<UserAppDetails>,

      columnHelper.accessor("updated_at", {
        header: "Updated At",
        cell: (info) => (
          <div className="text-nowrap">
            {formatToLocalTime(info.getValue())}
          </div>
        ),
        enableGlobalFilter: false,
      }) as ColumnDef<UserAppDetails>,

      columnHelper.accessor((row) => row, {
        id: "actions",
        header: () => null,
        cell: (info) => {
          const app = info.getValue();
          return (
            <div className="flex justify-center gap-2">
              <UserAppForm title="Edit User App" userAppName={app.name}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </UserAppForm>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-800"
                  >
                    <GoTrash className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete User App</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the user app &ldquo;
                      {app.display_name}&rdquo;? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await deleteUserApp(app.name);
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
            </div>
          );
        },
        enableGlobalFilter: false,
      }) as ColumnDef<UserAppDetails>,
    ],
    [deleteUserApp],
  );
};
