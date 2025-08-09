import { AppConfig } from "@/lib/types/appconfig";
import Image from "next/image";
import { useApp } from "@/hooks/use-app";
import { RouterLink } from "@/components/ui-extensions/router-link";

interface AppLike {
  name: string;
  display_name: string;
  logo?: string;
}

interface AppItemDisplayProps {
  app?: AppLike;
  appName?: string;
  appConfig?: AppConfig;
  link?: string;
}

function AppItemWithApp({ app, link }: { app: AppLike; link?: string }) {
  return (
    <RouterLink
      href={link ?? `/apps/${app.name}`}
      className="flex items-center gap-3 text-nowrap"
    >
      <div className="relative h-5 w-5 flex-shrink-0 overflow-hidden">
        <Image
          src={app.logo || "/icon/default-app-icon.svg"}
          alt={`${app.display_name} logo`}
          fill
          className="object-contain"
        />
      </div>
      {app.display_name}
    </RouterLink>
  );
}

function AppItemWithAppName({
  appName,
  link,
}: {
  appName: string;
  link?: string;
}) {
  const { data: app } = useApp(appName);
  return app && <AppItemWithApp app={app} link={link} />;
}

function AppItemWithAppConfig({
  appConfig,
  link,
}: {
  appConfig: AppConfig;
  link?: string;
}) {
  return <AppItemWithAppName appName={appConfig.app_name} link={link} />;
}

export function AppItemDisplay({
  appConfig,
  appName,
  app,
  link,
}: AppItemDisplayProps) {
  if (app) {
    return <AppItemWithApp app={app} link={link} />;
  }

  if (appConfig) {
    return <AppItemWithAppConfig appConfig={appConfig} link={link} />;
  }

  if (appName) {
    return <AppItemWithAppName appName={appName} link={link} />;
  }

  return null;
}
