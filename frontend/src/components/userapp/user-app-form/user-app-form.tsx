"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import React, { useState } from "react";
import { UserAppFormContent } from "./user-app-form-content";

interface UserAppFormProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  userAppName?: string;
  title: string;
}

export function UserAppForm({
  children,
  userAppName,
  title,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: UserAppFormProps) {
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
      <DialogContent preventCloseOnClickOutside preventCloseOnEscapeKeyDown>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {userAppName
              ? `Edit the configuration of the your own app "${userAppName}".`
              : "Fill in the details to create a new your own app."}
          </DialogDescription>
        </DialogHeader>

        <UserAppFormContent
          userAppName={userAppName}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
