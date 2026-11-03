import { useCallback, useMemo, useState } from "react";
import { NewAppSidebar } from "@/components/global/NewSidebar";
import { PageHeaderSlotsContext } from "@/components/global/pageHeaderSlots";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Outlet, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import PersonaPanelDialog from "@/components/common/Chat/PersonaPanelDialog";
import { useActiveProjectId } from "@/hooks/useActiveProjectId";
import { useProjectDetail } from "@/api/Projects/query";

const Rootlayout = () => {
  const { pathname } = useLocation();

  // On chat/group-chat routes, show the active project's real name (from the
  // Project Details API) instead of a generic placeholder.
  const inChat =
    pathname.includes("/chat") || pathname.includes("/group-chat");
  const projectId = useActiveProjectId();
  const { data: project } = useProjectDetail(inChat ? projectId : undefined);

  // Dynamically extract a clean title string based on path routing
  const getPageTitle = () => {
    if (pathname.includes("dashboard")) return "Dashboard";
    if (pathname.includes("settings")) return "Settings";
    return project?.project_name ?? "Persona Space";
  };

  // Slots a page fills with its own title and actions (see PageHeader.tsx).
  // Callback refs, so the context updates once the elements exist.
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const titleRef = useCallback((el: HTMLElement | null) => setTitleSlot(el), []);
  const actionsRef = useCallback((el: HTMLElement | null) => setActionsSlot(el), []);
  const slots = useMemo(
    () => ({ title: titleSlot, actions: actionsSlot }),
    [titleSlot, actionsSlot],
  );

  return (
    <SidebarProvider 
      defaultOpen={true}
      style={{
        "--sidebar-width": "260px",
        "--sidebar-width-mobile": "260px",
        "--sidebar-width-icon": "76px",
      } as React.CSSProperties}
    >
      <div className="flex min-h-screen w-full bg-white font-sans">
        <NewAppSidebar />
        
        <SidebarInset className="bg-white flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden">
          <header className="sticky top-0 z-30 h-14 border-b border-[#F1F1F1] px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 bg-white/70 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
            {/* Breadcrumb: project, then (on chat routes) the chat's own name
                and status, which the page renders into the title slot. */}
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="shrink-0" />
              <span
                data-test-id={getPageTitle()}
                // Full name on hover, since a long one is cut short.
                title={getPageTitle()}
                className={cn(
                  "min-w-0 truncate text-sm",
                  // Inside a chat the project is the parent crumb, not the title:
                  // capped short, and it gives way before the chat title does.
                  inChat
                    ? "max-w-48 shrink-[2] text-muted-foreground"
                    : "font-medium text-[#111827]",
                )}
              >
                {getPageTitle()}
              </span>
              <div ref={titleRef} className="flex min-w-0 items-center" />
            </nav>
            <div ref={actionsRef} className="flex shrink-0 items-center" />
          </header>

          {/* MAIN INTERNAL VIEWPORT BODY ROUTE PANEL */}
          <main className="flex-1 overflow-y-auto bg-white">
            <PageHeaderSlotsContext.Provider value={slots}>
              <Outlet />
            </PageHeaderSlotsContext.Provider>
          </main>
        </SidebarInset>
      </div>

      {/* Persona panel: shared across chat routes, toggled via redux. */}
      <PersonaPanelDialog />
    </SidebarProvider>
  );
};

export default Rootlayout;