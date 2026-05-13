import React from 'react';

export const HowItWorks: React.FC = () => {
  const steps = [
    { n: "01", t: "Tell us your goals", b: "Macros, allergies, schedule, the foods you actually like. We learn the taste behind your targets, not just the numbers." },
    { n: "02", t: "Get a real plan", b: "A week of recipes built around what you have, what's in season, and what fits your day. Edit anything, lock favorites." },
    { n: "03", t: "Skip the chore", b: "One grocery list, organized by aisle and pantry-aware. Send it to checkout — or hand it to your shopping agent." }
  ];
  return (
    <section id="how" className="section">
      <div className="wrap">
        <div className="section-head">
          <div className="lhs">
            <div className="section-eyebrow">How it works</div>
            <h2 className="section-title">From goals to groceries in <em>three steps</em>.</h2>
          </div>
          <div className="rhs">
            We replaced the spreadsheet, the recipe tabs, and the "what's for dinner?" — with one thoughtful planner.
          </div>
        </div>
        <div className="steps">
          {steps.map(s => (
            <div key={s.n} className="step">
              <div className="step-num">{s.n}</div>
              <div className="step-title">{s.t}</div>
              <div className="step-body">{s.b}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
