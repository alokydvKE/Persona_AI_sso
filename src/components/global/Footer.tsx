import { Logo } from "@/assets";
import { useLocation, useNavigate } from "react-router";

const Footer = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onPrivacyPolicy = pathname === "/privacy-policy";
  return (
    <footer className="border-t border-[#F1F1F1] px-8 md:px-14 py-8 bg-white">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        {/* LEFT */}
        <div className="flex items-center gap-3">
          {/* <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#6338F6] to-[#8B5CF6] flex items-center justify-center text-white shadow-lg shadow-[#6338F6]/20"> */}
          <Logo size={55} />
          {/* </div> */}

          <div>
            <h4 className="text-sm font-semibold text-[#111827]">PERSONA-AI</h4>

            <p className="text-xs text-[#6B7280] mt-1">
              Multi-Persona AI for Strategic Future Planning
            </p>
          </div>
        </div>

        {/* CENTER */}
        <div className="flex items-center gap-8 text-sm text-[#6B7280]">
          {!onPrivacyPolicy && (
            <button
              className="hover:text-[#6338F6] transition-all"
              onClick={() => navigate("/privacy-policy")}
            >
              Privacy Policy
            </button>
          )}

          {/* <button className="hover:text-[#6338F6] transition-all">
                Contact Us
              </button> */}
        </div>

        {/* RIGHT */}
        <div className="text-sm text-[#9CA3AF] text-center md:text-right max-w-md leading-6">
          *AI predictions are for informational purposes only.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
