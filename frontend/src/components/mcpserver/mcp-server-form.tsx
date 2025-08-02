"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  MCPServerCreate,
  MCPServerUpdate,
  MCPServerResponse,
} from "@/lib/types/mcpserver";
import { useCreateMCPServer, useUpdateMCPServer } from "@/hooks/use-mcp-server";
import { useAppConfigs } from "@/hooks/use-app-config";
import { Loader2 } from "lucide-react";
import { FunctionsSelector } from "./functions-selector";

// Helper function to generate random 4-character suffix
const generateRandomSuffix = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  app_config_id: z.string().min(1, "App configuration is required"),
  auth_type: z.enum(["secret_link", "oauth2"] as const),
  allowed_tools: z.array(z.string()).min(1, "At least one tool is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface MCPServerFormProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mcpServer?: MCPServerResponse;
  title: string;
  defaultAppConfigId?: string;
}

export function MCPServerForm({
  children,
  mcpServer,
  title,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultAppConfigId,
}: MCPServerFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { data: appConfigs, isPending: appConfigsLoading } = useAppConfigs();

  const { mutateAsync: createMCPServer, isPending: isCreating } =
    useCreateMCPServer();
  const { mutateAsync: updateMCPServer, isPending: isUpdating } =
    useUpdateMCPServer();

  const isEditing = !!mcpServer;
  const isLoading = isCreating || isUpdating;

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen =
    controlledOnOpenChange !== undefined
      ? controlledOnOpenChange
      : setInternalOpen;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      app_config_id: defaultAppConfigId || "",
      auth_type: "secret_link",
      allowed_tools: [],
    },
  });

  // Reset form when dialog opens or mcpServer changes
  useEffect(() => {
    if (open) {
      if (mcpServer) {
        form.reset({
          name: mcpServer.name,
          app_config_id: mcpServer.app_config_id,
          auth_type: mcpServer.auth_type,
          allowed_tools: mcpServer.allowed_tools,
        });
      } else {
        form.reset({
          name: "",
          app_config_id: defaultAppConfigId || "",
          auth_type: "secret_link",
          allowed_tools: [],
        });
      }
    }
  }, [open, mcpServer, form, defaultAppConfigId]);

  // Watch for app config changes
  const selectedAppConfigId = form.watch("app_config_id");

  // Auto-generate name when app config changes (only for new servers)
  useEffect(() => {
    if (!isEditing && open && selectedAppConfigId && appConfigs) {
      const selectedAppConfig = appConfigs.find(
        (config) => config.id === selectedAppConfigId,
      );
      if (selectedAppConfig) {
        const generatedName = `${selectedAppConfig.app_name}-${generateRandomSuffix()}`;
        form.setValue("name", generatedName);
      }
    }
  }, [selectedAppConfigId, appConfigs, isEditing, open, form]);

  const handleSubmit = async (values: FormValues) => {
    try {
      if (isEditing) {
        const updateData: MCPServerUpdate = {
          allowed_tools: values.allowed_tools,
        };
        await updateMCPServer({
          mcpServerId: mcpServer.id,
          data: updateData,
        });
      } else {
        const createData: MCPServerCreate = {
          name: values.name,
          app_config_id: values.app_config_id,
          auth_type: values.auth_type,
          allowed_tools: values.allowed_tools,
        };
        await createMCPServer(createData);
      }

      setOpen(false);
      form.reset();
    } catch (error) {
      console.error("Error submitting MCP server form:", error);
      toast.error(`Failed to ${isEditing ? "update" : "create"} MCP server`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="MCP Server Name"
                      disabled={isEditing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="app_config_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>App Configuration</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isEditing} // Don't allow changing app config when editing
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an app configuration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {appConfigsLoading ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="ml-2">
                            Loading app configurations...
                          </span>
                        </div>
                      ) : (
                        appConfigs?.map((appConfig) => (
                          <SelectItem key={appConfig.id} value={appConfig.id}>
                            {appConfig.app_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="auth_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authentication Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select auth type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="secret_link">Secret Link</SelectItem>
                      <SelectItem value="oauth2">OAuth2</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allowed_tools"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allowed Functions (Tools)</FormLabel>
                  <FormControl>
                    <FunctionsSelector
                      appName={
                        appConfigs?.find(
                          (config) => config.id === form.watch("app_config_id"),
                        )?.app_name
                      }
                      selectedFunctions={field.value}
                      onSelectionChange={field.onChange}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? "Updating..." : "Creating..."}
                  </>
                ) : isEditing ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
