"use client";

import Link from "next/link";
import Image from "next/image";
import { GrApps, GrAppsRounded } from "react-icons/gr";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";
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
  Building2,
  ChevronRight,
  CreditCard,
  FileText,
  LogOut,
  Plus,
  SquareDashedKanban,
  SquareKanban,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLogoutFunction } from "@propelauth/react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { McpIcon } from "@/components/icons/mcp";
import { useMetaInfo } from "../context/metainfo";
import { CreateProjectDialog } from "@/components/project/create-project-dialog";

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
          title: "Logs",
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
  const {
    user,
    orgs,
    activeOrg,
    setActiveOrgId,
    projects,
    activeProject,
    setActiveProjectId,
    reloadActiveProject,
  } = useMetaInfo();
  const logoutFn = useLogoutFunction();

  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  const handleCreateProjectClick = useCallback(() => {
    setTimeout(() => {
      setOpenCreateDialog(true);
    });
  }, []);

  const userDisplayName = useMemo(() => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email;
  }, [user.email, user.firstName, user.lastName]);

  const userInitials = useMemo(() => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  }, [user.email, user.firstName, user.lastName]);

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
                                "bg-primary/10 text-primary font-medium hover:!bg-primary/20",
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 h-auto transition-colors hover:bg-primary/5",
                    isCollapsed && "justify-center",
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.pictureUrl} alt={userDisplayName} />
                    <AvatarFallback className="text-xs font-bold bg-[#D88C62] border-[#3D484A] text-[#3D484A] border-2">
                      {user.pictureUrl ? (
                        <User className="h-4 w-4" />
                      ) : (
                        userInitials
                      )}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="flex-1 flex flex-col items-start text-left min-w-0 truncate">
                        <span
                          className="text-sm font-medium w-full truncate"
                          title={userDisplayName}
                        >
                          {userDisplayName}
                        </span>
                        <span
                          className="text-xs text-muted-foreground w-full truncate"
                          title={user.email}
                        >
                          {user.email}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </div>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <User className="mr-2 h-4 w-4" />
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {userDisplayName}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Building2 className="mr-2 h-4 w-4" />
                    Organization Settings
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/project-setting">
                    <SquareDashedKanban className="mr-2 h-4 w-4" />
                    Project Settings
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/pricing">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Upgrade
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <a href="#" target="_blank" rel="noopener noreferrer">
                    <FileText className="mr-2 h-4 w-4" />
                    Docs
                  </a>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <SquareKanban className="mr-2 h-4 w-4" />
                    Switch Project
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={activeProject.id}
                      onValueChange={setActiveProjectId}
                    >
                      {projects.map((project) => (
                        <DropdownMenuRadioItem
                          key={project.id}
                          value={project.id}
                          className="pl-10"
                        >
                          {project.name}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                    {projects.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      asChild
                      onSelect={handleCreateProjectClick}
                    >
                      <div>
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Project
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Building2 className="mr-2 h-4 w-4" />
                    Switch Organization
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={activeOrg.orgId}
                      onValueChange={setActiveOrgId}
                    >
                      {orgs.map((org) => (
                        <DropdownMenuRadioItem
                          key={org.orgId}
                          value={org.orgId}
                        >
                          {org.orgName}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => logoutFn(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
        <CreateProjectDialog
          onProjectCreated={reloadActiveProject}
          openDialog={openCreateDialog}
          setOpenDialog={setOpenCreateDialog}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
