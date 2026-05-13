'use client';

import React from 'react';
import './styles/landing.css';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Features } from './components/Features';
import { Stats } from './components/Stats';
import { Quote } from './components/Quote';
import { Pricing } from './components/Pricing';
import { FAQ } from './components/FAQ';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';

export default function Landing2() {
  return (
    <div className="landing-2-root">
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Stats />
        <Quote />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
