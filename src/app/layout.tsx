import type { Metadata } from "next";
import {
  APP_METADATA_DESCRIPTION,
  APP_METADATA_TITLE,
} from "@/constants/app";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_METADATA_TITLE,
  description: APP_METADATA_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Background blobs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -left-28 -top-24 h-[500px] w-[500px] rounded-full bg-violet-500/14 blur-[78px]" />
          <div className="absolute -bottom-24 -left-16 h-[520px] w-[520px] rounded-full bg-indigo-600/16 blur-[78px]" />
          <div className="absolute -right-24 top-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/12 blur-[82px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
