"use client";

import {
  LogsView
} from "@/components/logs";
import { Separator } from "@/components/ui/separator";

export default function LogsPage() {
  return (
    <div className="w-full">
      <div className="m-4">
        <h1 className="text-2xl font-bold">Logs</h1>
        <p className="text-sm text-muted-foreground">
          View and analyze function execution logs for your applications.
        </p>
      </div>

      <Separator />

      <div className="m-4">
        <LogsView />
      </div>
    </div>
  );
}
