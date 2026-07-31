import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Context Words", template: "%s | Context Words" },
  description: "Save English words and phrases with their context.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
