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
import { KeyboardShortcutsButton } from "@/components/keyboard-shortcuts-button";
import ThemeProvider from "@/providers/ThemeProvider";
import AuthProvider from "@/providers/AuthProvider";
import { KeyboardShortcutsProvider } from "@/components/keyboard-shortcuts-provider";

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
            <KeyboardShortcutsProvider>
              {isAuthed ? (
                <SidebarProvider>
                  <AppSidebar user={sidebarUser} />
                  <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-card/60 px-4 py-3 backdrop-blur sm:px-6">
                      <div className="flex flex-1 items-center gap-3">
                        <SidebarTrigger className="-ml-1" data-sidebar="trigger" />
                        <Separator orientation="vertical" className="h-6" />
                        <Link href="/dashboard" className="flex items-center gap-2">
                          <img src="/addu-logo.png" alt="City of Addu Logo" className="h-9 w-auto" />
                          <span className="text-base font-semibold sm:text-lg">Rahunu Registry</span>
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        <KeyboardShortcutsButton />
                        <ThemeSwitcher variant="ghost" size="icon" hideLabel className="h-9 w-9" />
                      </div>
                    </header>
                    <main className="flex-1 overflow-y-auto bg-background">
                      <div className="mx-auto flex w-full max-w-none flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10 xl:px-14 2xl:px-20 sm:peer-data-[state=collapsed]:px-8 lg:peer-data-[state=collapsed]:px-12 xl:peer-data-[state=collapsed]:px-16 2xl:peer-data-[state=collapsed]:px-24">
                        {children}
                      </div>
                    </main>
                  </SidebarInset>
                </SidebarProvider>
              ) : (
                <div className="flex min-h-screen flex-col bg-background">
                  <header className="flex items-center justify-center px-6 py-10">
                    <div className="flex items-center gap-2">
                      <img src="/addu-logo.png" alt="City of Addu Logo" className="h-10 w-auto" />
                      <span className="text-lg font-semibold">Rahunu Registry</span>
                    </div>
                  </header>
                  <main className="flex flex-1 items-center justify-center px-4 pb-16">
                    {children}
                  </main>
                </div>
              )}
            </KeyboardShortcutsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
