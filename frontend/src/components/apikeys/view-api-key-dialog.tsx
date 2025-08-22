"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Copy, Eye } from "lucide-react";
import { useAPIKey } from "@/hooks/use-api-key";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

interface ViewAPIKeyDialogProps {
  apiKeyName: string;
  children?: React.ReactNode;
}

export function ViewAPIKeyDialog({ apiKeyName, children }: ViewAPIKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [showFullKey, setShowFullKey] = useState(false);
  
  const { data: apiKeyDetail, isLoading } = useAPIKey(apiKeyName);

  const handleCopyKey = () => {
    if (apiKeyDetail?.key) {
      navigator.clipboard.writeText(apiKeyDetail.key);
      toast.success("API key copied to clipboard");
    }
  };

  const toggleKeyVisibility = () => {
    setShowFullKey(!showFullKey);
  };

  const displayKey = showFullKey 
    ? apiKeyDetail?.key 
    : apiKeyDetail?.key ? `${apiKeyDetail.key.slice(0, 8)}${"*".repeat(apiKeyDetail.key.length - 8)}` : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>API Key Details</DialogTitle>
          <DialogDescription>
            View and copy your API key. Keep this key secure and never share it publicly.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              <span className="ml-2">Loading API key...</span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="api-key"
                    type="text"
                    value={displayKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleKeyVisibility}
                    className="px-3"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyKey}
                    className="px-3"
                  >
                    <Copy className="h-4 w-4" />
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
                        Keep this API key secure. Do not share it publicly or commit it to version control.
                        If you believe this key has been compromised, delete it immediately and create a new one.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {apiKeyDetail && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-gray-600">Status</Label>
                    <p className="font-medium capitalize">{apiKeyDetail.status}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Created</Label>
                    <p className="font-medium">
                      {new Date(apiKeyDetail.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
