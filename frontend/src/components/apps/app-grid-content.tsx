"use client";

import { AppCard } from "./app-card";
import { App } from "@/lib/types/app";

interface AppGridContentProps {
  apps: App[];
  configuredAppNames: Set<string>;
  showComingSoon?: boolean;
}

export function AppGridContent({
  apps,
  configuredAppNames,
}: AppGridContentProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <AppCard
            key={app.id}
            app={app}
            isConfigured={configuredAppNames.has(app.name)}
          />
        ))}
      </div>

      {apps.length === 0 && (
        <div className="text-center text-muted-foreground">
          No apps found matching your criteria
        </div>
      )}
    </>
  );
}
