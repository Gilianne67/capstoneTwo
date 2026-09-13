import React, { useState } from 'react';
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  Send, 
  FileCheck2, 
  CheckCircle2, 
  BookOpen, 
  ShieldAlert,
  Headphones
} from 'lucide-react';

const PROVIDER_FAQS = [
  {
    q: "How do I ensure my posted scholarship meets compliance standards?",
    a: "Listings require clear eligibility criteria (GPA thresholds, course majors, regional bounds), defined award amounts, and an official deadline date prior to submission for review."
  },
  {
    q: "How do I review and export applicant files?",
    a: "Navigate to your 'Applicants' portal. You can evaluate candidates inline, update statuses, and export shortlisted applicants to CSV or Excel formats."
  },
  {
    q: "Can I assign multiple team members to manage grant applications?",
    a: "Yes. You can request additional admin seats for your organization through your provider account manager or by submitting a ticket below."
  },
  {
    q: "What happens when a scholarship reaches its deadline?",
    a: "The listing automatically moves from 'Active' to 'Closed' state. You can still process existing applications and send bulk notification updates."
  }
];

export default function HelpSupport() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const [ticketSent, setTicketSent] = useState(false);
  const [ticket, setTicket] = useState({ subject: '', priority: 'Normal', message: '' });

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleTicketSubmit = (e) => {
    e.preventDefault();
    setTicketSent(true);
    setTicket({ subject: '', priority: 'Normal', message: '' });
    setTimeout(() => setTicketSent(false), 4000);
  };

  const filteredFaqs = PROVIDER_FAQS.filter(item => 
    item.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Banner */}
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app-text">Provider Help & Support</h1>
            <p className="text-xs text-text-muted font-medium">
              Resource center for listing grants, managing verification, and priority partner support.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative pt-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search provider guidelines, applicant tracking, or account setup..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold focus:outline-hidden focus:border-primary text-app-text"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Provider FAQ List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-extrabold text-app-text flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Grant Management Guides
          </h2>

          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 text-center text-xs text-text-muted">
                No provider articles found matching your query.
              </div>
            ) : (
              filteredFaqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div 
                    key={idx}
                    className="bg-card-bg rounded-2xl border border-app-text/10 overflow-hidden shadow-xs transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs font-bold text-app-text hover:bg-app-bg/50 transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 text-xs text-text-muted font-medium border-t border-app-text/5 pt-3 leading-relaxed">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Support Ticket Form */}
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-app-text flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            Partner Support Desk
          </h2>

          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-4">
            {ticketSent ? (
              <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Priority ticket logged! Our partner team will respond within 24 hours.</span>
              </div>
            ) : (
              <form onSubmit={handleTicketSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-app-text mb-1">Priority Level</label>
                  <select
                    value={ticket.priority}
                    onChange={(e) => setTicket({ ...ticket, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary cursor-pointer"
                  >
                    <option>Normal Inquiry</option>
                    <option>Urgent - Application Review issue</option>
                    <option>Listing Approval Status</option>
                    <option>Verification & Compliance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-app-text mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Request for additional team seat"
                    value={ticket.subject}
                    onChange={(e) => setTicket({ ...ticket, subject: e.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-app-text mb-1">Details</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe your inquiry or technical issue..."
                    value={ticket.message}
                    onChange={(e) => setTicket({ ...ticket, message: e.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-medium text-app-text focus:outline-hidden focus:border-primary resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Partner Ticket</span>
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}