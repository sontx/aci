"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface RichSwitchProps
  extends React.ComponentPropsWithoutRef<typeof Switch> {
  /** Label to display next to the switch */
  label: React.ReactNode;
  /** Optional description text below the label */
  description?: React.ReactNode;
  /** Additional class name for the container */
  containerClassName?: string;
  /** Additional class name for the label */
  labelClassName?: string;
  /** Additional class name for the description */
  descriptionClassName?: string;
}

export const RichSwitch = React.forwardRef<
  React.ComponentRef<typeof Switch>,
  RichSwitchProps
>(
  (
    {
      label,
      description,
      containerClassName,
      labelClassName,
      descriptionClassName,
      className,
      ...props
    },
    ref,
  ) => {
    const id = React.useId();
    return (
      <div className={cn("flex items-start space-x-3", containerClassName)}>
        <Switch ref={ref} id={id} className={className} {...props} />
        <label
          htmlFor={id}
          className={cn(
            "flex-1 block text-sm font-medium leading-none space-y-1",
            labelClassName,
          )}
        >
          <span>{label}</span>

          {description && (
            <div
              className={cn(
                "text-sm text-muted-foreground",
                descriptionClassName,
              )}
            >
              {description}
            </div>
          )}
        </label>
      </div>
    );
  },
);

RichSwitch.displayName = "RichSwitch";
