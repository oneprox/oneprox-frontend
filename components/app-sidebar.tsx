"use client";

import * as React from "react";

import { NavMain } from "@/components/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import LogoSidebar from "./shared/logo-sidebar";
import { useUserSidebar } from "@/hooks/useUserSidebar";
import { fallbackSidebarData } from "./sidebar-data";
import { Loader2 } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface SidebarItem {
  title?: string;
  url?: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: {
    title: string;
    url: string;
    circleColor: string;
  }[];
  label?: string;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { navMain, loading, error } = useUserSidebar();

  // Gunakan data dinamis jika tersedia, fallback ke data minimal
  const sidebarData: SidebarItem[] = React.useMemo(() => {
    if (loading || error || !navMain || navMain.length === 0) {
      return fallbackSidebarData.navMain;
    }
    return navMain;
  }, [navMain, loading, error]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <LogoSidebar />
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin scrollbar-invisible hover:scrollbar-visible">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading menu...</span>
          </div>
        ) : (
          <NavMain items={sidebarData} />
        )}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
