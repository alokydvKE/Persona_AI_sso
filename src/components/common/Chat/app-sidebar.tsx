import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Logo } from "@/assets";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, useLocation, useParams } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/redux/store";
import { setPersonaDialog } from "@/redux/ProjectSlice";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const {projects} = useSelector((state:RootState)=>state.Project)
  const dispatch = useDispatch<AppDispatch>()
  const location = useLocation();
  const {id} = useParams();

  const state = location.state as { projectId: string };

  const Chats = React.useMemo(() => {
      if (!state.projectId) {
        return [];
      }
  
      const project = projects.find((pre) => pre.id === state.projectId);
  
      if (!project) return [];
  
      return project.chats;
    }, [projects, state]);

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader className="p-0 px-2 bg-primary/10">
        <div className="flex h-14 shrink-0 items-center gap-2">
          <div className="">
            <Logo size={45} />
            <span className="sr-only">Persona AI.</span>
          </div>
          <h3 className="font-semibold text-lg">Persona AI</h3>
        </div>
        <Button onClick={()=>dispatch(setPersonaDialog(true))} variant={"outline"} className="gap-4 justify-start hover:bg-secondary/40">
          <Plus />
          <span>New chat</span>
        </Button>
        <Button variant={"outline"} className="gap-4 justify-start hover:bg-secondary/40">
          <Users />
          <span>Start Group Chat</span>
        </Button>
      </SidebarHeader>
      <SidebarContent className="p-0 bg-primary/10">
        <SidebarGroup className="flex h-full min-h-0 flex-col">
          <SidebarGroupLabel>Recents</SidebarGroupLabel>

          <ScrollArea className="flex-1 overflow-hidden">
            <SidebarMenu>
              {Chats.map((item:any) => {
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={item.id === id} className="data-active:bg-primary! data-active:text-white">
                      <Link to={`/chat/${item.id}`} state={{projectId:state.projectId}}>{item.title}</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </ScrollArea>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
