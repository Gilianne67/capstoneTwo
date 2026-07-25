import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import heroBgPhoto from '../../../assets/hero-bg-photo.jpg';

export default function HeroSection({ onNavigate }) {
  return (
    <section className="relative w-full min-h-[720px] lg:min-h-[900px] flex items-center justify-center pt-28 pb-32 px-4 overflow-hidden">
      
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroBgPhoto}
          alt="Students on campus"
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* Overlay using brand palette tokens */}
      <div className="absolute inset-0 z-10 bg-gradient-to-br from-primary/55 via-primary/65 to-slate-600/50" />


      {/* Floating Geometric Accents */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-30 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full border border-white/20 bg-white/5 backdrop-blur-3xl" />
        <div className="absolute bottom-28 right-[12%] w-20 h-20 rounded-full border-2 border-white/60 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border border-white/40" />
        </div>
        <div className="absolute top-44 right-[15%] w-10 h-10 border-2 border-white/80 rotate-45" />
        <div className="absolute top-1/3 left-[8%] w-12 h-12 border-2 border-white/70 rotate-12 bg-white/5" />
        
      </div>

      {/* Main Content Container */}
      <div className="relative z-20 max-w-7xl mx-auto w-full px-4 sm:px-6">
        <div className="max-w-2xl text-white space-y-8">
          
        
          {/* Headlines & Copy */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
              Find Scholarships That{' '}
              {/* SINGLE ACCENT COLOR SHIMMER ANIMATION */}
              <span className="inline-block bg-[linear-gradient(110deg,#f59e0b_0%,#fde68a_45%,#f59e0b_90%)] bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer filter drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]">
                Match You.
              </span>
            </h1>

            <p className="text-base sm:text-xl text-blue-50/90 max-w-xl font-normal leading-relaxed">
              Stop searching through hundreds of dead-end listings. IskolarMatch uses vector matching to rank opportunities based on your GPA, income bracket, and background.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <a
              href="#eligibility"
              onClick={() => onNavigate && onNavigate('eligibility')}
              className="relative group overflow-hidden rounded-xl p-[2px] font-extrabold text-sm uppercase tracking-wider shadow-xl active:scale-95 transition-transform"
            >
              <span className="absolute inset-0 bg-[linear-gradient(90deg,#f59e0b,#fde68a,#f59e0b)] bg-[length:200%_100%] animate-shimmer" />
            <span className="relative flex items-center gap-2 bg-card-bg text-primary group-hover:bg-transparent group-hover:text-white px-8 py-3.5 rounded-[10px] transition-colors duration-300">                Get Started <ArrowRight className="h-4 w-4" />
              </span>
            </a>

            <a
              href="#faq"
              onClick={() => onNavigate && onNavigate('faq')}
              className="border-2 border-white/80 text-white hover:bg-white/10 px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider transition-all backdrop-blur-xs flex items-center justify-center"
            >
              Learn How It Works
            </a>
          </div>

          {/* Micro Metrics Footer */}
          <div className="pt-8 border-t border-white/20 flex flex-wrap items-center gap-6 sm:gap-8 text-xs text-blue-100/80">
            
            {/* Metric 1 */}
            <div className="backdrop-blur-md px-3 py-1.5">
              <span className="block text-2xl font-black text-accent">200+</span>
              <span className="text-white/90 font-medium">Verified Grants</span>
            </div>
            
            <div className="h-8 w-px bg-white/20" />
            
            {/* Metric 2 */}
            <div className="backdrop-blur-md px-3 py-1.5">
              <span className="block text-2xl font-black text-accent">100%</span>
              <span className="text-white/90 font-medium">Free for Students</span>
            </div>
            
            <div className="h-8 w-px bg-white/20" />
            
            {/* Metric 3 */}
            <div className="backdrop-blur-md px-3 py-1.5">
              <span className="block text-2xl font-black text-accent">15 Sec</span>
              <span className="text-white/90 font-medium">Match Speed</span>
            </div>

          </div>

        </div>
      </div>

    </section>
  );
}