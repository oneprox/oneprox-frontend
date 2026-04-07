"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { SidebarInset } from "@/components/ui/sidebar";
import { RouteGuard } from "@/components/route-guard";

export function ClientRoot({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      forcedTheme="light"
    >
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <main className="grow-[1] flex flex-col overflow-x-hidden min-w-0">
          <SidebarInset className="overflow-visible">
            <Header />
          </SidebarInset>
          <div className="bg-neutral-100 dark:bg-[#1e2734] md:p-6 p-4 flex-1 overflow-x-hidden min-w-0 w-full content-area" >
            <RouteGuard>
              {children}
            </RouteGuard>
          </div>
          <Footer />
        </main>
      </SidebarProvider>
    </ThemeProvider>
  );
}
