export interface ScriptLine {
  role: "assistant" | "user"
  content: string
  createdAt?: boolean
  type?: string
  input?: boolean
}

export interface ChatMsg {
  id: string
  role: "assistant" | "user"
  content: string
  type?: string
}


// export const SCRIPT: ScriptLine[] = [
//   /* 0 – welcome */
//   {
//     role: "assistant",
//     content: `<div
//   style="
//     font-family: Inter, sans-serif;
//     line-height: 1.7;
//     color: #1f2937;
//     max-width: 700px;
//   "
// >
//   <div
//     style="
//       background: linear-gradient(135deg, #6338F6 0%, #8B5CF6 100%);
//       color: white;
//       padding: 20px;
//       border-radius: 14px;
//       margin-bottom: 20px;
//     "
//   >
//     <h2 style="margin: 0; font-size: 22px; font-weight: 700;">
//       🍷 Welcome to EverSip Persona Builder
//     </h2>
//     <p style="margin: 8px 0 0; opacity: 0.9;">
//       We'll create detailed customer personas from your description.
//     </p>
//   </div>

//   <div
//     style="
//       background: #f8f9ff;
//       border: 1px solid #e5e7eb;
//       border-radius: 12px;
//       padding: 18px;
//       margin-bottom: 20px;
//     "
//   >
//     <p style="margin-top: 0; font-weight: 600;">
//       For each persona, I'll capture:
//     </p>

//     <div style="display: flex; flex-direction: column; gap: 12px;">
//       <div
//         style="
//           display: flex;
//           align-items: center;
//           gap: 12px;
//           padding: 10px;
//           background: white;
//           border-radius: 10px;
//         "
//       >
//         <span style="font-size: 20px;">🎯</span>
//         <div>
//           <strong>What they want</strong>
//           <div style="font-size: 14px; color: #6b7280;">
//             Drivers & motivations
//           </div>
//         </div>
//       </div>

//       <div
//         style="
//           display: flex;
//           align-items: center;
//           gap: 12px;
//           padding: 10px;
//           background: white;
//           border-radius: 10px;
//         "
//       >
//         <span style="font-size: 20px;">🚧</span>
//         <div>
//           <strong>What they avoid</strong>
//           <div style="font-size: 14px; color: #6b7280;">
//             Barriers & concerns
//           </div>
//         </div>
//       </div>

//       <div
//         style="
//           display: flex;
//           align-items: center;
//           gap: 12px;
//           padding: 10px;
//           background: white;
//           border-radius: 10px;
//         "
//       >
//         <span style="font-size: 20px;">🥂</span>
//         <div>
//           <strong>Occasions</strong>
//           <div style="font-size: 14px; color: #6b7280;">
//             When they typically drink
//           </div>
//         </div>
//       </div>

//       <div
//         style="
//           display: flex;
//           align-items: center;
//           gap: 12px;
//           padding: 10px;
//           background: white;
//           border-radius: 10px;
//         "
//       >
//         <span style="font-size: 20px;">💎</span>
//         <div>
//           <strong>Price stance</strong>
//           <div style="font-size: 14px; color: #6b7280;">
//             Value-focused or premium-oriented
//           </div>
//         </div>
//       </div>
//     </div>
//   </div>

//   <div
//     style="
//       border-left: 4px solid #6338F6;
//       background: #faf7ff;
//       padding: 16px;
//       border-radius: 0 10px 10px 0;
//     "
//   >
//     <h3 style="margin-top: 0; color: #6338F6;">
//       Persona 1
//     </h3>

//     <p style="margin-bottom: 0;">
//       Describe the first type of customer you want to create.
//       You can use:
//     </p>

//     <ul style="margin-bottom: 0;">
//       <li>Plain language</li>
//       <li>Bullet points</li>
//       <li>Customer traits</li>
//       <li>Behaviors and preferences</li>
//     </ul>
//   </div>
// </div>`,
//     type: 'HTML'
//   },
//   /* 1 – user persona 1 input */
//   // {
//   //   role: "user",
//   //   content: `- low/zero sugar\n- clean ingredients\n- light refresh\n- believable functional benefit\n- avoid artificial taste and preservatives/additives\n- post-walk, mid-day reset, better than soda moments\n- will pay a bit more if it feels clean and credible`,
//   // },
//   /* 2 – AI summary persona 1 */
//   {
//     role: "assistant",
//     content: `Great. I'm summarizing this persona as:\n\n- **Drivers:** low/zero sugar, clean ingredients, light refresh, credible functional benefit\n- **Barriers:** artificial taste, preservatives/additives, over-hyped claims\n- **Occasions:** post-walk, mid-day reset, "better than soda" moments\n- **Price stance:** will pay a bit more if clean + credible\n\n**Suggested persona name:** Clean Label Hydrators (health-forward, sugar-avoidant, trust-sensitive)\n\nDo you want to adjust anything about this persona before we create the next one?`,
//     type: "TEXT"
//   },
//   /* 3 – user confirms */
//   // { role: "user", content: "No, next." },

//   /* 4 – AI asks for persona 2 */
//   { role: "assistant", content: "Describe the second type of customer.", type: "TEXT" },
//   /* 5 – user persona 2 input */
//   // {
//   //   role: "user",
//   //   content: `- new/limited flavors\n- fun taste\n- carbonation\n- shareable/impulse buys\n- avoid boring flavor and overly technical/functional vibe\n- social, on-the-go, trying new stuff\n- OK if it feels exciting; deal-sensitive sometimes`,
//   // },
//   /* 6 – AI summary persona 2 */
//   {
//     role: "assistant",
//     content: `Captured. Summary:\n\n- **Drivers:** novelty flavors, fun taste, carbonation, impulse/shareable\n- **Barriers:** boring flavor, overly technical/functional vibe\n- **Occasions:** social, on-the-go, discovery/trying new things\n- **Price stance:** pays if exciting; sometimes deal-sensitive\n\n**Suggested persona name:** Flavor & Fun Explorers (novelty-driven, variety-seeking)\n\nAny tweaks before we move on?`,
//     type: "TEXT"
//   },
//   /* 7 – user confirms */
//   // { role: "user", content: "No." },

//   /* 8 – AI asks for persona 3 */
//   { role: "assistant", content: "Describe the third type of customer.", type: "TEXT" },
//   /* 9 – user persona 3 input */
//   // {
//   //   role: "user",
//   //   content: `- obvious value\n- family format\n- predictable taste\n- promotions\n- avoid premium positioning without clear benefit; gimmicky functional claims\n- at-home, family consumption, routine stock-ups\n- price-first; prefers multipacks`,
//   // },
//   /* 10 – AI summary persona 3 */
//   {
//     role: "assistant",
//     content: `Captured. Summary:\n\n- **Drivers:** value, family format, predictable taste, promotions\n- **Barriers:** premium-without-benefit, gimmicky functional claims\n- **Occasions:** at-home, family, routine stock-ups\n- **Price stance:** price-first; multipacks preferred\n\n**Suggested persona name:** Value-First Routine Buyers (deal-driven, household stock-up mindset)\n\nAny changes?`,
//     type: "TEXT"
//   },
//   /* 11 – user confirms final */
//   // { role: "user", content: "No." },

//   /* 12 – AI persona recap + matching preview */
//   {
//     role: "assistant",
//     content: `Perfect — I've created 3 persona definitions and generated names based on their traits:\n1) Clean Label Hydrators\n2) Flavor & Fun Explorers\n3) Value-First Routine Buyers\n\nNext, I'll match these personas to respondents across your uploaded studies using hard + soft matching and generate the Persona Panel showing:\n- matched N per study\n- evidence coverage by category (Taste, Price/Value, Trust, Occasions, etc.)\n- confidence level and key differentiators\n\nProceeding to persona matching now.`,
//     type: "TEXT"
//   },

//   /* 13 – AI triggers processing */
//   {
//     role: "assistant",
//     content: `Perfect! I'll now start the persona creation process with these specifications. This will analyze your data against the trait definitions and build the personas. Let me proceed...`,
//     type: "TEXT",
//     createdAt: true
//   },
// ]