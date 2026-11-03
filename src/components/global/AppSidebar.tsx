import { Link, useLocation } from "react-router";
import { Settings, LayoutDashboard } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavUser } from "./NavUser";
import { Logo } from "@/assets";
import { cn } from "@/lib/utils";

// Added "Chat" to match your landing page capabilities
const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
//   { title: "Chat", url: "/", icon: MessagesSquare },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { state } = useSidebar(); // Lets us detect if the sidebar is expanded or collapsed
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r border-[#F1F1F1] bg-white transition-all duration-300"
    >
      {/* SIDEBAR HEADER: LOGO & BRAND NAME */}
      <SidebarHeader className="py-0! px-4 bg-white">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="hover:bg-transparent p-0!">
              <Link to="/dashboard" className="flex items-center gap-3 overflow-hidden shrink-0 select-none [&_svg]:size-12!">
                  <Logo size={45} />
                {/* Smooth text appearance when sidebar unfolds */}
                <span className={cn(
                  "text-xs font-bold tracking-wider text-[#111827] transition-all duration-300 whitespace-nowrap uppercase",
                  isCollapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100"
                )}>
                  Persona-AI
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* SIDEBAR NAVIGATION ITEMS */}
      <SidebarContent className="px-2 bg-white">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {items.map((item) => {
                const isActive = pathname === item.url;
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "w-full h-11 rounded-xl transition-all duration-200 font-medium px-3 flex items-center",
                        isActive 
                          ? "bg-[#F5F6FF] text-[#6338F6] shadow-none font-semibold hover:bg-[#F5F6FF] hover:text-[#6338F6]" 
                          : "text-[#4B5563] hover:bg-[#F8F9FF] hover:text-[#6338F6]"
                      )}
                    >
                      <Link to={item.url} className="flex items-center gap-3 w-full">
                        {/* Nav Icon with subtle glow when active */}
                        <div className={cn(
                          "transition-transform duration-200 group-hover:scale-105 flex items-center justify-center",
                          isActive ? "text-[#6338F6]" : "text-[#4B5563]"
                        )}>
                          <item.icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                        </div>
                        
                        {/* Menu Item Text label */}
                        <span className={cn(
                          "text-sm tracking-wide transition-opacity duration-200",
                          isCollapsed ? "opacity-0 w-0" : "opacity-100"
                        )}>
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
      </SidebarContent>

      {/* SIDEBAR FOOTER: PROFILE USER CONTROLS */}
      <SidebarFooter className={cn(
        "p-3 border-t border-[#F1F1F1] transition-all duration-300 bg-white ",
        isCollapsed ? "items-center" : ""
      )}>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}