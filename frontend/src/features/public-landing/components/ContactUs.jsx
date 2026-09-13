import React, { useState } from 'react';
import { Mail, MapPin, Clock, Send, MessageSquareCheck } from 'lucide-react';

export default function ContactUs() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Logic for sending contact form
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-20 bg-app-bg border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          
          <h2 className="text-3xl sm:text-4xl font-extrabold text-app-text tracking-tight">
            We're Here to Help You Succeed
          </h2>
          <p className="text-text-muted text-sm sm:text-base leading-relaxed">
            Have a question about scholarship matching, account setup, or partnership opportunities? Reach out to our team.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Column: Clean Frameless Info (No Card Boxes) */}
          <div className="lg:col-span-5 space-y-8 py-2">
            
            {/* Info Item 1 */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl shrink-0">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-app-text">Email Support</h3>
                <p className="text-xs text-text-muted mt-0.5">Our team typically replies within 24 hours.</p>
                <a 
                  href="mailto:support@iskolarmatch.ph" 
                  className="text-sm font-semibold text-primary hover:underline mt-1.5 inline-block"
                >
                  support@iskolarmatch.ph
                </a>
              </div>
            </div>

            <hr className="border-slate-200/60" />

            {/* Info Item 2 */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl shrink-0">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-app-text">HQ & Regional Network</h3>
                <p className="text-xs text-text-muted mt-0.5">Connecting students across Luzon, Visayas, and Mindanao.</p>
                <p className="text-sm font-semibold text-app-text mt-1.5">
                  Manila & Bicol Tech Hubs, Philippines
                </p>
              </div>
            </div>

            <hr className="border-slate-200/60" />

            {/* Info Item 3 */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl shrink-0">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-app-text">Operating Hours</h3>
                <p className="text-xs text-text-muted mt-0.5">Automated matching active 24/7.</p>
                <p className="text-sm font-semibold text-app-text mt-1.5">
                  Monday – Friday: 8:00 AM – 6:00 PM PST
                </p>
              </div>
            </div>

          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7 bg-card-bg p-8 sm:p-10 rounded-3xl border border-slate-200/80 shadow-xl relative overflow-hidden">
            
            {/* Top Accent Gradient Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-blue-500 to-primary" />

            {submitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center mx-auto">
                  <MessageSquareCheck className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold text-app-text">Message Received!</h3>
                <p className="text-sm text-text-muted max-w-md mx-auto">
                  Thank you for reaching out. One of our support representatives will get back to your email shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-4 px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h3 className="text-xl font-extrabold text-app-text tracking-tight mb-2">
                  Send Us a Direct Message
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-app-text mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maria Santos"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary focus:outline-none bg-app-bg text-app-text font-medium transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-app-text mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. maria@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary focus:outline-none bg-app-bg text-app-text font-medium transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text mb-1.5">
                    Subject / Category
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary focus:outline-none bg-app-bg text-app-text font-medium transition-all"
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Student Support">Student Match Support</option>
                    <option value="Provider Partnership">Provider / Sponsor Partnership</option>
                    <option value="Technical Issue">Report an Issue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text mb-1.5">
                    Your Message
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Tell us how we can help you..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary focus:outline-none bg-app-bg text-app-text font-medium transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-primary hover:opacity-90 active:scale-[0.99] text-white py-3.5 px-6 rounded-xl text-sm font-extrabold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4 text-accent" />
                  Send Message
                </button>
              </form>
            )}

          </div>

        </div>

      </div>
    </section>
  );
}