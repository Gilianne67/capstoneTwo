import React, { useState } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';

export default function QuickEligibilityChecker() {
  const [gwa, setGwa] = useState('');
  const [incomeTier, setIncomeTier] = useState('');
  const [region, setRegion] = useState('');
  const [result, setResult] = useState(null);

  const handleCheck = (e) => {
    e.preventDefault();
    if (!gwa || !incomeTier) return;

    const parsedGwa = parseFloat(gwa);
    let estimatedMatches = 0;

    if (parsedGwa <= 1.75 || parsedGwa >= 88) {
      estimatedMatches += 12;
    } else if (parsedGwa <= 2.25 || parsedGwa >= 80) {
      estimatedMatches += 7;
    } else {
      estimatedMatches += 3;
    }

    if (incomeTier === 'low' || incomeTier === '4ps') {
      estimatedMatches += 5;
    }

    setResult({
      count: estimatedMatches,
      topCategory: parsedGwa <= 1.5 || parsedGwa >= 92 
        ? 'Academic Excellence & Merit' 
        : 'Financial Need & Regional Grants',
    });
  };

  return (
    /* Floating Wrapper: Negative top margin pulls it up over the Hero boundary */
    <div id="eligibility" className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 lg:-mt-24 mb-16">
      
      <div className="relative bg-card-bg p-6 sm:p-10 rounded-3xl shadow-2xl border border-slate-200/80 backdrop-blur-md overflow-hidden">
        
        {/* Top Accent Gradient Border */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-blue-500 to-primary" />

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100 flex-wrap pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5 text-primary font-bold text-xs uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
             
              <span>Instant Matching Simulator</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-app-text tracking-tight">
              Check Your Eligibility in 15 Seconds
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-text-muted max-w-md leading-relaxed">
            Enter your academic details below to get an instant estimate of active matching scholarships across the Philippines.
          </p>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleCheck} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-app-text mb-1.5">
              GWA / SHS Grade
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 1.75 or 92"
              required
              value={gwa}
              onChange={(e) => setGwa(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary focus:outline-none bg-app-bg text-app-text font-medium transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text mb-1.5">
              Annual Household Income
            </label>
            <select
              value={incomeTier}
              onChange={(e) => setIncomeTier(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary focus:outline-none bg-app-bg text-app-text font-medium transition-all"
            >
              <option value="">Select Tier...</option>
              <option value="4ps">4Ps Beneficiary / Below ₱130k</option>
              <option value="low">Low Income (₱130k - ₱250k)</option>
              <option value="middle">Lower Middle (₱250k - ₱400k)</option>
              <option value="above">Above ₱400k</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text mb-1.5">
              Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary focus:outline-none bg-app-bg text-app-text font-medium transition-all"
            >
              <option value="">Select Region...</option>
              <option value="NCR">NCR (National Capital Region)</option>
              <option value="Region V">Region V (Bicol)</option>
              <option value="Region IV-A">Region IV-A (CALABARZON)</option>
              <option value="Other">Other Region</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              className="w-full bg-primary hover:opacity-90 active:scale-[0.98] text-white py-2.5 px-4 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg h-[42px]"
            >
              Find Matches Now
            </button>
          </div>
        </form>

        {/* Result Display */}
        {result && (
          <div className="mt-6 p-5 bg-secondary/10 border border-secondary/30 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/20 text-secondary rounded-xl">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-secondary">{result.count}+</span>
                  <p className="text-sm font-bold text-app-text">Scholarships Matched to Your Profile</p>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Top eligible category: <strong className="underline decoration-2 text-app-text">{result.topCategory}</strong>
                </p>
              </div>
            </div>
            <p className="text-xs text-text-muted bg-card-bg px-3.5 py-2 rounded-xl border border-slate-200 font-semibold shadow-xs">
              Sign up to execute full grade normalization and apply directly.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}