import { useMemo, useState } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { OrganizationUser } from "@/lib/types/organization";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { useMetaInfo } from "@/components/context/metainfo";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const columnHelper = createColumnHelper<OrganizationUser>();

export function useOrgMembersTableColumns({
  onRemove,
}: {
  onRemove: (userId: string) => void;
}): ColumnDef<OrganizationUser, unknown>[] {
  const { user } = useMetaInfo();
  const [dialogState, setDialogState] = useState<{
    memberId: string | null;
    email: string | null;
    isCurrentUser: boolean;
  }>({
    memberId: null,
    email: null,
    isCurrentUser: false,
  });

  return useMemo(
    () =>
      [
        columnHelper.accessor("email", {
          header: "Email",
          cell: (info) => info.getValue(),
          enableGlobalFilter: true,
        }),
        columnHelper.accessor("role", {
          header: "Role",
          cell: (info) => info.getValue(),
          enableGlobalFilter: true,
        }),
        columnHelper.display({
          id: "actions",
          header: "",
          cell: (info) => {
            const member = info.row.original;
            const isCurrentUser = member.user_id === user.userId;
            const isOwner = member.role === "Owner";
            const isLastOwner =
              isOwner &&
              info.table
                .getCoreRowModel()
                .rows.filter((row) => row.original.role === "Owner").length ===
                1;

            const menuItem = (
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                disabled={isLastOwner}
                onSelect={() => {
                  setDialogState({
                    memberId: member.user_id,
                    email: member.email,
                    isCurrentUser,
                  });
                }}
              >
                {isCurrentUser ? "Leave" : "Remove"}
              </DropdownMenuItem>
            );

            return (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isLastOwner ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>{menuItem}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Cannot remove the last owner</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      menuItem
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <AlertDialog
                  open={dialogState.memberId !== null}
                  onOpenChange={(open) => {
                    if (!open) {
                      setDialogState({
                        memberId: null,
                        email: null,
                        isCurrentUser: false,
                      });
                    }
                  }}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {dialogState.isCurrentUser
                          ? "Leave Organization"
                          : "Remove Member"}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {dialogState.isCurrentUser
                          ? "Are you sure you want to leave this organization? This action cannot be undone."
                          : `Are you sure you want to remove ${dialogState.email} from the organization? This action cannot be undone.`}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (dialogState.isCurrentUser) {
                            onRemove(user.userId);
                          } else if (dialogState.memberId) {
                            onRemove(dialogState.memberId);
                          }
                          setDialogState({
                            memberId: null,
                            email: null,
                            isCurrentUser: false,
                          });
                        }}
                        destructive
                      >
                        {dialogState.isCurrentUser ? "Leave" : "Remove"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            );
          },
          enableGlobalFilter: false,
        }),
      ] as ColumnDef<OrganizationUser, unknown>[],
    [onRemove, user.userId, dialogState],
  );
}
