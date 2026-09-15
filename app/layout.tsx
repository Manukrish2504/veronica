import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veronica",
  description: "Your one-person job search agent",
};

// Same webfonts MT_v2 loads (src/styles/fonts.css).
const FONTS =
  "https://fonts.googleapis.com/css2?family=Google+Sans+Text:ital,wght@0,400..700;1,400..700&family=Roboto+Flex:opsz,wght@8..144,300..800&family=Roboto+Mono:wght@400..600&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap";
const ICONS = "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..600,0..1,0&display=block";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS} />
        <link rel="stylesheet" href={ICONS} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <MotionConfig reducedMotion="user" transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}>
            <TooltipProvider>{children}</TooltipProvider>
          </MotionConfig>
          <Toaster
            position="bottom-right"
            toastOptions={{ style: { background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--outline-variant)", fontFamily: "var(--font-sans)" } }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
