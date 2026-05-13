'use client';

import React from 'react';
import Link from 'next/link';
import { ProductMock } from './ProductMock';

interface HeroProps {
  headlineStyle?: 'italic-accent' | 'all-serif' | 'default';
}

export const Hero: React.FC<HeroProps> = ({ headlineStyle = 'italic-accent' }) => {
  const headline = headlineStyle === 'italic-accent' ? (
    <h1>Healthy eating,<br /><em>simplified.</em></h1>
  ) : headlineStyle === 'all-serif' ? (
    <h1>Healthy eating,<br />simplified.</h1>
  ) : (
    <h1>Eat well<br />without the <em>guesswork</em>.</h1>
  );

  return (
    <header className="hero">
      <div className="hero-bg" aria-hidden="true">
        <span className="orb orb-1"></span>
        <span className="orb orb-2"></span>
        <span className="orb orb-3"></span>
        <span className="spark s1"></span>
        <span className="spark s2"></span>
        <span className="spark s3"></span>
        <span className="spark s4"></span>
      </div>
      <div className="wrap">
        <div className="eyebrow">Now in private beta</div>
        {headline}
        <p className="hero-sub">
          DietAI plans your meals around your nutrition goals, builds the recipes,
          and ships the grocery list — so eating well takes minutes a week, not hours.
        </p>
        <div className="hero-cta">
          <Link href="/sign-up" className="btn-primary">Start your meal plan →</Link>
          <a href="#how" className="btn-ghost">See it in action</a>
        </div>
        <div className="hero-meta">
          <div className="avatars">
            <span></span><span></span><span></span><span></span>
          </div>
          <span>Loved by 17,400+ home cooks &amp; nutritionists</span>
        </div>

        <div className="hero-product">
          <div className="product-frame">
            <div className="product-chrome">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="url">dietai.app / week of nov 3</span>
            </div>
            <ProductMock />
          </div>
        </div>
      </div>
    </header>
  );
};
