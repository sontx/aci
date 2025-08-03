import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const RouterLink = React.forwardRef<
  React.ComponentRef<typeof Link>,
  React.ComponentPropsWithoutRef<typeof Link>
>(({ className, ...props }, ref)=> (
  <Link
    ref={ref}
    className={cn('cursor-pointer hover:text-blue-600 hover:underline', className)}
    {...props}
  />
));

RouterLink.displayName = "RouterLink";
