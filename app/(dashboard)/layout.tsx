import { cookies } from "next/headers";
import { ClientRoot } from "@/app/client-root";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const cookieStore = await cookies();
    const sidebarCookie = cookieStore.get("sidebar_state")?.value;
    console.log('Sidebar Cookie:', sidebarCookie)
    // Tanpa cookie (mis. setelah login pertama), default expanded — selaras dengan SidebarProvider defaultOpen={true}
    const defaultOpen =
      sidebarCookie === undefined ? true : sidebarCookie === "true";
    console.log('Default Open:', defaultOpen)
    const session = await auth();
    console.log('Session:', session)
    return (
      <SessionProvider session={session}>
        <ClientRoot defaultOpen={defaultOpen}>{children}</ClientRoot>
      </SessionProvider>
    );
  } catch (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Something went wrong!</h2>
        <p className="text-muted-foreground">We couldn't load the layout. Please try again later.</p>
      </div>
    );
  }
}
