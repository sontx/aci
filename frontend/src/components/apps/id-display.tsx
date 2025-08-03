"use client";

import React from "react";
import { BiCopy } from "react-icons/bi";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RouterLink } from "@/components/ui-extensions/router-link";

interface IdDisplayProps {
  id: string;
  displayName?: string;
  dim?: boolean;
  href?: string;
}

export function IdDisplay({
  id,
  displayName,
  href,
  dim = true,
}: IdDisplayProps) {
  const copyToClipboard = () => {
    if (!navigator.clipboard) {
      console.error("Clipboard API not supported");
      toast.error("Your browser doesn't support copying to clipboard");
      return;
    }
    navigator.clipboard
      .writeText(id)
      .then(() => {
        toast.success("Copied to clipboard");
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        toast.error("Failed to copy ID to clipboard");
      });
  };

  const ID = (
    <span
      className={`text-sm ${
        dim && "text-gray-500"
      } truncate min-w-0 cursor-default`}
    >
      {displayName ?? id}
    </span>
  );

  return (
    <TooltipProvider>
      <div className="flex items-center w-full gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            {href ? <RouterLink href={href}>{ID}</RouterLink> : ID}
          </TooltipTrigger>
          <TooltipContent>
            <p>{id}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.preventDefault();
                copyToClipboard();
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <BiCopy />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy to clipboard</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
