"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAPIKey, useUpdateAPIKey } from "@/hooks/use-api-key";
import { APIKeyStatus } from "@/lib/types/apikey";
import { Edit } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RichSwitch } from "../ui-extensions/rich-switch";

interface EditAPIKeyDialogProps {
  apiKeyName: string;
  children?: React.ReactNode;
}

export function EditAPIKeyDialog({
  apiKeyName,
  children,
}: EditAPIKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: apiKey, isLoading } = useAPIKey(apiKeyName);
  const updateAPIKeyMutation = useUpdateAPIKey();

  // Initialize form when dialog opens and data is loaded
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && apiKey) {
      setName(apiKey.name);
      setIsActive(apiKey.status === "active");
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    if (!apiKey) return;

    try {
      const newStatus: APIKeyStatus = isActive ? "active" : "disabled";
      await updateAPIKeyMutation.mutateAsync({
        name: apiKey.name,
        data: {
          status: newStatus,
        },
      });
      toast.success("API key updated successfully");
      setOpen(false);
    } catch (error) {
      console.error("Failed to update API key:", error);
      toast.error("Failed to update API key");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit API Key
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit API Key</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <span className="ml-2">Loading API key...</span>
          </div>
        ) : apiKey ? (
          <div className="space-y-6">
            <div className="space-y-1">
              <Label htmlFor="edit-api-key-name">Key Name</Label>
              <Input
                id="edit-api-key-name"
                type="text"
                value={name}
                readOnly
                tabIndex={-1}
              />
            </div>

            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <RichSwitch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={
                    updateAPIKeyMutation.isPending ||
                    apiKey.status === "deleted"
                  }
                  label="Status"
                  description={
                    isActive
                      ? "API key is active and can be used"
                      : "API key is disabled and cannot be used"
                  }
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Failed to load API key details
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={updateAPIKeyMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateAPIKeyMutation.isPending || !apiKey}
          >
            {updateAPIKeyMutation.isPending ? "Updating..." : "Update API Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
