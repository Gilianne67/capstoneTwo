import React from 'react';
import { CheckCircle2, LayoutDashboard, ArrowRight, Building2 } from 'lucide-react';

export default function ProviderCTA({ onNavigate }) {
  return (
    <section id="providers" className="py-20 px-4 bg-primary relative overflow-hidden text-white">
      
      {/* Background Geometric Pattern Accent */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full border border-white/10 bg-white/5 backdrop-blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Column: Offer Details */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
            <Building2 className="h-4 w-4 text-accent" />
            Partner With Us
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            For Scholarship Providers
          </h2>

          <p className="text-blue-100/90 text-base max-w-xl leading-relaxed">
            Join our platform and connect with thousands of qualified and deserving Filipino students nationwide.
          </p>

          <ul className="space-y-3 text-sm text-blue-50/90 pt-2">
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
              <span>Post and manage your scholarship programs seamlessly</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
              <span>Automated matching with qualified students via vector algorithms</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
              <span>Custom dynamic weighting (GWA, income, location, degree)</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
              <span>Streamlined applicant review and verification dashboard</span>
            </li>
          </ul>

          <div className="pt-4">
            <button
              onClick={() => onNavigate && onNavigate('signup')}
              className="bg-accent hover:bg-amber-500 text-slate-950 font-extrabold text-sm px-8 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-2 group"
            >
              Register as Provider 
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        {/* Right Column: Dashboard Card Preview */}
        <div className="lg:col-span-5 bg-card-bg p-8 sm:p-10 rounded-3xl border border-slate-200/20 shadow-2xl text-center relative overflow-hidden group">
          
          {/* Top Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-accent via-amber-300 to-accent" />

          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110">
            <LayoutDashboard className="h-8 w-8 text-primary" />
          </div>

          <h3 className="font-extrabold text-app-text text-lg tracking-tight">
            PROVIDER DASHBOARD PREVIEW
          </h3>

          <p className="mt-2 text-xs sm:text-sm text-text-muted leading-relaxed max-w-xs mx-auto">
            Manage applications, configure custom criteria, and view applicant analytics in real-time.
          </p>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs font-semibold text-primary">
            <span>Enterprise-Grade Verification</span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          </div>
        </div>

      </div>
    </section>
  );
}