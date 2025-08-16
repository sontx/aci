"use client";

import { useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { IdDisplay } from "@/components/apps/id-display";
import { BsQuestionCircle } from "react-icons/bs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GoPlus } from "react-icons/go";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddAccountForm } from "@/components/appconfig/add-account";
import Link from "next/link";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import {
  useAppLinkedAccounts,
  useUpdateLinkedAccount,
} from "@/hooks/use-linked-account";
import { useApp } from "@/hooks/use-app";
import { useAppConfig } from "@/hooks/use-app-config";
import { MCPServerForm } from "@/components/mcpserver/mcp-server-form";
import { useLinkedAccountsTableColumns } from "@/components/linkedaccount/useLinkedAccountsTableColumns";

export default function AppConfigDetailPage() {
  const { appName } = useParams<{ appName: string }>();

  const { data: app } = useApp(appName);
  const { data: appConfig } = useAppConfig(appName);

  const { data: linkedAccounts = [] } = useAppLinkedAccounts(appName);

  const { mutateAsync: updateLinkedAccount } = useUpdateLinkedAccount();

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

  const linkedAccountsColumns =
    useLinkedAccountsTableColumns(toggleAccountStatus, true);

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
            <Link href={`/apps/${app?.name}`}>
              <h1 className="text-2xl font-semibold">{app?.display_name}</h1>
            </Link>
            <IdDisplay id={app?.name ?? ""} />
          </div>
        </div>
        {app && appConfig && (
          <div className="flex items-center gap-2">
            <MCPServerForm
              title="Add MCP Server"
              defaultAppConfigId={appConfig.id}
            >
              <Button>
                <GoPlus className="mr-2 h-4 w-4" />
                Add MCP Server
              </Button>
            </MCPServerForm>
            <AddAccountForm
              appInfos={[
                {
                  name: app.name,
                  logo: app.logo,
                  supported_security_schemes:
                    app.supported_security_schemes || {},
                },
              ]}
            />
          </div>
        )}
      </div>

      <Tabs defaultValue={"linked"} className="w-full">
        <TabsList>
          <TabsTrigger value="linked">
            Linked Accounts
            <div className="ml-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-pointer">
                    <BsQuestionCircle className="h-4 w-4 text-muted-foreground" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">
                    {
                      "This shows a list of end-users who have connected their account in this application to your agent."
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TabsTrigger>
          {/* <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger> */}
        </TabsList>

        <TabsContent value="linked">
          <EnhancedDataTable
            data={linkedAccounts}
            columns={linkedAccountsColumns}
            defaultSorting={[{ id: "created_at", desc: true }]}
            searchBarProps={{
              placeholder: "Search by linked account owner ID",
            }}
          />
        </TabsContent>

        {/* <TabsContent value="logs">
          <div className="text-gray-500">Logs content coming soon...</div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="text-gray-500">Settings content coming soon...</div>
        </TabsContent> */}
      </Tabs>
    </div>
  );
}
