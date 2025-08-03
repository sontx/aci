"use client";
import { Badge } from "@/components/ui/badge";
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
import { useAppLinkedAccounts } from "@/hooks/use-linked-account";
import { type App } from "@/lib/types/app";
import { CheckCircle, CircleUser, Hammer } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface AppCardProps {
  app: App;
  isConfigured?: boolean;
}

export function AppCard({ app, isConfigured = false }: AppCardProps) {
  return (
    <Link href={`/apps/${app.name}`} className="block">
      <Card className="h-[300px] transition-shadow hover:shadow-lg flex flex-col overflow-hidden relative">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
                <Image
                  src={app.logo}
                  alt={`${app.name} logo`}
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <CardTitle className="truncate">{app.display_name}</CardTitle>
                {isConfigured && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="secondary"
                          className="max-w-max mt-1 bg-green-100 text-green-700 border-green-200 flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Configured
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>App already configured for this project</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
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
