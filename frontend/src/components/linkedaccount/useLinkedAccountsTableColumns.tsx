import { useMemo } from "react";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { LinkedAccount } from "@/lib/types/linkedaccount";
import { Button } from "@/components/ui/button";
import { GoTrash } from "react-icons/go";
import { ArrowUpDown, Eye } from "lucide-react";
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
import { useDeleteLinkedAccount } from "@/hooks/use-linked-account";
import { AppItemDisplay } from "@/components/apps/app-item-display";
import { IdDisplay } from "@/components/apps/id-display";
import { LinkedAccountDetails } from "@/components/linkedaccount/linked-account-details";
import { EnhancedSwitch } from "@/components/ui-extensions/enhanced-switch/enhanced-switch";
import { formatToLocalTime } from "@/utils/time";
import { useMetaInfo } from "@/components/context/metainfo";

const columnHelper = createColumnHelper<LinkedAccount>();

export const useLinkedAccountsTableColumns = (
  toggleAccountStatus: (
    accountId: string,
    newStatus: boolean,
  ) => Promise<boolean>,
): ColumnDef<LinkedAccount>[] => {
  const { mutateAsync: deleteLinkedAccount } = useDeleteLinkedAccount();
  const { activeProject } = useMetaInfo();

  return useMemo(
    () => [
      columnHelper.accessor("app_name", {
        header: ({ column }) => (
          <div className="flex items-center justify-start">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="w-full justify-start px-0"
            >
              App Name
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => {
          const appName = info.getValue();
          return <AppItemDisplay appName={appName} />;
        },
        enableGlobalFilter: true,
      }) as ColumnDef<LinkedAccount>,

      columnHelper.accessor((row) => [row.linked_account_owner_id], {
        id: "linked_account_owner_id",
        header: ({ column }) => (
          <div className="flex items-center justify-start">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="w-full justify-start px-0"
            >
              Owner ID
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => {
          const [ownerId] = info.getValue();
          return (
            <div className="flex-shrink-0">
              <IdDisplay id={ownerId} dim={false} />
            </div>
          );
        },
        enableColumnFilter: true,
        filterFn: "arrIncludes",
      }) as ColumnDef<LinkedAccount>,

      columnHelper.accessor("created_at", {
        header: ({ column }) => (
          <div className="flex items-center justify-start">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="w-full justify-start px-0"
            >
              Created At
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => (
          <span className="text-nowrap">
            {formatToLocalTime(info.getValue())}
          </span>
        ),
        enableGlobalFilter: false,
      }) as ColumnDef<LinkedAccount>,

      columnHelper.accessor("last_used_at", {
        header: () => <span className="text-nowrap">Last Used At</span>,
        cell: (info) => {
          const lastUsedAt = info.getValue();
          return lastUsedAt ? formatToLocalTime(lastUsedAt) : "Never";
        },
        enableGlobalFilter: false,
      }) as ColumnDef<LinkedAccount>,

      columnHelper.accessor("enabled", {
        header: "Enabled",
        cell: (info) => {
          const account = info.row.original;
          return (
            <EnhancedSwitch
              checked={info.getValue()}
              onAsyncChange={(checked) =>
                toggleAccountStatus(account.id, checked)
              }
              successMessage={(newState) => {
                return `Linked account ${account.linked_account_owner_id} ${newState ? "enabled" : "disabled"}`;
              }}
              errorMessage="Failed to update linked account"
            />
          );
        },
        enableGlobalFilter: false,
      }) as ColumnDef<LinkedAccount>,

      columnHelper.accessor((row) => row, {
        id: "actions",
        header: "",
        cell: (info) => {
          const account = info.getValue();
          return (
            <div className="space-x-2 flex">
              <LinkedAccountDetails
                account={account}
                toggleAccountStatus={toggleAccountStatus}
              >
                <Button variant="ghost" size="sm">
                  <Eye />
                </Button>
              </LinkedAccountDetails>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-red-600">
                    <GoTrash />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Deletion?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the linked account for owner ID &quot;
                      {account.linked_account_owner_id}&quot;.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          if (!activeProject) {
                            console.warn("No active project");
                            return;
                          }
                          await deleteLinkedAccount({
                            linkedAccountId: account.id,
                          });

                          toast.success(
                            `Linked account ${account.linked_account_owner_id} deleted`,
                          );
                        } catch (error) {
                          console.error(error);
                          toast.error("Failed to delete linked account");
                        }
                      }}
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
      }) as ColumnDef<LinkedAccount>,
    ],
    [toggleAccountStatus, deleteLinkedAccount, activeProject],
  );
};
