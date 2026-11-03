import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { getInitials } from "@/lib/utils";
import { LogOut, Settings, UserIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { Logout } from "@/api/Auth/mutation";

const ProfileDropDown = () => {
  const encryptUser = localStorage.getItem("user");
  const dycryptUser = atob(encryptUser || "");
  const User: { firstName: string; lastName: string; token:string } = JSON.parse(dycryptUser);

  const navigate = useNavigate()

  const {mutate} = Logout()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="bg-linear-to-r from-[#6338F6] to-[#8B5CF6] text-white">
          <AvatarFallback className="bg-linear-to-r from-[#6338F6] to-[#8B5CF6] text-white">{getInitials(`${User.firstName} ${User.lastName}`)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-fit">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium text-foreground">{User.firstName} {User.lastName}</p>
          {/* <p className="text-xs text-muted-foreground max-w-35 overflow-hidden text-ellipsis">
            {User.email}
          </p> */}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <UserIcon className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={()=>{
          navigate("/settings")
        }}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={()=>mutate()}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileDropDown;
