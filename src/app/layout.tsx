import "./globals.css";
import { Metadata } from "next";
import { Inter } from "next/font/google";
import { getServerSession } from "next-auth";

import { authOptions } from "@/auth/options";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import ThemeProvider from "@/providers/ThemeProvider";
import AuthProvider from "@/providers/AuthProvider";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Rahunu Registry",
  description: "Loan registry management portal",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const isAuthed = Boolean(session);
  const sidebarUser = {
    name: session?.user?.name ?? null,
    email: session?.user?.email ?? null,
    image: (session?.user as any)?.image ?? null,
    role: role ?? null,
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AuthProvider>
            {isAuthed ? (
              <SidebarProvider>
                <AppSidebar user={sidebarUser} />
                <SidebarInset>
                  <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-card/60 px-4 py-3 backdrop-blur sm:px-6">
                    <div className="flex flex-1 items-center gap-3">
                      <SidebarTrigger className="-ml-1" />
                      <Separator orientation="vertical" className="h-6" />
                      <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                          RR
                        </div>
                        <span className="text-base font-semibold sm:text-lg">Rahunu Registry</span>
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <ThemeSwitcher variant="ghost" size="icon" hideLabel className="h-9 w-9" />
                    </div>
                  </header>
                  <main className="flex-1 overflow-y-auto bg-background">
                    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 md:peer-data-[state=collapsed]:max-w-7xl sm:peer-data-[state=collapsed]:px-5 lg:peer-data-[state=collapsed]:px-6">
                      {children}
                    </div>
                  </main>
                </SidebarInset>
              </SidebarProvider>
            ) : (
              <div className="flex min-h-screen flex-col bg-background">
                <header className="flex items-center justify-center px-6 py-10">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                      RR
                    </div>
                    <span className="text-lg font-semibold">Rahunu Registry</span>
                  </div>
                </header>
                <main className="flex flex-1 items-center justify-center px-4 pb-16">
                  {children}
                </main>
              </div>
            )}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
