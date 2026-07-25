import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-primary text-white relative overflow-hidden">
      {/* Top Secondary Color Accent Bar */}
      <div className="h-1.5 w-full bg-secondary" />

      {/* Modern Background Shapes & Decorative Elements */}
      <div className="absolute top-0 right-10 w-72 h-72 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />

      {/* Angled Decorative Floating Panels */}
      <div className="absolute -right-12 -bottom-12 w-64 h-64 border border-white/10 rounded-3xl rotate-12 bg-white/[0.02] pointer-events-none hidden sm:block" />
      <div className="absolute right-32 -bottom-20 w-48 h-48 border border-white/10 rounded-2xl -rotate-6 bg-white/[0.03] pointer-events-none hidden sm:block" />

      {/* Subtle Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 pb-8 border-b border-white/15">
          
          {/* Brand Info & Frameless Logo */}
          <div className="flex flex-col items-center md:items-start gap-2 text-center md:text-left">
            <Link to="/" className="flex items-center gap-2.5 group">
              <GraduationCap className="h-7 w-7 text-accent transition-transform duration-300 group-hover:scale-110" />
              <span className="font-bold text-white text-xl tracking-tight">
                Iskolar<span className="text-accent">Match</span>
              </span>
            </Link>

            <p className="text-sm text-blue-100 max-w-md leading-relaxed">
              Connecting Filipino students with life-changing scholarship opportunities using smart vector matching.
            </p>
          </div>

          {/* Simple Clean Credits Text */}
          <div className="flex items-center gap-1.5 text-xs text-blue-100 font-medium">
            <span>Built with</span>
            <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
            <span>for Iskolar ng Bayan</span>
          </div>

        </div>

        {/* Bottom Copyright */}
        <div className="pt-6 text-center text-xs text-blue-200">
          © {new Date().getFullYear()} IskolarMatch. All rights reserved.
        </div>
      </div>
    </footer>
  );
}