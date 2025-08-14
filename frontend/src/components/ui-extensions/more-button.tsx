"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SecondaryAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  icon?: React.ReactNode;
  description?: string;
}

export interface MoreButtonProps {
  primaryActionComponent: React.ReactNode;
  secondaryActions?: SecondaryAction[];
  className?: string;
  dropdownAlign?: "start" | "center" | "end";
  dropdownSide?: "top" | "right" | "bottom" | "left";
}

export function MoreButton({
  primaryActionComponent,
  secondaryActions = [],
  className,
  dropdownAlign = "end",
  dropdownSide = "bottom",
}: MoreButtonProps) {
  if (secondaryActions.length === 0) {
    return (
      <div className={cn("flex", className)}>{primaryActionComponent}</div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex rounded-md shadow-sm">
        {/* Primary Action Button */}
        <div className="relative inline-flex">{primaryActionComponent}</div>

        {/* Dropdown Menu for Secondary Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              className="rounded-l-none border-l-gray-600 border-l h-9 w-9 shadow-sm"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={dropdownAlign} side={dropdownSide}>
            {secondaryActions.map((action, index) => (
              <DropdownMenuItem
                key={index}
                onClick={() => {
                  if (!action.disabled) {
                    setTimeout(() => {
                      action.onClick();
                    });
                  }
                }}
                disabled={action.disabled}
                className={cn(
                  "cursor-pointer",
                  action.description ? "py-2" : "py-1.5",
                  action.destructive &&
                    "text-destructive focus:text-destructive",
                )}
              >
                <div className="flex items-start w-full">
                  {action.icon && (
                    <span className="mr-2 h-4 w-4 mt-0.5 flex-shrink-0">
                      {action.icon}
                    </span>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{action.label}</span>
                    {action.description && (
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {action.description}
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
