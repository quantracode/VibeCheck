import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { StoreInitializer } from "@/components/StoreInitializer";
import { LicenseInitializer } from "@/components/license";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "VibeCheck — Pre-Deploy Security Gate for AI-Generated Code",
  description:
    "VibeCheck is a local-first, pre-deploy security gate for AI-generated code. It detects hallucinated protections, missing enforcement, and security regressions before code ships.",
  openGraph: {
    title: "VibeCheck — Pre-Deploy Security Gate for AI-Generated Code",
    description: "Verify what your code actually enforces — before it ships.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <StoreInitializer />
          <LicenseInitializer />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
