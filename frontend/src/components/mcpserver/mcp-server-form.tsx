"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { MCPServerResponse } from "@/lib/types/mcpserver";
import { MCPServerFormContent } from "./mcp-server-form-content";

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

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen =
    controlledOnOpenChange !== undefined
      ? controlledOnOpenChange
      : setInternalOpen;

  const handleSuccess = () => {
    setOpen(false);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <MCPServerFormContent
          mcpServer={mcpServer}
          defaultAppConfigId={defaultAppConfigId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
