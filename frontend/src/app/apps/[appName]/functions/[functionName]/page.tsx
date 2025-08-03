"use client";

import React from "react";
import { useParams } from "next/navigation";
import { FunctionDetailContent } from "@/components/apps/function-detail-content";
import { useApp } from "@/hooks/use-app";
import { type AppFunction } from "@/lib/types/appfunction";

const FunctionDetailPage = () => {
  const { appName, functionName } = useParams<{
    appName: string;
    functionName: string;
  }>();
  const { app } = useApp(appName);

  const func = app?.functions?.find(
    (f: AppFunction) => f.name === decodeURIComponent(functionName),
  );

  if (!func) {
    return (
      <div className="m-4">
        <div className="text-center py-8">
          <h1 className="text-xl font-semibold text-muted-foreground">
            Function not found
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            The function &quot;{decodeURIComponent(functionName)}&quot; could
            not be found in this app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="m-4">
      <div className="max-w-6xl">
        <FunctionDetailContent func={func} />
      </div>
    </div>
  );
};

export default FunctionDetailPage;
