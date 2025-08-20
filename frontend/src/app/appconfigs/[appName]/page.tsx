"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { IdDisplay } from "@/components/apps/id-display";
import { BsQuestionCircle } from "react-icons/bs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Server, Trash2, UserPlus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddAccountForm } from "@/components/appconfig/add-account";
import Link from "next/link";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import {
  MoreButton,
  SecondaryAction,
} from "@/components/ui-extensions/more-button";
import {
  useAppLinkedAccounts,
  useUpdateLinkedAccount,
} from "@/hooks/use-linked-account";
import { useApp } from "@/hooks/use-app";
import { useAppConfig, useDeleteAppConfig } from "@/hooks/use-app-config";
import { MCPServerForm } from "@/components/mcpserver/mcp-server-form";
import { useLinkedAccountsTableColumns } from "@/components/linkedaccount/useLinkedAccountsTableColumns";
import { LogsView } from "@/components/logs";
import { toast } from "sonner";

export default function AppConfigDetailPage() {
  const { appName } = useParams<{ appName: string }>();
  const router = useRouter();

  const { data: app } = useApp(appName);
  const { data: appConfig } = useAppConfig(appName);

  const { data: linkedAccounts = [] } = useAppLinkedAccounts(appName);

  const { mutateAsync: updateLinkedAccount } = useUpdateLinkedAccount();
  const { mutateAsync: deleteAppConfig } = useDeleteAppConfig();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!appConfig) return;

    try {
      await deleteAppConfig(appConfig.app_name);
      toast.success(`App configuration ${app?.display_name} deleted`);
      router.push("/appconfigs");
    } catch (error) {
      console.error("Failed to delete app config:", error);
      toast.error("Failed to delete app configuration");
    }
  }, [appConfig, deleteAppConfig, router, app?.display_name]);

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

  const secondaryActions = useMemo<SecondaryAction[]>(() => {
    if (!app || !appConfig) return [];
    
    return [
      {
        label: "Add MCP Server", 
        description: "Add a new Model Context Protocol server",
        icon: <Server className="h-4 w-4" />,
        onClick: () => {
          // This will trigger the MCP server form dialog
          const mcpButton = document.getElementById('mcp-server-trigger');
          if (mcpButton) {
            mcpButton.click();
          }
        },
      },
      {
        label: "Delete App Config",
        description: "Permanently delete this app configuration",
        icon: <Trash2 className="h-4 w-4" />,
        onClick: () => {
          setShowDeleteDialog(true);
        },
        destructive: true,
      },
    ];
  }, [app, appConfig]);

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
          <div className="flex gap-2">
            <MoreButton
              primaryActionComponent={
                <AddAccountForm
                  appInfos={[
                    {
                      name: app.name,
                      logo: app.logo,
                      supported_security_schemes:
                        app.supported_security_schemes || {},
                    },
                  ]}
                >
                  <Button className="rounded-r-none border-r-0">
                    <UserPlus className="h-4 w-4" />
                    Add Account
                  </Button>
                </AddAccountForm>
              }
              secondaryActions={secondaryActions}
            />
            {/* Hidden MCP Server Form for secondary action */}
            <MCPServerForm
              title="Add MCP Server"
              defaultAppConfigId={appConfig.id}
            >
              <button
                id="mcp-server-trigger"
                style={{ display: 'none' }}
                aria-hidden="true"
              />
            </MCPServerForm>
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
                      "This shows a list of end-users who have connected their account in this application."
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TabsTrigger>
          <TabsTrigger value="logs">
            Execution Logs
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
                      "This shows execution logs for all functions belonging to this app configuration."
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TabsTrigger>
          {/* <TabsTrigger value="settings">Settings</TabsTrigger> */}
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

        <TabsContent value="logs" className="pt-4">
          <LogsView appConfigId={appConfig?.id} />
        </TabsContent>

        {/* <TabsContent value="settings">
          <div className="text-gray-500">Settings content coming soon...</div>
        </TabsContent> */}
      </Tabs>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete App Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the app configuration for{" "}
              <strong>{app?.display_name}</strong>? This action cannot be undone
              and will remove all associated linked accounts and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} destructive>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
