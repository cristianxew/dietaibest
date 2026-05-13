import React from 'react';

export const FAQ: React.FC = () => {
  const items = [
    { q: "Do I need to log every meal?", a: "No. DietAI plans ahead so you don't have to log after. If you eat off-plan, one tap re-balances the rest of the week." },
    { q: "Can I use my own recipes?", a: "Yes. Paste any recipe URL and DietAI extracts ingredients, scales servings, and pulls macros from our nutrition database." },
    { q: "Is it really 'AI' or just a database?", a: "Both. Recipes are chef-tested; planning, substitution, and the shopping agent are model-driven. We're transparent about which is which inside the app." },
    { q: "How does the shopping agent work?", a: "It compares your list across Instacart, Amazon Fresh, and Whole Foods, picks the best basket on price + availability, and asks once before checkout." },
    { q: "What if I have allergies or restrictions?", a: "Set them once. Every recipe, swap, and substitution is filtered against them — including hidden ingredients and shared-equipment risk." }
  ];
  const [open, setOpen] = React.useState<number>(0);
  return (
    <section id="faq" className="section">
      <div className="wrap">
        <div className="section-head">
          <div className="lhs">
            <div className="section-eyebrow">FAQ</div>
            <h2 className="section-title">Questions, <em>answered</em>.</h2>
          </div>
        </div>
        <div className="faq-list">
          {items.map((it, i) => (
            <div key={i}
              className={`faq-item ${open === i ? 'open' : ''}`}
              onClick={() => setOpen(open === i ? -1 : i)}>
              <div className="faq-q">
                <span>{it.q}</span>
                <span className="icon"></span>
              </div>
              <div className="faq-a">{it.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
