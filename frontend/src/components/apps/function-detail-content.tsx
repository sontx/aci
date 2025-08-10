"use client";
import * as React from "react";
import { type AppFunction, RestMetadata } from "@/lib/types/appfunction";
import { Badge } from "@/components/ui/badge";
import { Hammer, Play } from "lucide-react";
import { MarkdownViewer } from "@/components/ui-extensions/markdown-viewer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RunFunctionDialog } from "@/components/userapp/run-function-form";

interface FunctionDetailContentProps {
  func: AppFunction;
}

function RestProtocolViewer({ metadata }: { metadata: RestMetadata }) {
  if (!metadata) {
    return (
      <div className="text-muted-foreground">No REST metadata available</div>
    );
  }

  const serverUrl = metadata.server_url.endsWith("/")
    ? metadata.server_url.slice(0, -1)
    : metadata.server_url;
  const path = metadata.path.startsWith("/")
    ? metadata.path
    : `/${metadata.path}`;

  // Assign color based on HTTP method
  const methodColorMap: Record<string, string> = {
    GET: "bg-green-500",
    POST: "bg-blue-500",
    PUT: "bg-yellow-500",
    DELETE: "bg-red-500",
    PATCH: "bg-purple-500",
    OPTIONS: "bg-gray-500",
    HEAD: "bg-gray-400",
  };
  const badgeColor =
    methodColorMap[metadata.method.toUpperCase()] || "bg-gray-300";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Protocol</CardTitle>
        <CardDescription>
          This function uses the REST protocol to communicate with external
          services.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm">
          <Badge className={badgeColor}>{metadata.method}</Badge>
          <span>
            <span>{serverUrl}</span>
            <span className="text-muted-foreground">{path}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function FunctionDetailContent({ func }: FunctionDetailContentProps) {
  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
              <Hammer className="w-12 h-12" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{func.display_name}</h1>
              {func.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {func.tags?.map((tag: string) => (
                    <Badge key={tag} variant="normal" className="capitalize">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          {func.description && (
            <div className="max-w-3xl text-sm text-muted-foreground">
              <MarkdownViewer content={func.description} />
            </div>
          )}
        </div>
        <RunFunctionDialog functionName={func.name} appName={func.app_name}>
          <Button>
            <Play className="h-4 w-4" />
            Run Function
          </Button>
        </RunFunctionDialog>
      </div>

      {func.protocol === "rest" && (
        <RestProtocolViewer metadata={func.protocol_data} />
      )}

      <div className="space-y-4">
        {func.parameters && (
          <Card>
            <CardHeader>
              <CardTitle>Parameters</CardTitle>
              <CardDescription>
                The parameters required to call this function. These are the
                inputs that the function expects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-thead:text-nowrap min-w-full">
                <MarkdownViewer content={func.parameters} />
              </div>
            </CardContent>
          </Card>
        )}
        {func.response && (
          <Card>
            <CardHeader>
              <CardTitle>Response</CardTitle>
              <CardDescription>
                The expected response from this function. This is what the
                function will return after execution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-thead:text-nowrap min-w-full">
                <MarkdownViewer content={func.response} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
