import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "cn";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { QueryProvider } from "@/components/shared/query-provider";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Management | Projects and costing",
  description: "Organization workspaces for project management and costing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        geistSans.variable,
        geistMono.variable,
        `h-full antialiased`,
      )}
    >
      <body className="min-h-full flex flex-col">
        <NuqsAdapter>
          <ThemeProvider>
            <QueryProvider>{children}</QueryProvider>
            <Toaster richColors />
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
