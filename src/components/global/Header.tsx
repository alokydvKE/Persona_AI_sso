import { Logo } from "@/assets";
import {
  ArrowRight,
  LayoutDashboard,
  MessagesSquare,
  Settings,
} from "lucide-react";
import { useNavigate } from "react-router";
import ProfileDropDown from "./ProfileDropDown";

const Header = () => {
  const navigate = useNavigate();
  const LoggedIn = localStorage.getItem("token");

  return (
    <header className="flex items-center justify-between px-8 py-7 border-b border-[#f1f1f1]">
      <div className="flex items-center gap-3">
        {/* <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#6338F6] to-[#8B5CF6] flex items-center justify-center text-white font-bold shadow-lg shadow-[#6338F6]/30"> */}
        <Logo size={55} />
        {/* </div> */}

        <h1 className="text-sm font-semibold tracking-wide text-[#111827]">
          PERSONA-AI
        </h1>
      </div>

      {LoggedIn && (
        <nav className="hidden md:flex items-center gap-10 text-sm text-[#4B5563]">
          <button className="px-4 py-2 rounded-xl bg-[#F5F6FF] text-[#111827] shadow-sm">
            Home
          </button>

          <button
            className="hover:text-[#6338F6] transition-all"
            onClick={() => navigate("/dashboard")}
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard size={16} />
              Dashboard
            </div>
          </button>

          <button
            className="hover:text-[#6338F6] transition-all"
            onClick={() => navigate("/")}
          >
            <div className="flex items-center gap-2">
              <MessagesSquare size={16} />
              Chat
            </div>
          </button>

          <button
            className="hover:text-[#6338F6] transition-all"
            onClick={() => navigate("/settings")}
          >
            <div className="flex items-center gap-2">
              <Settings size={16} />
              Settings
            </div>
          </button>
        </nav>
      )}

      {!LoggedIn ? (
        <button
          onClick={() => navigate("/login")}
          className="px-6 h-12 rounded-2xl bg-gradient-to-r from-[#6338F6] to-[#8B5CF6] text-white font-medium shadow-[0_15px_35px_rgba(99,56,246,0.35)] hover:scale-105 transition-all duration-300"
        >
          <span className="flex items-center gap-2">
            Get Started <ArrowRight size={18} />
          </span>
        </button>
      ) : (
        <ProfileDropDown />
      )}
    </header>
  );
};

export default Header;
