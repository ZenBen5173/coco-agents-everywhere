"use client";

/**
 * Client boundary for everything that needs a provider.
 *
 * `@copilotkit/react-core/v2` uses `export *` internally, and Next refuses to
 * pull an `export *` module across a client boundary directly from a Server
 * Component. Importing it inside an explicit `"use client"` module is the fix —
 * layout.tsx stays a Server Component.
 */
import type { ReactNode } from "react";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { MotionConfig } from "motion/react";
import { ThemeProvider as NextThemes } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { WorkspaceProvider } from "@/lib/store";

export function Providers({ channelName, children }: { channelName: string; children: ReactNode }) {
  // `runtimeUrl` points at the Hono handler in app/api/copilotkit.
  return (
    <NextThemes attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
        <CopilotKitProvider runtimeUrl="/api/copilotkit">
          <WorkspaceProvider channelName={channelName}>
            {children}
            <Toaster position="bottom-center" />
          </WorkspaceProvider>
        </CopilotKitProvider>
      </MotionConfig>
    </NextThemes>
  );
}
