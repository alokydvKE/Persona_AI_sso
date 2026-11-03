import {
//   BadgeCheck,
//   Bell,
  ChevronsUpDown,
//   CreditCard,
  LogOut,
//   Sparkles,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
// import { useNavigate } from "react-router";
import { cn, getInitials } from "@/lib/utils";
import { Logout } from "@/api/Auth/mutation";

export function NavUser() {
  const { isMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const encryptUser = localStorage.getItem("user");
  const dycryptUser = atob(encryptUser || "");
  const User: { firstName: string; lastName: string; token:string } = JSON.parse(dycryptUser);

  const {mutate} = Logout()

  return (
    <SidebarMenu className={cn(isCollapsed && "items-center")}>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              // A white card in the expanded sidebar; just the avatar in icon mode.
              className={cn(
                "cursor-pointer rounded-xl border border-sidebar-border bg-card shadow-xs md:h-12 md:p-2",
                "hover:border-primary/30 hover:bg-card data-[state=open]:border-primary/30 data-[state=open]:bg-card",
                "group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:shadow-none",
              )}
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">{getInitials(`${User.firstName} ${User.lastName}`)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{User.firstName} {User.lastName}</span>
                {/* <span className="truncate text-xs">{User.email}</span> */}
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "right" : "top"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">{getInitials(`${User.firstName} ${User.lastName}`)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{User.firstName} {User.lastName}</span>
                  {/* <span className="truncate text-xs">{User.email}</span> */}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={()=>mutate()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
