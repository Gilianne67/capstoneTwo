import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  MessageSquare, 
  FileText, 
  CheckCircle2, 
  LifeBuoy,
  Loader2,
  AlertCircle
} from 'lucide-react';

export function HelpCenter() {
  const [faqs, setFaqs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  
  const [ticket, setTicket] = useState({ subject: '', category: 'General Inquiry', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketSent, setTicketSent] = useState(false);
  const [error, setError] = useState(null);

  // Fetch dynamic FAQs
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const response = await fetch('/api/support/faqs');
        if (response.ok) {
          const data = await response.json();
          setFaqs(data);
        }
      } catch (err) {
        console.error('Failed to load FAQs', err);
      }
    };

    fetchFaqs();
  }, []);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(ticket)
      });

      if (!response.ok) throw new Error('Failed to send support inquiry. Please try again.');

      setTicketSent(true);
      setTicket({ subject: '', category: 'General Inquiry', message: '' });
      setTimeout(() => setTicketSent(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFaqs = faqs.filter(item => 
    item.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Banner */}
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app-text">Student Help Center</h1>
            <p className="text-xs text-text-muted font-medium">
              Find instant answers to common platform questions or send a support message.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative pt-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search help topics, application guides, or alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold focus:outline-hidden focus:border-primary text-app-text"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* FAQs Accordion */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-extrabold text-app-text flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Frequently Asked Questions
          </h2>

          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 text-center text-xs text-text-muted">
                No articles matching your search query.
              </div>
            ) : (
              filteredFaqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div 
                    key={faq.id || idx}
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

        {/* Contact Support Form */}
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-app-text flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-primary" />
            Submit Support Inquiry
          </h2>

          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {ticketSent ? (
              <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Ticket submitted! A support member will email you shortly.</span>
              </div>
            ) : (
              <form onSubmit={handleTicketSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-app-text mb-1">Issue Category</label>
                  <select
                    value={ticket.category}
                    onChange={(e) => setTicket({ ...ticket, category: e.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold text-app-text focus:outline-hidden focus:border-primary cursor-pointer"
                  >
                    <option>General Inquiry</option>
                    <option>Deadline Alert Bug</option>
                    <option>Application Upload Issue</option>
                    <option>Account & Security</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-app-text mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="Brief description of the issue"
                    value={ticket.subject}
                    onChange={(e) => setTicket({ ...ticket, subject: e.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold focus:outline-hidden focus:border-primary text-app-text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-app-text mb-1">Message</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Detail what happened and steps to reproduce..."
                    value={ticket.message}
                    onChange={(e) => setTicket({ ...ticket, message: e.target.value })}
                    className="w-full px-3 py-2 bg-app-bg rounded-xl border border-app-text/10 text-xs font-medium text-app-text focus:outline-hidden focus:border-primary resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5" />
                  )}
                  <span>{isSubmitting ? 'Sending...' : 'Send Ticket'}</span>
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default HelpCenter;