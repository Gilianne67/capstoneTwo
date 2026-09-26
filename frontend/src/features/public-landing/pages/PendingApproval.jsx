import React from 'react';
import { Link } from 'react-router-dom';
import { 
  GraduationCap, 
  Clock, 
  ShieldCheck, 
  MailCheck, 
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';

const PendingApproval = () => {
  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col justify-between relative overflow-hidden pt-20">
      {/* Provider Theme Accent Bar */}
      <div className="h-1.5 w-full bg-emerald-900" />

      {/* Main Container */}
      <div className="max-w-5xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 flex items-center justify-center relative z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch bg-card-bg border border-app-text/10 rounded-3xl shadow-2xl overflow-hidden">
          
          {/* Left Hero Panel */}
          <div className="lg:col-span-5 bg-emerald-900 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden transition-colors duration-500">
            <div className="absolute -right-10 -bottom-10 w-64 h-64 border border-white/10 rounded-3xl rotate-12 bg-white/[0.04] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <Link to="/" className="inline-flex items-center gap-2.5 group">
                <GraduationCap className="h-8 w-8 text-accent transition-transform duration-300 group-hover:scale-110" />
                <span className="font-extrabold text-2xl tracking-tight text-white">
                  ISKOLAR<span className="text-accent">MATCH</span>
                </span>
              </Link>

              <div className="space-y-3 pt-4">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                  Verification in Progress
                </h2>
                <p className="text-white/80 text-xs sm:text-sm leading-relaxed">
                  We are reviewing your institutional documents to safeguard students and ensure authentic scholarship opportunities on our platform.
                </p>
              </div>
            </div>

            {/* Features / Next Steps */}
            <div className="relative z-10 space-y-3.5 my-8">
              {[
                'Document authenticity check',
                'Regulatory & tax record validation',
                'Notification sent upon completion'
              ].map((step, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs sm:text-sm text-white/90 font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <div className="relative z-10 pt-6 border-t border-white/15 text-xs text-white/70">
              Supporting Iskolar ng Bayan
            </div>
          </div>

          {/* Right Status Panel */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full text-center space-y-6">
              
              {/* Status Badge Icon */}
              <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-amber-600 shadow-lg shadow-amber-500/5">
                <Clock className="h-8 w-8 animate-pulse" />
              </div>

              {/* Title & Body Description */}
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-app-text">
                  Verification Under Review
                </h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                  Your organization profile and verification documents have been submitted successfully. Our administrative team is currently processing your application.
                </p>
              </div>

              {/* Info Card Banner */}
              <div className="p-4 bg-app-bg border border-app-text/10 rounded-2xl text-left space-y-3">
                <div className="flex items-start gap-3">
                  <MailCheck className="h-5 w-5 text-emerald-800 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-app-text">What happens next?</p>
                    <p className="text-text-muted leading-relaxed">
                      Approval typically takes <span className="font-semibold text-app-text">1–2 business days</span>. You will receive an official notification via email once your account is activated.
                    </p>
                  </div>
                </div>
              </div>

              {/* Back to Home Button */}
              <div className="pt-2">
                <Link
                  to="/"
                  className="w-full py-3.5 px-6 rounded-xl bg-app-bg border border-app-text/10 hover:border-emerald-800 text-app-text font-bold text-xs shadow-sm transition-all inline-flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Return to Home</span>
                </Link>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-xs text-text-muted border-t border-app-text/10 relative z-10">
        © {new Date().getFullYear()} IskolarMatch. All rights reserved.
      </div>
    </div>
  );
};

export default PendingApproval;