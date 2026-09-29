import { useMemo, useState } from 'react';
import {
  Search,
  ChevronDown,
  BookOpen,
  Headphones
} from 'lucide-react';

const PROVIDER_FAQS = [
  {
    id: 'create-listing',
    q: 'How do I create a scholarship listing?',
    a: 'Providers can create a listing that contains scholarship information, benefits, a deadline, eligibility requirements, geographic eligibility, and ranking preferences.'
  },
  {
    id: 'deadline',
    q: 'What happens when my scholarship reaches its deadline?',
    a: 'Scholarships past their deadline are automatically treated as closed and are excluded from active matching and search results.'
  },
  {
    id: 'matching',
    q: 'How does scholarship matching work?',
    a: 'Students must first pass the applicable hard eligibility requirements. Eligible scholarships are then ranked using academic performance, income, and preferred eligibility tags according to the scholarship’s configured ranking weights.'
  },
  {
    id: 'eligibility-tags',
    q: 'What are Required and Preferred eligibility tags?',
    a: 'Required means the student must satisfy the criterion. Preferred means the criterion contributes to ranking but does not automatically exclude the student.'
  },
  {
    id: 'request-criterion',
    q: 'What if I need an eligibility criterion that is not available?',
    a: 'Providers can use Request New Criterion in the scholarship listing form. The request is submitted for administrator review and is not used by the matching engine until it is officially implemented.'
  },
  {
    id: 'verification',
    q: 'How does provider verification work?',
    a: 'Provider verification status is managed by the administrator and displayed on the Organization Verification page. Providers cannot change their own verification status.'
  }
];

export default function HelpSupport() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState(null);

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return PROVIDER_FAQS;

    return PROVIDER_FAQS.filter((item) =>
      item.q.toLowerCase().includes(query) ||
      item.a.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const toggleFaq = (id) => {
    setOpenFaqId((current) => (current === id ? null : id));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Headphones className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app-text">Provider Help & Support</h1>
            <p className="text-xs text-text-muted font-medium">
              Resource center for scholarship listings, eligibility, matching, and verification.
            </p>
          </div>
        </div>

        <div className="relative pt-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 text-text-muted" />
          <input
            type="search"
            placeholder="Search scholarship listing, matching, eligibility, or verification guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search help articles"
            className="w-full pl-10 pr-4 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold focus:outline-hidden focus:border-primary text-app-text"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-extrabold text-app-text flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Grant Management Guides
        </h2>

        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 text-center text-xs text-text-muted">
              No articles matching your search query.
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="bg-card-bg rounded-2xl border border-app-text/10 overflow-hidden shadow-xs transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(faq.id)}
                    aria-expanded={isOpen}
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
    </div>
  );
}
