'use client';

import React from 'react';

export const ProductMock: React.FC = () => {
  return (
    <div className="mock">
      <div className="mock-side">
        <div className="mock-logo">dietai</div>
        <div className="mock-nav">
          <div className="mock-nav-item active"><span className="dot"></span>This week</div>
          <div className="mock-nav-item"><span className="dot"></span>Recipes</div>
          <div className="mock-nav-item"><span className="dot"></span>Grocery list</div>
          <div className="mock-nav-item"><span className="dot"></span>Pantry</div>
        </div>
        <div className="mock-nav-section">Profiles</div>
        <div className="mock-nav">
          <div className="mock-nav-item"><span className="dot" style={{ background: '#E07A5F' }}></span>High protein</div>
          <div className="mock-nav-item"><span className="dot" style={{ background: '#4A7C59' }}></span>Mediterranean</div>
          <div className="mock-nav-item"><span className="dot" style={{ background: '#D4A017' }}></span>Family</div>
        </div>
      </div>

      <div className="mock-main">
        <div className="mock-h">This week</div>
        <div className="mock-sub">Nov 3 – Nov 9 · 4 meals planned today</div>
        <div className="mock-week">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className={`mock-day ${i === 2 ? 'today' : ''}`}>
              <div className="mock-day-label">{d}</div>
              <div className="mock-day-num">{3 + i}</div>
              <div className="mock-day-pill"></div>
            </div>
          ))}
        </div>
        <div className="mock-meals">
          {[
            { time: "BREAKFAST", name: "Greek yogurt with berries & oats", k: "480 kcal", p: "32g protein", c: '#F8E9E1' },
            { time: "LUNCH", name: "Mediterranean grain bowl", k: "620 kcal", p: "38g protein", c: '#E6EDE6' },
            { time: "DINNER", name: "Herb-crusted salmon, roasted veg", k: "540 kcal", p: "42g protein", c: '#FBF1D4' }
          ].map((m, i) => (
            <div key={i} className="mock-meal">
              <div className="mock-meal-l">
                <div className="mock-meal-img" style={{ background: m.c }}></div>
                <div className="mock-meal-info">
                  <div className="mock-meal-time">{m.time}</div>
                  <div className="mock-meal-name">{m.name}</div>
                </div>
              </div>
              <div className="mock-meal-stats">
                <span><b>{m.k}</b></span>
                <span><b>{m.p}</b></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mock-aside">
        <div className="mock-card">
          <div className="mock-card-title">Today's nutrition</div>
          <div className="donut-wrap">
            <div className="donut">
              <span className="donut-num">68%</span>
            </div>
            <div className="donut-legend">
              <div><span className="swatch" style={{ background: '#C8633F' }}></span>Protein</div>
              <div><span className="swatch" style={{ background: '#4A7C59' }}></span>Fiber</div>
            </div>
          </div>
        </div>
        <div className="agent">
          <div className="agent-bot">ai</div>
          <div className="agent-text">
            <b>Shopping agent:</b> I found 4 missing items for your salmon dinner. Checkout at Whole Foods is <b>$12.40 cheaper</b> than Instacart today.
          </div>
        </div>
      </div>
    </div>
  );
};
