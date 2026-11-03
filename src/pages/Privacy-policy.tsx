import Footer from "@/components/global/Footer";
import Header from "@/components/global/Header";
import ScrollToTop from "@/hooks/ScrollToTop";
import { ShieldCheck, Mail } from "lucide-react";
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eef1ff] via-[#f8f9ff] to-[#e8ecff] font-sans p-4 md:p-6">
      <ScrollToTop />
      <div className="max-w-6xl mx-auto bg-white rounded-[36px] shadow-[0_20px_80px_rgba(99,56,246,0.08)] overflow-hidden border border-white/60 backdrop-blur-xl">
        {/* HEADER */}
        <Header />
        {/* HERO */}
        <section className="px-8 md:px-14 pt-12 pb-8">
          <div className="rounded-[32px] overflow-hidden bg-gradient-to-br from-[#5f6fff] to-[#7b89ff] p-10 md:p-14 relative shadow-[0_20px_50px_rgba(99,56,246,0.18)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.35),transparent_40%)]" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white mb-8">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-4xl md:text-5xl font-semibold text-white leading-tight max-w-3xl">
                Privacy Policy
              </h2>
              <p className="text-white/80 text-lg leading-8 mt-6 max-w-3xl">
                At PERSONA-AI, we respect your privacy and are committed to
                protecting the personal information you share with us.
              </p>
              <div className="mt-8 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 text-white text-sm">
                Effective Date: May 29, 2026
              </div>
            </div>
          </div>
        </section>
        {/* CONTENT */}
        <section className="px-8 md:px-14 pb-14">
          <div className="grid grid-cols-1 gap-6">
            {/* SECTION */}
            {[
              {
                title: "1. Introduction",
                content:
                  "Welcome to PERSONA-AI. We respect your privacy and are committed to protecting any personal information you share with us. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website. By using our website, you consent to the practices described in this policy.",
              },
              {
                title: "2. Information We Collect",
                content:
                  "We collect both personal and non-personal information when you interact with our platform. This may include your name, email address, phone number, company name, job title, IP address, browser type, operating system, referring URLs, and website usage data collected through cookies and analytics tools.",
              },
              {
                title: "3. How We Use Your Information",
                content:
                  "We use the information collected to provide, operate, and improve our services, communicate with you regarding updates and insights, personalize your experience, analyze platform usage, comply with legal obligations, and protect our rights and security.",
              },
              {
                title: "4. Sharing of Information",
                content:
                  "We do not sell, rent, or trade your personal information. However, we may share information with trusted service providers who assist with analytics, infrastructure, communication, and platform operations, or when required for legal compliance and security purposes.",
              },
              {
                title: "5. Cookies and Tracking Technologies",
                content:
                  "We use cookies, web beacons, and similar tracking technologies to improve platform performance, analyze traffic, and enhance user experience. You can control cookie preferences through your browser settings.",
              },
              {
                title: "6. Data Security",
                content:
                  "We implement industry-standard security measures to protect your information. While we strive to safeguard all personal data, no method of internet transmission or electronic storage is completely secure.",
              },
              {
                title: "7. Third-Party Links",
                content:
                  "Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices or content of those external websites.",
              },
              {
                title: "8. Your Rights and Choices",
                content:
                  "Depending on your location and applicable laws, you may have rights regarding access, correction, deletion, or restriction of your personal data. You may also opt out of certain communications at any time.",
              },
              {
                title: "9. Changes to This Policy",
                content:
                  "We may update this Privacy Policy periodically. Any updates will be reflected on this page along with the latest effective date.",
              },
            ].map((section, index) => (
              <div
                key={index}
                className="rounded-[28px] bg-[#F8F9FF] border border-white shadow-[0_10px_40px_rgba(99,56,246,0.06)] p-8 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,56,246,0.10),transparent_40%)]" />
                <div className="relative z-10">
                  <h3 className="text-2xl font-semibold text-[#111827] mb-5">
                    {section.title}
                  </h3>
                  <p className="text-[#6B7280] leading-8 text-[16px]">
                    {section.content}
                  </p>
                </div>
              </div>
            ))}
            {/* CONTACT CARD */}
            <div className="rounded-[32px] overflow-hidden bg-gradient-to-br from-[#f5f7ff] to-[#eef2ff] p-10 md:p-12 relative border border-white shadow-[0_20px_60px_rgba(99,56,246,0.08)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,56,246,0.12),transparent_35%)]" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6338F6] to-[#8B5CF6] flex items-center justify-center text-white shadow-lg shadow-[#6338F6]/20 mb-8">
                  <Mail size={24} />
                </div>
                <h3 className="text-3xl font-semibold text-[#111827]">
                  10. Contact Us
                </h3>
                <p className="text-[#6B7280] text-lg leading-8 mt-5 max-w-2xl">
                  If you have any questions, concerns, or requests regarding
                  this Privacy Policy or your personal data, please contact us.
                </p>
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white rounded-[24px] p-6 border border-[#F1F1F1] shadow-sm">
                    <p className="text-sm text-[#6B7280] mb-2">Company</p>
                    <h4 className="text-lg font-semibold text-[#111827]">
                      PERSONA-AI
                    </h4>
                  </div>
                  <div className="bg-white rounded-[24px] p-6 border border-[#F1F1F1] shadow-sm">
                    <p className="text-sm text-[#6B7280] mb-2">Email Support</p>
                    <h4 className="text-lg font-semibold text-[#111827]">
                      support@persona.ai
                    </h4>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* FOOTER */}
        <Footer />
      </div>
    </div>
  );
}
