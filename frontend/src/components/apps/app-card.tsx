"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type App } from "@/lib/types/app";
import { CircleCheckBig } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface AppCardProps {
  app: App;
  isConfigured?: boolean;
}

export function AppCard({ app, isConfigured = false }: AppCardProps) {
  return (
    <Link href={`/apps/${app.name}`} className="block">
      <Card className="h-[300px] transition-shadow hover:shadow-lg flex flex-col overflow-hidden relative">
        {isConfigured && (
          <div className="absolute top-2 right-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CircleCheckBig className="h-5 w-5 text-green-700" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>App already configured for this project</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={app.logo || "/icon/default-app-icon.svg"}
                  alt={`${app.name} logo`}
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <CardTitle className="truncate mb-1">
                  {app.display_name}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                  <Badge variant="outline" className="text-gray-600 font-normal">
                    v{app.version}
                  </Badge>
                  {app.project_id && (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 [word-spacing:-4px] text-gray-600 font-normal"
                    >
                      User App
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <CardDescription className="line-clamp-4  overflow-hidden">
                  {app.description}
                </CardDescription>
              </TooltipTrigger>
              <TooltipContent className="max-w-md">
                <p>{app.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start gap-2 mt-auto">
          {app.categories.map((category) => (
            <span
              key={category}
              className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200"
            >
              {category}
            </span>
          ))}
        </CardContent>
      </Card>
    </Link>
  );
}
