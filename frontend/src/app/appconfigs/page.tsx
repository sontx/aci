"use client";

import { useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { useAppConfigsTableColumns } from "@/components/appconfig/useAppConfigsTableColumns";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { useAppsMap } from "@/hooks/use-app";
import { useAppConfigs } from "@/hooks/use-app-config";
import { useLinkedAccounts } from "@/hooks/use-linked-account";
import { useMCPServers } from "@/hooks/use-mcp-server";

export default function AppConfigPage() {
  const { data: appConfigs = [], isPending: isConfigsPending } =
    useAppConfigs();
  const { data: linkedAccounts = [], isPending: isLinkedAccountsPending } =
    useLinkedAccounts();
  const { data: mcpServers = [], isPending: isMCPServersPending } =
    useMCPServers();
  const isLoading =
    isConfigsPending || isLinkedAccountsPending || isMCPServersPending;
  const appsMap = useAppsMap();

  const linkedAccountsCountMap = useMemo(() => {
    return linkedAccounts.reduce(
      (countMap, linkedAccount) => {
        const appName = linkedAccount.app_name;
        const previousCount = countMap[appName] ?? 0;
        countMap[appName] = previousCount + 1;
        return countMap;
      },
      {} as Record<string, number>,
    );
  }, [linkedAccounts]);

  const mcpServersCountMap = useMemo(() => {
    return mcpServers.reduce(
      (countMap, mcpServer) => {
        const appName = mcpServer.app_name;
        const previousCount = countMap[appName] ?? 0;
        countMap[appName] = previousCount + 1;
        return countMap;
      },
      {} as Record<string, number>,
    );
  }, [mcpServers]);

  const appConfigsColumns = useAppConfigsTableColumns({
    linkedAccountsCountMap,
    mcpServersCountMap,
    appsMap,
  });

  const isPageLoading = isLoading || isConfigsPending;

  return (
    <div>
      <div className="m-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">App Configurations</h1>
        </div>
        {/* <Button className="bg-primary hover:bg-primary/90 text-white">
          <GoPlus />
          Add App
        </Button> */}
      </div>
      <Separator />

      <div className="m-4">
        {isPageLoading && (
          <div className="flex items-center justify-center p-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          </div>
        )}
        {!isPageLoading && (
          <EnhancedDataTable
            data={appConfigs}
            columns={appConfigsColumns}
            defaultSorting={[{ id: "app_name", desc: false }]}
            searchBarProps={{
              placeholder: "Search by app name",
            }}
            paginationOptions={{
              initialPageIndex: 0,
              initialPageSize: 15,
            }}
          />
        )}
      </div>
    </div>
  );
}
