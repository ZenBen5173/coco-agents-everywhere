import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { Chrome } from "@/components/chrome";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";

/** Display face, self-hosted by next/font — no render-blocking stylesheet. */
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "COCO",
  description: "A Slack group agent that hears what people commit to, and lets a human decide what goes on the board.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const channelName = process.env.SLACK_CHANNEL_NAME ?? "your channel";
  return (
    <html lang="en" className={instrumentSans.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <Providers channelName={channelName}>
          <Chrome>{children}</Chrome>
        </Providers>
      </body>
    </html>
  );
}
