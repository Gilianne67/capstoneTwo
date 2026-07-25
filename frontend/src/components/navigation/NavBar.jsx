import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ArrowRight } from 'lucide-react';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-card-bg/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm py-3'
          : 'bg-transparent border-b border-white/10 py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <GraduationCap className={`h-7 w-7 transition-transform duration-300 group-hover:scale-110 ${
            isScrolled ? 'text-primary' : 'text-accent'
          }`} />
          <span className={`font-bold text-xl tracking-tight transition-colors ${
            isScrolled ? 'text-app-text' : 'text-white'
          }`}>
            Iskolar<span className={isScrolled ? 'text-primary' : 'text-accent'}>Match</span>
          </span>
        </Link>

        {/* Navigation Links */}
        <div className={`hidden md:flex items-center gap-8 text-sm font-semibold transition-colors ${
          isScrolled ? 'text-app-text' : 'text-slate-200'
        }`}>
          <a href="#eligibility" className="hover:text-secondary transition-colors">
            Eligibility Checker
          </a>
          <a href="#matches" className="hover:text-secondary transition-colors">
            Featured Scholarships
          </a>
          <a href="#providers" className="hover:text-secondary transition-colors">
            For Providers
          </a>
          <a href="#faq" className="hover:text-secondary transition-colors">
            FAQ
          </a>
          <a href="#contact" className="hover:text-secondary transition-colors">
            Contact Us
          </a>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <button className={`px-4 py-2 text-sm font-semibold transition ${
            isScrolled ? 'text-app-text hover:text-primary' : 'text-slate-200 hover:text-white'
          }`}>
            Sign In
          </button>
          <a
            href="#eligibility"
            className="px-4 py-2 text-sm font-semibold text-white bg-primary hover:opacity-90 rounded-xl shadow-md transition flex items-center gap-1.5"
          >
            Get Started <ArrowRight className="h-4 w-4" />
          </a>
        </div>

      </div>
    </nav>
  );
}