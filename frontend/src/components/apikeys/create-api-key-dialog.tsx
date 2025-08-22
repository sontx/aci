"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateAPIKey } from "@/hooks/use-api-key";
import { Plus, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface CreateAPIKeyDialogProps {
  children?: React.ReactNode;
}

export function CreateAPIKeyDialog({ children }: CreateAPIKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const createAPIKeyMutation = useCreateAPIKey();

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    try {
      const result = await createAPIKeyMutation.mutateAsync({
        name: name.trim(),
      });
      setCreatedApiKey(result.key);
    } catch (error) {
      console.error("Failed to create API key:", error);
    }
  };

  const handleCopyKey = () => {
    if (createdApiKey) {
      navigator.clipboard.writeText(createdApiKey);
      setCopied(true);
      toast.success("API key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state when dialog closes
    setTimeout(() => {
      setCreatedApiKey(null);
      setCopied(false);
      setName("");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-primary hover:bg-primary/90 text-white">
            <Plus className="h-4 w-4" />
            Create API Key
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {createdApiKey ? "API Key Created Successfully" : "Create API Key"}
          </DialogTitle>
          <DialogDescription>
            {createdApiKey
              ? "Your API key has been created. Make sure to copy it now as you won't be able to see it again."
              : "Create a new API key for this project. The key will be generated automatically and can be used to authenticate API requests."}
          </DialogDescription>
        </DialogHeader>

        {!createdApiKey ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key-name">API Key Name</Label>
              <Input
                id="api-key-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My API Key"
                disabled={createAPIKeyMutation.isPending}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Important Security Note
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Make sure to copy and store your API key safely once
                      it&apos;s created. You won&apos;t be able to see the full
                      key again after this dialog closes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-api-key">Your New API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="new-api-key"
                  type="text"
                  value={createdApiKey}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyKey}
                  className="px-3"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Security Warning
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      This is the only time you will see this API key. Make sure
                      to copy and store it securely before closing this dialog.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!createdApiKey ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={createAPIKeyMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createAPIKeyMutation.isPending}
              >
                {createAPIKeyMutation.isPending
                  ? "Creating..."
                  : "Create API Key"}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
