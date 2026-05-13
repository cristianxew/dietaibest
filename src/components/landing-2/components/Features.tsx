import React from 'react';

export const Features: React.FC = () => {
  return (
    <section id="features" className="section">
      <div className="wrap">
        <div className="section-head">
          <div className="lhs">
            <div className="section-eyebrow">Built for real kitchens</div>
            <h2 className="section-title">Smart enough to know <em>your</em> Tuesday.</h2>
          </div>
          <div className="rhs">
            DietAI adapts to your week, your pantry, and your preferences — instead of handing you a generic plan and walking away.
          </div>
        </div>

        <div className="feature-row">
          <div className="f-text">
            <h3>Recipes that learn what you cook.</h3>
            <p>Rate a meal once and DietAI remembers — then quietly biases toward the flavors, cuisines, and prep times you actually keep up with.</p>
            <div className="f-list">
              <div className="f-list-item">12,000+ chef-tested recipes</div>
              <div className="f-list-item">Substitution-aware (allergies, pantry, season)</div>
              <div className="f-list-item">Save your own — paste a URL, we extract</div>
            </div>
          </div>
          <div className="f-visual"><div className="ph ph-warm">recipe library</div></div>
        </div>

        <div className="feature-row flip">
          <div className="f-visual"><div className="ph ph-sage">macro target rings</div></div>
          <div className="f-text">
            <h3>Macros without the math.</h3>
            <p>Set targets once. We balance the week — protein, fiber, micros — without making every meal feel like a chemistry exam.</p>
            <div className="f-list">
              <div className="f-list-item">Per-meal & weekly nutrition rollups</div>
              <div className="f-list-item">Protein-first, fiber-aware planning</div>
              <div className="f-list-item">Sync with Apple Health & Whoop</div>
            </div>
          </div>
        </div>

        <div className="feature-row">
          <div className="f-text">
            <h3>One grocery list, sent anywhere.</h3>
            <p>Pantry-aware, deduped, sorted by aisle. Send it to Instacart, AmazonFresh, or your printer — or let our shopping agent handle checkout.</p>
            <div className="f-list">
              <div className="f-list-item">Multi-store comparison & best price</div>
              <div className="f-list-item">AI shopping agent (beta)</div>
              <div className="f-list-item">Reusable templates for staples</div>
            </div>
          </div>
          <div className="f-visual"><div className="ph">grocery agent</div></div>
        </div>
      </div>
    </section>
  );
};
