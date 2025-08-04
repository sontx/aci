import type { App } from "@/lib/types/app";
import { AppConfig } from "@/lib/types/appconfig";
import Image from "next/image";
import { useApp } from "@/hooks/use-app";
import { RouterLink } from "@/components/ui-extensions/router-link";

interface AppItemDisplayProps {
  app?: App;
  appName?: string;
  appConfig?: AppConfig;
}

function AppItemWithApp({ app }: { app: App }) {
  return (
    <RouterLink
      href={`/apps/${app.name}`}
      className="flex items-center gap-3 text-nowrap"
    >
      <div className="relative h-5 w-5 flex-shrink-0 overflow-hidden">
        {app.logo && (
          <Image
            src={app.logo || ""}
            alt={`${app.display_name} logo`}
            fill
            className="object-contain"
          />
        )}
      </div>
      {app.display_name}
    </RouterLink>
  );
}

function AppItemWithAppName({ appName }: { appName: string }) {
  const { data: app } = useApp(appName);
  return app && <AppItemWithApp app={app} />;
}

function AppItemWithAppConfig({ appConfig }: { appConfig: AppConfig }) {
  return <AppItemWithAppName appName={appConfig.app_name} />;
}

export function AppItemDisplay({
  appConfig,
  appName,
  app,
}: AppItemDisplayProps) {
  if (app) {
    return <AppItemWithApp app={app} />;
  }

  if (appConfig) {
    return <AppItemWithAppConfig appConfig={appConfig} />;
  }

  if (appName) {
    return <AppItemWithAppName appName={appName} />;
  }

  return null;
}
