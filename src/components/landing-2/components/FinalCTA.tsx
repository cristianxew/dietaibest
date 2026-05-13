import React from 'react';
import Link from 'next/link';

export const FinalCTA: React.FC = () => {
  return (
    <section style={{ paddingTop: 0, paddingBottom: 0 }} className="section">
      <div className="wrap">
        <div className="final-cta">
          <h2>Eat better this week. <em>Cook less.</em></h2>
          <p>One plan. One list. Real recipes you actually want. Start free — your meal plan is ready in under two minutes.</p>
          <div className="cta-buttons">
            <Link href="/sign-up" className="btn-primary">Start your free plan →</Link>
            <a href="#how" className="btn-ghost">Watch the 90s tour</a>
          </div>
        </div>
      </div>
    </section>
  );
};
