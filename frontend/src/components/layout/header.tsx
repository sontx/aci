"use client";

// import { Input } from "@/components/ui/input";
// import { GoBell } from "react-icons/go";
import { Separator } from "@/components/ui/separator";
import { BreadcrumbLinks } from "./BreadcrumbLinks";
import { usePathname } from "next/navigation";

export const Header = () => {
  const pathname = usePathname();

  return (
    <div>
      <div className="flex w-full items-center justify-between px-4 py-2 h-12">
        <BreadcrumbLinks pathname={pathname} />
      </div>
      <Separator />
    </div>
  );
};
