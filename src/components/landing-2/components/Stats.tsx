import React from 'react';

export const Stats: React.FC = () => {
  return (
    <section style={{ paddingTop: 0, paddingBottom: 0 }} className="section">
      <div className="wrap">
        <div className="stats">
          <div className="stat">
            <div className="stat-num">3.4 hrs</div>
            <div className="stat-label">Saved per week</div>
          </div>
          <div className="stat">
            <div className="stat-num">17,400+</div>
            <div className="stat-label">Active home cooks</div>
          </div>
          <div className="stat">
            <div className="stat-num">12k</div>
            <div className="stat-label">Tested recipes</div>
          </div>
          <div className="stat">
            <div className="stat-num">94%</div>
            <div className="stat-label">Stick to plan ≥4wk</div>
          </div>
        </div>
      </div>
    </section>
  );
};
