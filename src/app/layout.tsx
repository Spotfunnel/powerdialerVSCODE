import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Power Dialer | Ultra-Simple Outbound",
  description: "Seamless outbound calling for high-performance sales teams.",
  manifest: "/manifest.json",
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  themeColor: "#ffffff",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PowerDialer",
  },
  icons: {
    apple: "/icon-512x512.png",
  },
};

import { Providers } from "@/components/Providers";
import { TwilioProvider } from "@/contexts/TwilioContext";
import { GlobalCallNotification } from "@/components/GlobalCallNotification";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { GlobalStatusWidget } from "@/components/GlobalStatusWidget";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PushSync } from "@/components/PushSync";

import React from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/service-worker.js').then(function(registration) {
                    console.log('SW registered:', registration.scope);
                  }, function(err) {
                    console.log('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
        <ErrorBoundary>
          <React.Suspense fallback={null}>
            <Providers>
              <TwilioProvider>
                <PushSync />
                <GlobalCallNotification />
                <PresenceHeartbeat />
                <GlobalStatusWidget />
                {children}
              </TwilioProvider>
            </Providers>
          </React.Suspense>
        </ErrorBoundary>
      </body>
    </html>
  );
}
