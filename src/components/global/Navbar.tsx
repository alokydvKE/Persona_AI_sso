import { Logo } from "@/assets";
import ProfileDropDown from "./ProfileDropDown";
import { NavLink } from "react-router";
import { LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const Navbar = () => {
  return (
    <header
      className={
        "sticky top-0 z-50 bg-background/60 backdrop-blur border-b border-gray-200"
      }
    >
      <div className={"flex justify-between items-center mx-4 md:mx-48  "}>
        <div className="flex h-12 shrink-0 items-center gap-2">
          <div className="">
            <Logo size={45} />
            <span className="sr-only">Persona AI.</span>
          </div>
          <h3 className="font-semibold text-lg">Persona AI</h3>
        </div>
        <div className="flex items-center gap-4">
          <NavLink
            to={"/dashboard"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2",
                isActive &&
                  "px-2 py-1 rounded-md bg-white text-[#111827] border border-gray-200",
              )
            }
          >
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>
          <NavLink
            to={"/settings"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2",
                isActive &&
                  "px-2 py-1 rounded-md bg-white text-[#111827] border border-gray-200",
              )
            }
          >
            <Settings size={16} />
            Settings
          </NavLink>
        </div>
        <ProfileDropDown />
      </div>
    </header>
  );
};

export default Navbar;
