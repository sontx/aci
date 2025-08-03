"use client";
import * as React from "react";
import { type AppFunction } from "@/lib/types/appfunction";
import { Badge } from "@/components/ui/badge";
import { IdDisplay } from "@/components/apps/id-display";
import { Plug } from "lucide-react";
import { MarkdownViewer } from "@/components/ui-extensions/markdown-viewer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FunctionDetailContentProps {
  func: AppFunction;
}

export function FunctionDetailContent({ func }: FunctionDetailContentProps) {
  return (
    <div className="grid gap-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Function Name
          </div>
          <div className="w-fit">
            <IdDisplay
              id={func.name}
              displayName={func.display_name}
              dim={false}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Tags</div>
          <div className="flex flex-wrap gap-2">
            {func.tags?.map((tag: string) => (
              <Badge key={tag} variant="normal" className="capitalize">
                {tag}
              </Badge>
            ))}
            <Badge variant="normal" className="uppercase">
              <Plug className="w-3 h-3 mr-1" /> {func.protocol || "Unknown"}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Description
          </div>
          <div className="bg-muted px-4 py-3 rounded-md">
            {func.description}
          </div>
        </div>
      </div>

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
              <div className="prose prose-table:text-nowrap">
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
              <div className="prose prose-table:text-nowrap">
                <MarkdownViewer content={func.response} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
