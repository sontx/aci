"use client";

import { useCallback } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { AddAccountForm } from "@/components/appconfig/add-account";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import {
  useLinkedAccounts,
  useUpdateLinkedAccount,
} from "@/hooks/use-linked-account";
import { useApps } from "@/hooks/use-app";
import { useAppConfigs } from "@/hooks/use-app-config";
import { useLinkedAccountsTableColumns } from "@/components/linkedaccount/useLinkedAccountsTableColumns";

export default function LinkedAccountsPage() {
  const { data: linkedAccounts = [], isPending: isLinkedAccountsPending } =
    useLinkedAccounts();
  const { data: appConfigs = [], isPending: isConfigsPending } =
    useAppConfigs();
  const { data: apps, isPending: isAppsPending, isError } = useApps();
  const { mutateAsync: updateLinkedAccount } = useUpdateLinkedAccount();

  const toggleAccountStatus = useCallback(
    async (accountId: string, newStatus: boolean): Promise<boolean> => {
      try {
        await updateLinkedAccount({
          linkedAccountId: accountId,
          enabled: newStatus,
        });

        return true;
      } catch (error) {
        console.error("Failed to update linked account:", error);
        toast.error("Failed to update linked account");
        return false;
      }
    },
    [updateLinkedAccount],
  );

  const linkedAccountsColumns = useLinkedAccountsTableColumns(toggleAccountStatus);

  const isPageLoading =
    isLinkedAccountsPending || isAppsPending || isConfigsPending;

  return (
    <div>
      <div className="m-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Linked Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage your linked accounts here.
          </p>
        </div>
        <div>
          {!isPageLoading && !isError && appConfigs.length > 0 && (
            <AddAccountForm
              appInfos={appConfigs.map((config) => ({
                name: config.app_name,
                logo: apps.find((app) => app.name === config.app_name)?.logo,
                supported_security_schemes:
                  apps.find((app) => app.name === config.app_name)
                    ?.supported_security_schemes || {},
              }))}
            />
          )}
        </div>
      </div>
      <Separator />

      <div className="m-4">
        <Tabs defaultValue={"linked"} className="w-full">
          <TabsContent value="linked">
            {isPageLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="flex flex-col items-center space-y-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  <p className="text-sm text-gray-500">Loading...</p>
                </div>
              </div>
            ) : linkedAccounts.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                No linked accounts found
              </div>
            ) : (
              <EnhancedDataTable
                columns={linkedAccountsColumns}
                data={linkedAccounts}
                defaultSorting={[{ id: "app_name", desc: false }]}
                searchBarProps={{
                  placeholder: "Search linked accounts",
                }}
                paginationOptions={{
                  initialPageIndex: 0,
                  initialPageSize: 15,
                }}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
