import React from 'react';

export const Pricing: React.FC = () => {
  const plans = [
    {
      name: "Taste",
      price: "0",
      period: "free, forever",
      tag: "Plan a single week, on us. No card, no expiry.",
      features: ["1 weekly meal plan", "200 starter recipes", "Basic grocery list"],
      cta: "Start free",
      featured: false
    },
    {
      name: "Kitchen",
      price: "12",
      period: "/ month",
      tag: "The full DietAI for one cook or one household.",
      features: ["Unlimited weekly plans", "12,000+ recipe library", "Pantry & macro intelligence", "Health app sync", "Send to Instacart"],
      cta: "Start 14-day trial",
      featured: true
    },
    {
      name: "Family",
      price: "22",
      period: "/ month",
      tag: "Multiple profiles, shared lists, kid-friendly mode.",
      features: ["Up to 5 profiles", "Shared grocery list", "Allergy-safe routing", "AI shopping agent", "Priority support"],
      cta: "Choose Family",
      featured: false
    }
  ];
  return (
    <section id="pricing" className="section">
      <div className="wrap">
        <div className="section-head">
          <div className="lhs">
            <div className="section-eyebrow">Pricing</div>
            <h2 className="section-title">Simple plans for <em>real</em> kitchens.</h2>
          </div>
          <div className="rhs">
            Try it free for a week. No card. Cancel any time — your saved recipes go with you.
          </div>
        </div>
        <div className="pricing-grid">
          {plans.map(p => (
            <div key={p.name} className={`price-card ${p.featured ? 'featured' : ''}`}>
              <div className="price-name">{p.name}</div>
              <div className="price-amount">
                ${p.price}
                <span className="price-amount-period">{p.period}</span>
              </div>
              <div className="price-tagline">{p.tag}</div>
              <div className="price-features">
                {p.features.map((f, i) => <div key={i} className="price-feature">{f}</div>)}
              </div>
              <button className="price-cta">{p.cta} →</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
