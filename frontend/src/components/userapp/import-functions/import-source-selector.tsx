"use client";

import React, { useRef, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export type ImportSource = "file" | "url";

export interface BasicAuthInfo {
  username: string;
  password: string;
}

interface ImportSourceSelectorProps {
  importSource: ImportSource;
  onImportSourceChange: (source: ImportSource) => void;
  url: string;
  onUrlChange: (url: string) => void;
  isLoading: boolean;
  onImport: (file?: File) => void;
  basicAuth: boolean;
  onBasicAuthChange: (enabled: boolean) => void;
  basicAuthInfo: BasicAuthInfo;
  onBasicAuthInfoChange: (info: BasicAuthInfo) => void;
}

export const ImportSourceSelector = React.memo<ImportSourceSelectorProps>(
  ({
    importSource,
    onImportSourceChange,
    url,
    onUrlChange,
    isLoading,
    onImport,
    basicAuth,
    onBasicAuthChange,
    basicAuthInfo,
    onBasicAuthInfoChange,
  }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const file =
      importSource === "file" ? fileInputRef.current?.files?.[0] : null;

    const handleFileSelect = useCallback(
      (selectedFile: File) => {
        if (selectedFile) {
          if (
            selectedFile.type === "application/json" ||
            selectedFile.name.endsWith(".json")
          ) {
            onImport(selectedFile);
          } else {
            toast.error("Please select a JSON file");
          }
        }
      },
      [onImport],
    );

    const handleFileInputChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
          handleFileSelect(selectedFile);
        }
      },
      [handleFileSelect],
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        const jsonFile = files.find(
          (file) =>
            file.type === "application/json" || file.name.endsWith(".json"),
        );

        if (jsonFile) {
          onImportSourceChange("file");
          handleFileSelect(jsonFile);
        } else if (files.length > 0) {
          toast.error("Please drop a JSON file");
        }
      },
      [handleFileSelect, onImportSourceChange],
    );

    const handleFileButtonClick = useCallback(() => {
      onImportSourceChange("file");
      fileInputRef.current?.click();
    }, [onImportSourceChange]);

    const handleUrlChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onUrlChange(e.target.value);
      },
      [onUrlChange],
    );

    const isImportDisabled =
      isLoading ||
      (importSource === "file" && !file) ||
      (importSource === "url" && !url.trim());

    return (
      <div className="flex gap-6">
        {/* File Import Section */}
        <div className="space-y-2 w-full">
          <h3>File Import</h3>
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary hover:bg-muted/50",
              file && "border-primary bg-primary/5",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleFileButtonClick}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <div className="space-y-2">
              <p className="font-medium">
                {file ? file.name : "Drop file here or click to import"}
              </p>
              {!file && (
                <p className="text-sm text-muted-foreground">
                  Supports JSON files only
                </p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        </div>

        <Separator
          orientation="vertical"
          className="h-[150px] mt-[50px] relative select-none"
        >
          <div className="absolute top-[62px] left-[-10px] bg-white text-sm text-muted-foreground">
            OR
          </div>
        </Separator>

        {/* URL Import Section */}
        <div className="space-y-4 w-full">
          <div className="space-y-2">
            <Label htmlFor="url-input">Enter OpenAPI/Swagger data URL</Label>
            <Input
              id="url-input"
              type="url"
              placeholder="https://example.com/api-json"
              value={url}
              onChange={handleUrlChange}
              onClick={() => onImportSourceChange("url")}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="basic-auth" className="text-sm font-normal">
              Basic Auth
            </Label>
            <Switch
              id="basic-auth"
              checked={basicAuth}
              onCheckedChange={onBasicAuthChange}
            />
          </div>

          {basicAuth && (
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder="Username"
                value={basicAuthInfo.username}
                onChange={(e) =>
                  onBasicAuthInfoChange({
                    ...basicAuthInfo,
                    username: e.target.value,
                  })
                }
              />
              <Input
                type="password"
                placeholder="Password"
                value={basicAuthInfo.password}
                onChange={(e) =>
                  onBasicAuthInfoChange({
                    ...basicAuthInfo,
                    password: e.target.value,
                  })
                }
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => onImport()}
              disabled={isImportDisabled}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  },
);

ImportSourceSelector.displayName = "ImportSourceSelector";
