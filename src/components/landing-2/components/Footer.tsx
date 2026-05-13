import React from 'react';
import { BrandLogo } from '../../ui/icons/BrandLogo';

export const Footer: React.FC = () => {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-top">
          <div>
            <div className="brand">
              <BrandLogo size={32} />
              <span>dietai</span>
            </div>
            <p className="foot-blurb">
              Healthy eating, simplified — meal plans, recipes, and a grocery list that does itself.
            </p>
          </div>
          <div className="foot-col">
            <h4>Product</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#">Recipes</a></li>
              <li><a href="#">Changelog</a></li>
            </ul>
          </div>
          <div className="foot-col">
            <h4>Resources</h4>
            <ul>
              <li><a href="#">Journal</a></li>
              <li><a href="#">Nutrition guides</a></li>
              <li><a href="#">Help center</a></li>
              <li><a href="#">API</a></li>
            </ul>
          </div>
          <div className="foot-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Press</a></li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 DietAI Labs · Made for cooks who'd rather be cooking.</span>
          <span style={{ display: 'flex', gap: 24 }}>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </span>
        </div>
      </div>
    </footer>
  );
};
