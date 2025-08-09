"use client";

import React from "react";
import { useParams } from "next/navigation";
import { FunctionDetailContent } from "@/components/apps/function-detail-content";
import { useUserAppFunction } from "@/hooks/use-user-app";

const FunctionDetailPage = () => {
  const { functionName, appName } = useParams<{
    functionName: string;
    appName: string;
  }>();
  const { data: func } = useUserAppFunction(appName, functionName);

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
