import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Settings,
  House,
  Plus,
  Users,
  MessageSquare,
  MoreVertical,
  Pencil,
  Search,
  X,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavUser } from "./NavUser";
import { Logo } from "@/assets";
import { cn } from "@/lib/utils";
import { setPersonaDialog } from "@/redux/ProjectSlice";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/redux/store";
import { ScrollArea } from "../ui/scroll-area";
import { useChatList, type RecentChat } from "@/api/Chat/query";
import { RenameChatDialog } from "../common/Chat/RenameChatDialog";
import { useActiveProjectId, chatIdFromPath } from "@/hooks/useActiveProjectId";

// The projects dashboard is labelled "Home" here.
const items = [
  { title: "Home", url: "/dashboard", icon: House },
  { title: "Settings", url: "/settings", icon: Settings },
];

// Navigation rows. The chat actions use the same look as an inactive row.
const NAV_ROW =
  "w-full h-10 rounded-lg transition-all duration-150 font-medium px-3 flex items-center";
const NAV_ROW_IDLE = "text-[#4B5563] hover:bg-[#6338F6]/10 hover:text-[#6338F6]";
const NAV_ROW_ACTIVE =
  "bg-[#6338F6]! text-white! font-semibold shadow-sm hover:bg-[#6338F6] hover:text-white";

// Small square icon buttons in the Chats list (search, close, row options).
const LIST_ICON_BUTTON =
  "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none";

export function NewAppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const dispatch = useDispatch<AppDispatch>();
  const isCollapsed = state === "collapsed";
  const projectId = useActiveProjectId();

  const inChat = pathname.includes("/chat") || pathname.includes("/group-chat");
  const activeId = chatIdFromPath(pathname);

  // Chats come from the backend chat-list (the source of truth across reloads
  // and devices); freshly started chats appear once their start call invalidates
  // the ["ChatList", projectId] query.
  const { data: sessions = [], isLoading } = useChatList(projectId);

  // The Chats row currently open in the rename dialog (null = dialog closed).
  const [renameTarget, setRenameTarget] = useState<RecentChat | null>(null);

  const startNewChat = () => {
    if (!projectId) return;
    navigate("/chat", { state: { projectId, forceNew: true } });
  };

  return (
    <Sidebar
      collapsible="icon"
      // REMOVED hardcoded w-[260px] so shadcn can control widths natively on collapse
      className="border-r border-[#E5E7EB] font-sans"
    >
      {/* HEADER: Logo & Brand */}
      <SidebarHeader className="py-1! px-3 transition-all">
        <div
          className={cn(
            "flex items-center gap-2.5 px-1 select-none cursor-pointer transition-all",
            isCollapsed ? "justify-center" : "",
          )}
          onClick={() => navigate("/")}
        >
          <Logo size={45} />
          {!isCollapsed && (
            <span className="text-base font-bold tracking-tight text-[#111827] animate-in fade-in duration-200">
              Persona AI
            </span>
          )}
        </div>
      </SidebarHeader>

      {/* CONTENT: Core Navigation Options */}
      <SidebarContent className="px-2 space-y-4 overflow-hidden">
        <SidebarGroup className="p-0 shrink-0">
          <SidebarGroupLabel className="px-3 text-xs font-semibold text-[#6B7280] tracking-wider mb-2 group-data-[collapsible=icon]:hidden">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className={cn("gap-1", isCollapsed && "items-center")}>
              {items.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title} // Crucial for icon mode tooltips
                      className={cn(NAV_ROW, isActive ? NAV_ROW_ACTIVE : NAV_ROW_IDLE)}
                    >
                      {/* FIXED: Elements must sit flat side-by-side inside the Link component directly */}
                      <Link to={item.url}>
                        <item.icon size={16} className="shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden text-sm">
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {inChat && (
          <>
            <SidebarSeparator className="mx-1" />

            {/* Chat actions, styled like the navigation rows above. In icon
                mode they shrink to icons and show their name on hover. */}
            <SidebarGroup className="p-0 shrink-0">
              <SidebarMenu className={cn("gap-1", isCollapsed && "items-center")}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={startNewChat}
                    disabled={!projectId}
                    tooltip="New chat"
                    className={cn(NAV_ROW, NAV_ROW_IDLE)}
                  >
                    <Plus size={16} className="shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden text-sm">
                      New chat
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => dispatch(setPersonaDialog(true))}
                    tooltip="Start group chat"
                    className={cn(NAV_ROW, NAV_ROW_IDLE)}
                  >
                    <Users size={16} className="shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden text-sm">
                      Start group chat
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <ChatList
              sessions={sessions}
              isLoading={isLoading}
              activeId={activeId}
              onRename={setRenameTarget}
            />
          </>
        )}
      </SidebarContent>

      {/* Rename dialog — mounted once; opens when a Chats row is selected. */}
      <RenameChatDialog
        chat={renameTarget}
        onClose={() => setRenameTarget(null)}
      />

      {/* FOOTER: Profile Management */}
      <SidebarFooter className="p-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

/**
 * The project's chats, newest first, with a title search behind the header's
 * search icon. Hidden in icon mode. Fills the remaining space; only the list
 * scrolls (the navigation and actions above stay fixed).
 */
function ChatList({
  sessions,
  isLoading,
  activeId,
  onRename,
}: {
  sessions: RecentChat[];
  isLoading: boolean;
  activeId: string | undefined;
  onRename: (chat: RecentChat) => void;
}) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      needle ? sessions.filter((s) => s.title.toLowerCase().includes(needle)) : sessions,
    [sessions, needle],
  );

  const closeSearch = () => {
    setSearching(false);
    setQuery("");
  };

  return (
    <SidebarGroup className="px-2 min-h-0 flex-1 group-data-[collapsible=icon]:hidden">
      <div className="mb-2 flex h-8 shrink-0 items-center gap-1">
        {searching ? (
          <div className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-sidebar-border bg-card pl-2 focus-within:border-primary/40">
            <Search size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              // Opened by a click on the search icon, so taking focus is expected.
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  closeSearch();
                }
              }}
              placeholder="Search chats"
              aria-label="Search chats"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-sidebar-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={closeSearch}
              className={LIST_ICON_BUTTON}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Chats
            </span>
            {/* Nothing to search until there is at least one chat. */}
            {sessions.length > 0 && (
              <button
                type="button"
                aria-label="Search chats"
                onClick={() => setSearching(true)}
                className={LIST_ICON_BUTTON}
              >
                <Search size={14} />
              </button>
            )}
          </>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground px-1 italic">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1 italic">No chats yet</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1 italic break-words">
          No chats match “{query.trim()}”
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <SidebarMenu>
            {visible.map((session, index) => {
              const Icon = session.kind === "group" ? Users : MessageSquare;
              return (
                <SidebarMenuItem
                  key={session.id}
                  style={{
                    animationDelay: `${Math.min(index, 10) * 30}ms`,
                    animationFillMode: "backwards",
                  }}
                  // Lay the row out as [link | ⋯] so the options button is
                  // always in-flow (never absolutely positioned off-screen by a
                  // long title) and the title truncates beside it.
                  className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 duration-300 animate-in fade-in slide-in-from-left-1"
                >
                  <SidebarMenuButton
                    asChild
                    isActive={session.id === activeId}
                    className="min-w-0 max-w-full data-active:bg-primary! data-active:text-white"
                  >
                    <Link
                      to={session.to}
                      state={{ projectId: session.projectId }}
                      title={session.title}
                    >
                      <Icon size={14} className="shrink-0" />
                      {/* min-w-0 lets the title ellipsize instead of
                          expanding the row past the sidebar. */}
                      <span className="min-w-0 flex-1 truncate">
                        {session.title}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {/* Shown on every row (short or long title) so the
                          rename affordance is always reachable. */}
                      <button
                        type="button"
                        aria-label="Chat options"
                        className={cn(LIST_ICON_BUTTON, "data-[state=open]:bg-primary/10 data-[state=open]:text-primary")}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={() => onRename(session)}
                      >
                        <Pencil size={14} className="mr-2" />
                        Rename
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </ScrollArea>
      )}
    </SidebarGroup>
  );
}
