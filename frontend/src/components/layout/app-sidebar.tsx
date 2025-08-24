"use client";

import Link from "next/link";
import Image from "next/image";
import { GrApps, GrAppsRounded } from "react-icons/gr";
// import { GoHome } from "react-icons/go";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import React from "react";
import { VscGraph } from "react-icons/vsc";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { PiStorefront } from "react-icons/pi";
import {
  RiFileList3Line,
  RiKey2Line,
  RiLinkUnlinkM,
  RiSettings3Line,
} from "react-icons/ri";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProjectSelector } from "./project-selector";
import { OrgSelector } from "./org-selector";
import { McpIcon } from "@/components/icons/mcp";

const showLogDashboard =
  process.env.NEXT_PUBLIC_FEATURE_LOG_DASHBOARD === "true";

// Export sidebar items so they can be used in header
export const sidebarItems = [
  {
    title: "App Store",
    url: `/apps`,
    icon: PiStorefront,
  },
  {
    title: "My Apps",
    url: `/my-apps`,
    icon: GrApps,
  },
  {
    title: "App Configurations",
    url: `/appconfigs`,
    icon: GrAppsRounded,
  },
  {
    title: "Linked Accounts",
    url: `/linked-accounts`,
    icon: RiLinkUnlinkM,
  },
  {
    title: "MCP Servers",
    url: `/mcp-servers`,
    icon: McpIcon,
  },
  {
    title: "API Keys",
    url: `/api-keys`,
    icon: RiKey2Line,
  },
  ...(showLogDashboard
    ? [
        {
          title: "Log Dashboard",
          url: `/logs`,
          icon: RiFileList3Line,
        },
      ]
    : []),
  {
    title: "Usage",
    url: `/usage`,
    icon: VscGraph,
  },
];

// Add settings routes to be accessible in header
export const settingsItem = {
  title: "Settings",
  url: "/settings",
  icon: RiSettings3Line,
};

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" collapsible="icon" className="flex flex-col">
      <SidebarHeader>
        <div
          className={cn(
            "flex items-center px-4",
            isCollapsed ? "justify-center" : "justify-between gap-2",
          )}
        >
          {!isCollapsed && (
            <div className="h-8 w-auto relative flex items-center justify-center">
              <Image
                src="/full-logo.svg"
                alt="API Forest Logo"
                width={130}
                height={32}
                priority
                className="object-contain"
              />
            </div>
          )}
          <SidebarTrigger />
        </div>
        <Separator />
        <div
          className={cn(
            "transition-all duration-200 overflow-hidden",
            isCollapsed
              ? "max-h-0 opacity-0 scale-95"
              : "max-h-[100px] opacity-100 scale-100",
          )}
        >
          <div className="w-full p-4">
            <OrgSelector />
            <div className="mt-3">
              <ProjectSelector />
            </div>
          </div>
          <Separator />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarItems.map((item) => {
                const isActive =
                  pathname === item.url || pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton asChild>
                          <Link
                            href={item.url}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2 transition-colors",
                              isCollapsed && "justify-center",
                              isActive &&
                                "bg-primary/10 text-primary font-medium hover:bg-primary/10 hover:text-primary",
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-5 w-5 flex-shrink-0",
                                isActive && "text-primary",
                              )}
                            />
                            {!isCollapsed && <span>{item.title}</span>}
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          {item.title}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton asChild>
                  <Link
                    href={settingsItem.url}
                    className={cn(
                      "flex items-center gap-3 p-4 transition-colors",
                      isCollapsed && "justify-center",
                      pathname === settingsItem.url &&
                        "bg-primary/10 text-primary font-medium",
                    )}
                  >
                    {(() => {
                      const IconComponent = settingsItem.icon;
                      return (
                        <IconComponent
                          className={cn(
                            "h-5 w-5 flex-shrink-0",
                            pathname === settingsItem.url && "text-primary",
                          )}
                        />
                      );
                    })()}
                    {!isCollapsed && <span>{settingsItem.title}</span>}
                  </Link>
                </SidebarMenuButton>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  {settingsItem.title}
                </TooltipContent>
              )}
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
