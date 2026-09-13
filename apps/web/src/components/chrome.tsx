"use client";

/**
 * The frame every page shares: rail on the left, the page, the chat panel on
 * the right. The chat panel lives here rather than on a page so the agent's
 * tools and context are registered everywhere — a correction typed on the
 * overview moves the same card it would on the board.
 *
 * Texture comes from three pieces: myTask's water ripples behind the glass
 * rail, a hover highlight that glides between nav rows instead of cutting, and
 * breadcrumbs that stagger in.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { MessageSquare, Menu } from "lucide-react";
import { CheckCheckIcon } from "@/components/ui/check-check";
import { CalendarDaysIcon } from "@/components/ui/calendar-days";
import { LayoutIcon } from "@/components/ui/layout";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AmbientField } from "@/components/ambient-field";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import Breadcrumb from "@/components/smoothui/breadcrumb";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIconHover, type AnimatedIcon } from "@/components/icon-hover";
import { MemberPicker } from "@/components/member-picker";
import { CalendarStatus } from "@/components/calendar-status";
import { ChatPanel } from "@/components/chat-panel";
import { AppControl } from "@/components/app-control";
import { GenerativeUI } from "@/components/generative-ui";
import { ItemSheet } from "@/components/item-sheet";
import { useWorkspace } from "@/lib/store";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

const PAGES: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/", label: "Overview", match: (p) => p === "/" },
  { href: "/review", label: "Review", match: (p) => p.startsWith("/review") },
  { href: "/board", label: "Board", match: (p) => p.startsWith("/board") },
];

export function Chrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-dvh w-full bg-background text-foreground">
      {/* myTask's water: the pointer dents a simulated surface and the ripples
          bend what is behind them. Sits at the root, behind the rail as well as
          the content, so the rail's backdrop-blur has something to blur.
          Switches itself off under reduced motion. */}
      <AmbientField />
      <AppControl />
      <GenerativeUI />
      <SidebarProvider>
        <Body>{children}</Body>
      </SidebarProvider>
      <ItemSheet />
    </div>
  );
}

function Body({ children }: { children: ReactNode }) {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const { captures, channelName } = useWorkspace();
  const [chatOpen, setChatOpen] = useState(false);
  const here = PAGES.find((p) => p.match(pathname)) ?? PAGES[0]!;

  return (
    <div className="relative flex h-dvh w-full flex-col">
      <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/45 px-3 backdrop-blur-xl sm:gap-3 sm:px-4">
        <button
          onClick={() => setOpenMobile(true)}
          aria-label="Open menu"
          className="-ml-1 grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          <Menu className="size-5" />
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2 md:w-[calc(var(--sidebar-width)-1rem)]">
          <span className="grid size-6 place-items-center rounded-md bg-primary font-display text-[11px] font-bold text-primary-foreground">
            CO
          </span>
          <span className="truncate font-display text-sm font-semibold">COCO</span>
        </Link>

        <div className="hidden sm:contents">
          <Breadcrumb key={here.href} items={[{ label: `#${channelName}`, href: "/" }, { label: here.label }]} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <MemberPicker compact />
          <ThemeToggle className="size-10 sm:size-8" />
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            aria-label="Open chat"
            className="grid size-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-8 lg:hidden"
          >
            <MessageSquare className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsible="icon"
          className="top-14 h-[calc(100svh-3.5rem)] [&_[data-slot=sidebar-inner]]:border-r [&_[data-slot=sidebar-inner]]:border-border/60 [&_[data-slot=sidebar-inner]]:bg-sidebar/30 [&_[data-slot=sidebar-inner]]:backdrop-blur-xl"
        >
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <GlidingMenu>
                  <NavItem icon={LayoutIcon} label="Overview" href="/" active={here.href === "/"} />
                  <NavItem
                    icon={CheckCheckIcon}
                    label="Review"
                    href="/review"
                    active={here.href === "/review"}
                    badge={captures.length}
                  />
                  <NavItem icon={CalendarDaysIcon} label="Board" href="/board" active={here.href === "/board"} />
                </GlidingMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="gap-2 group-data-[collapsible=icon]:hidden">
            <CalendarStatus />
            <p className="px-2 pb-1 text-[11px] text-muted-foreground">You are</p>
            <MemberPicker />
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-h-0 overflow-y-auto bg-transparent">{children}</SidebarInset>

        <aside className="hidden w-[380px] shrink-0 border-l border-border/60 bg-card/20 backdrop-blur-xl lg:flex lg:flex-col xl:w-[420px]">
          <ChatPanel />
        </aside>
      </div>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetTitle className="sr-only">Chat</SheetTitle>
          <div className="flex h-full flex-col">
            <ChatPanel />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

type Box = { top: number; left: number; width: number; height: number };

/**
 * One highlight for the whole menu, positioned by measurement, so it glides
 * from row to row instead of cutting. A `layoutId` per row would unmount and
 * remount between rows and lose the animation.
 */
function GlidingMenu({ children }: { children: ReactNode }) {
  const host = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const { state } = useSidebar();

  const track = (e: React.PointerEvent) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-slot='sidebar-menu-button']");
    const h = host.current;
    if (!row || !h || !h.contains(row)) return;
    const r = row.getBoundingClientRect();
    const hb = h.getBoundingClientRect();
    setBox({ top: r.top - hb.top, left: r.left - hb.left, width: r.width, height: r.height });
  };

  return (
    <SidebarMenu ref={host} onPointerMove={track} onPointerLeave={() => setBox(null)} className="relative">
      {state !== "collapsed" && (
        <motion.li
          aria-hidden
          className="pointer-events-none absolute z-0 list-none rounded-md bg-sidebar-accent"
          initial={false}
          animate={box ? { opacity: 1, top: box.top, left: box.left, width: box.width, height: box.height } : { opacity: 0 }}
          transition={SPRING.default}
        />
      )}
      {children}
    </SidebarMenu>
  );
}

function NavItem({
  icon: Icon,
  label,
  href,
  active,
  badge = 0,
}: {
  icon: AnimatedIcon;
  label: string;
  href: string;
  active: boolean;
  badge?: number;
}) {
  const { ref, onMouseEnter, onMouseLeave } = useIconHover();
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} className="relative z-10">
      {active && (
        <motion.span
          className="absolute inset-y-1 left-0 z-10 w-0.5 rounded-full bg-primary"
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 2.8, ease: "easeInOut", repeat: Infinity }}
        />
      )}
      {/* The gliding highlight replaces the instant hover fill; both at once reads as a flicker. */}
      <SidebarMenuButton asChild isActive={active} tooltip={label} className="hover:bg-transparent data-[active=true]:bg-sidebar-accent/70">
        <Link href={href} onClick={() => setOpenMobile(false)}>
          <Icon ref={ref} size={16} />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
      {badge > 0 && (
        <SidebarMenuBadge className={cn("bg-primary text-primary-foreground tabular-nums")}>{badge}</SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}
