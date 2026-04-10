"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
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
        <div className="flex min-w-0 grow flex-col overflow-x-hidden">
          <Header />
          <main className="min-w-0 flex-1">
            <div className="content-area min-h-0 w-full bg-neutral-100 px-4 pb-4 pt-20 dark:bg-[#1e2734] md:px-6 md:pb-6 md:pt-24">
              <RouteGuard>{children}</RouteGuard>
            </div>
          </main>
          <Footer />
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}
