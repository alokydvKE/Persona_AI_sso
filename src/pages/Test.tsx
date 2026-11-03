import Footer from "@/components/global/Footer";
import Header from "@/components/global/Header";
import ScrollToTop from "@/hooks/ScrollToTop";
import {
  Sparkles,
  Brain,
  Wand2,
  Layers3,
  Mail,
  Users,
  LineChart,
  ShieldCheck,
  MessagesSquare,
} from "lucide-react";

export default function PersonaAILandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eef1ff] via-[#f8f9ff] to-[#e8ecff] font-sans p-4 md:p-6">
      <ScrollToTop />
      <div className="max-w-7xl mx-auto bg-white rounded-[36px] shadow-[0_20px_80px_rgba(99,56,246,0.08)] overflow-hidden border border-white/60 backdrop-blur-xl">
        {/* HEADER */}
          <Header/>
        {/* HERO */}
        <section className="px-8 md:px-14 pt-10 pb-14">
          <p className="text-[#6B7280] mb-4">Future Intelligence Platform</p>

          <h2 className="text-4xl md:text-6xl font-semibold leading-[1.1] tracking-[-2px] text-[#111827] max-w-5xl">
            Multi-Persona AI
            <br />
            for Strategic
            <br />
            <span className="text-[#6338F6]">Future Planning</span>
          </h2>

          <p className="text-[#6B7280] text-lg leading-8 mt-8 max-w-4xl">
            Leverage historical data to generate expert AI personas. Engage in
            individual or group discussions to gain diverse perspectives on
            future predictions and strategic decisions.
          </p>

          {/* GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-14">
            {/* BIG CARD */}
            <div className="lg:col-span-8 rounded-[32px] overflow-hidden bg-gradient-to-br from-[#5f6fff] to-[#7b89ff] min-h-[360px] relative p-10 shadow-[0_20px_50px_rgba(99,56,246,0.2)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.35),transparent_40%)]" />

              <div className="relative z-10">
                <div className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-md border border-white/30 flex items-center justify-center text-white mb-10">
                  <Brain size={18} />
                </div>

                <h3 className="text-4xl font-semibold text-white leading-tight max-w-2xl">
                  Enterprise-Grade Decision Intelligence
                </h3>

                <p className="text-white/80 mt-4 text-lg max-w-2xl leading-8">
                  Built for professionals who need reliable, explainable AI
                  insights for strategic planning, forecasting, and data-driven
                  decision making.
                </p>

                {/* FLOATING CARDS */}
                <div className="absolute left-10 flex gap-5 mt-3">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="w-36 h-44 bg-white/20 backdrop-blur-2xl rounded-[28px] border border-white/30 p-4 shadow-xl rotate-[-4deg]"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white/30 mb-4 flex items-center justify-center text-white">
                        {item === 1 && <ShieldCheck size={24} />}
                        {item === 2 && <LineChart size={24} />}
                        {item === 3 && <Users size={24} />}
                      </div>

                      <div className="h-3 bg-white/60 rounded-full w-20 mb-2" />
                      <div className="h-3 bg-white/40 rounded-full w-16 mb-3" />
                      <div className="h-9 rounded-2xl bg-white/20" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SIDE CARD */}
            <div className="lg:col-span-4 rounded-[32px] bg-[#F5F7FF] p-8 min-h-[360px] relative overflow-hidden border border-white shadow-[0_10px_40px_rgba(99,56,246,0.08)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,56,246,0.12),transparent_40%)]" />

              <div className="relative z-10">
                <h3 className="text-2xl font-semibold text-[#111827] leading-snug">
                  Expert AI Personas
                </h3>

                <p className="text-[#6B7280] mt-4 leading-7">
                  Access specialized AI personas trained on historical data,
                  each offering unique expertise, strategic thinking, and
                  communication styles.
                </p>

                <div className="mt-10 flex items-center justify-center">
                  <div className="w-[260px] h-[180px] relative">
                    <div className="absolute left-0 top-10 w-32 h-40 rounded-[28px] bg-[#ff5f72] rotate-[-15deg] shadow-xl" />

                    <div className="absolute left-14 top-4 w-32 h-40 rounded-[28px] bg-[#72e0d1] rotate-[8deg] shadow-xl" />

                    <div className="absolute right-0 top-8 w-32 h-40 rounded-[28px] bg-[#6386ff] rotate-[15deg] shadow-xl" />

                    <div className="absolute left-1/2 top-0 -translate-x-1/2 w-36 h-44 rounded-[30px] bg-white shadow-2xl border border-[#ECECEC] p-5">
                      <div className="w-full h-20 rounded-2xl bg-[#F3F4F6] mb-4 flex items-center justify-center text-[#6338F6]">
                        <Brain size={32} />
                      </div>

                      <div className="h-3 bg-[#D1D5DB] rounded-full mb-2" />
                      <div className="h-3 bg-[#E5E7EB] rounded-full w-2/3" />
                    </div>
                  </div>
                </div>

                <button className="mt-8 px-6 h-11 rounded-2xl bg-gradient-to-r from-[#6338F6] to-[#8B5CF6] text-white shadow-lg shadow-[#6338F6]/20">
                  <span className="flex items-center gap-2">
                    <Sparkles size={18} />
                    AI Personas
                  </span>
                </button>
              </div>
            </div>

            {/* SMALL CARDS */}
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="lg:col-span-4 rounded-[32px] bg-[#F7F8FF] p-8 min-h-[320px] border border-white shadow-[0_10px_40px_rgba(99,56,246,0.06)] relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(99,56,246,0.12),transparent_40%)]" />

                <div className="relative z-10 flex flex-col h-full">
                  <div>
                    {item === 1 && (
                      <>
                        <h3 className="text-2xl font-semibold text-[#111827]">
                          <span className="flex items-center gap-2">
                            <MessagesSquare
                              size={20}
                              className="text-[#6338F6]"
                            />
                            Group Discussions
                          </span>
                        </h3>

                        <p className="text-[#6B7280] mt-3 leading-7">
                          Collaborate with multiple AI personas simultaneously
                          to uncover balanced and diverse strategic insights.
                        </p>
                      </>
                    )}

                    {item === 2 && (
                      <>
                        <h3 className="text-2xl font-semibold text-[#111827]">
                          <span className="flex items-center gap-2">
                            <LineChart size={20} className="text-[#6338F6]" />
                            Data-Driven Insights
                          </span>
                        </h3>

                        <p className="text-[#6B7280] mt-3 leading-7">
                          Transform historical data into actionable future
                          predictions with explainable AI intelligence.
                        </p>
                      </>
                    )}

                    {item === 3 && (
                      <>
                        <h3 className="text-2xl font-semibold text-[#111827]">
                          <span className="flex items-center gap-2">
                            <Wand2 size={20} className="text-[#6338F6]" />
                            Scenario Planning
                          </span>
                        </h3>

                        <p className="text-[#6B7280] mt-3 leading-7">
                          Simulate future business scenarios and evaluate
                          strategic outcomes before making critical decisions.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex-1 flex items-center justify-center py-8">
                    {item === 1 && (
                      <div className="w-full rounded-[28px] bg-white p-5 shadow-xl border border-[#F1F1F1]">
                        <div className="flex flex-wrap gap-3 mb-5">
                          {["AI Debate", "Future Trends", "Strategy"].map(
                            (tag) => (
                              <span
                                key={tag}
                                className="px-4 py-2 rounded-full bg-[#EEF2FF] text-[#6338F6] text-sm font-medium"
                              >
                                {tag}
                              </span>
                            ),
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="h-3 rounded-full bg-[#E5E7EB] w-full" />
                          <div className="h-3 rounded-full bg-[#D1D5DB] w-4/5" />
                          <div className="h-3 rounded-full bg-[#E5E7EB] w-3/5" />
                        </div>
                      </div>
                    )}

                    {item === 2 && (
                      <div className="flex flex-wrap gap-4 justify-center">
                        {[
                          "Forecasting",
                          "Analytics",
                          "Insights",
                          "Predictions",
                        ].map((tag) => (
                          <div
                            key={tag}
                            className="px-6 py-3 rounded-2xl bg-white shadow-lg text-[#6338F6] font-medium border border-[#F1F1F1]"
                          >
                            {tag}
                          </div>
                        ))}
                      </div>
                    )}

                    {item === 3 && (
                      <div className="w-full h-48 rounded-[28px] bg-gradient-to-br from-[#eef2ff] to-[#dbeafe] relative overflow-hidden">
                        <div className="absolute bottom-6 left-6 right-6 h-20 rounded-[24px] bg-gradient-to-r from-[#6338F6] to-[#8B5CF6] rotate-[-10deg] shadow-xl" />

                        <div className="absolute top-8 left-8 w-20 h-20 rounded-[24px] bg-white shadow-xl flex items-center justify-center text-[#6338F6]">
                          <Layers3 size={28} />
                        </div>

                        <div className="absolute top-8 right-8 w-24 h-16 rounded-[24px] bg-white shadow-xl flex items-center justify-center text-[#6338F6]">
                          <LineChart size={28} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* NEWSLETTER */}
            <div className="lg:col-span-12 rounded-[36px] overflow-hidden bg-gradient-to-br from-[#f5f7ff] to-[#eef2ff] p-10 md:p-16 relative border border-white shadow-[0_20px_60px_rgba(99,56,246,0.08)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,56,246,0.12),transparent_35%)]" />

              <div className="relative z-10">
                <h3 className="text-4xl font-semibold text-[#111827] max-w-3xl leading-tight">
                  <span className="flex items-center gap-3">
                    <Layers3 size={32} className="text-[#6338F6]" />
                    Strategic Intelligence Powered by Multi-Persona AI
                  </span>
                </h3>

                <p className="text-[#6B7280] mt-5 text-lg max-w-3xl leading-8">
                  Unlock enterprise-grade future planning with AI-driven
                  personas, collaborative strategic discussions, and data-backed
                  decision intelligence.
                </p>

                <div className="mt-12 bg-white rounded-[30px] shadow-[0_20px_50px_rgba(99,56,246,0.08)] p-4 md:p-5 flex flex-col md:flex-row gap-4 items-center max-w-3xl border border-[#F3F4F6]">
                  <input
                    placeholder="Full name"
                    className="flex-1 h-14 rounded-2xl bg-[#F8F9FB] px-5 outline-none border border-[#ECECEC]"
                  />

                  <input
                    placeholder="Work email address"
                    className="flex-1 h-14 rounded-2xl bg-[#F8F9FB] px-5 outline-none border border-[#ECECEC]"
                  />

                  <button className="h-14 px-8 rounded-2xl bg-gradient-to-r from-[#6338F6] to-[#8B5CF6] text-white font-medium shadow-lg shadow-[#6338F6]/20 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <Mail size={18} />
                      Request Demo
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <Footer/>
      </div>
    </div>
  );
}
