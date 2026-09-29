import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  ChevronDown,
  FileText,
  User,
  Award,
  Bookmark,
  Bell
} from 'lucide-react';

const ROUTES = {
  profile: '/dashboard/student/profile',
  matches: '/dashboard/student/matches',
  search: '/dashboard/student/search',
  saved: '/dashboard/student/saved',
  alerts: '/dashboard/student/notifications'
};

const FAQ_CATEGORIES = [
  'Scholarship Matching',
  'Finding Scholarships',
  'Saved Scholarships',
  'Student Profile'
];

const FAQ_ITEMS = [
  {
    id: 'match-score',
    category: 'Scholarship Matching',
    q: 'How does IskolarMatch calculate my match score?',
    a: 'IskolarMatch first checks whether you meet a scholarship’s hard requirements, such as academic level, course, location, citizenship, GWA, and exclusive eligibility tags. Scholarships that pass those filters receive a match score based on your GWA, household income bracket, and special eligibility flags. Scores of 90 or higher are labeled Highly Recommended.',
    links: [{ label: 'Open Matched Feed', to: ROUTES.matches }]
  },
  {
    id: 'no-matches',
    category: 'Scholarship Matching',
    q: 'Why am I not seeing scholarship matches?',
    a: 'Matches appear only after you have a student profile and only for open scholarships that fit your academic, location, GWA, citizenship, and eligibility details. Incomplete profile information, a GWA below a listing’s requirement, a different region or course, or closed or expired scholarships can hide results.',
    links: [
      { label: 'Complete Student Profile', to: ROUTES.profile },
      { label: 'View Matched Feed', to: ROUTES.matches }
    ]
  },
  {
    id: 'improve-matches',
    category: 'Scholarship Matching',
    q: 'How can I improve my scholarship matches?',
    a: 'Keep your student profile current. Accurate course, year level, GWA, GWA scale, income bracket, region, and special eligibility flags help the matcher include the right scholarships and score them more fairly. Review the Matched Feed after you save profile changes.',
    links: [
      { label: 'Update Student Profile', to: ROUTES.profile },
      { label: 'Open Matched Feed', to: ROUTES.matches }
    ]
  },
  {
    id: 'matching-fields',
    category: 'Scholarship Matching',
    q: 'What information is used for matching?',
    a: 'Matching uses the details in your Student Profile: academic level, year level, course, GWA, GWA scale, school, school type, income bracket, region, province, municipality/city, citizenship, and special eligibility flags. IskolarMatch does not use a separate Settings page for this information.',
    links: [{ label: 'Go to Student Profile', to: ROUTES.profile }]
  },
  {
    id: 'search-scholarships',
    category: 'Finding Scholarships',
    q: 'How do I search for scholarships?',
    a: 'Open Scholarship Search to browse listings and filter by the details that matter to you. You can also start from the Matched Feed, which ranks scholarships that already fit your profile.',
    links: [
      { label: 'Open Scholarship Search', to: ROUTES.search },
      { label: 'Open Matched Feed', to: ROUTES.matches }
    ]
  },
  {
    id: 'highly-recommended',
    category: 'Finding Scholarships',
    q: 'What does “Highly Recommended” mean?',
    a: 'Highly Recommended means a scholarship passed the eligibility filters and received a match score of 90 or higher. Recommended is 70 or higher, Potential Match is 50 or higher, and lower scores are labeled Low Compatibility.',
    links: [{ label: 'See your matches', to: ROUTES.matches }]
  },
  {
    id: 'view-details',
    category: 'Finding Scholarships',
    q: 'How do I view scholarship details?',
    a: 'Open a scholarship from the Matched Feed, Scholarship Search, Saved Scholarships, or Deadline Alerts. The details page shows eligibility, deadlines, and provider information before you apply on the official portal.',
    links: [
      { label: 'Browse Scholarship Search', to: ROUTES.search },
      { label: 'Open Matched Feed', to: ROUTES.matches }
    ]
  },
  {
    id: 'how-to-apply',
    category: 'Finding Scholarships',
    q: 'How do I apply for a scholarship?',
    a: 'IskolarMatch does not collect application forms. Use Apply on a listing to open the provider’s official application portal. Review the scholarship details first so you know the requirements, deadline, and documents to prepare.',
    links: [{ label: 'Find scholarships to apply for', to: ROUTES.search }]
  },
  {
    id: 'save-scholarship',
    category: 'Saved Scholarships',
    q: 'How do I save a scholarship?',
    a: 'Use the bookmark or save action on a scholarship in Search, the Matched Feed, or the details page. Saving a listing stores it in your account so you can track it later and receive deadline reminders.',
    links: [
      { label: 'Browse scholarships', to: ROUTES.search },
      { label: 'View saved scholarships', to: ROUTES.saved }
    ]
  },
  {
    id: 'find-saved',
    category: 'Saved Scholarships',
    q: 'Where can I find my saved scholarships?',
    a: 'Open Saved Scholarships from the student menu. That page lists every scholarship you bookmarked so you can review deadlines, eligibility, and apply on the provider’s official site.',
    links: [{ label: 'Go to Saved Scholarships', to: ROUTES.saved }]
  },
  {
    id: 'deadline-alerts',
    category: 'Saved Scholarships',
    q: 'How do deadline alerts work?',
    a: 'When you save a scholarship with a deadline, IskolarMatch can create deadline reminders as the due date approaches, including 7-day, 3-day, and 24-hour windows. Open Deadline Alerts to review those reminders and jump back to the listing.',
    links: [
      { label: 'Open Deadline Alerts', to: ROUTES.alerts },
      { label: 'Review saved scholarships', to: ROUTES.saved }
    ]
  },
  {
    id: 'why-complete-profile',
    category: 'Student Profile',
    q: 'Why should I complete my student profile?',
    a: 'Your Student Profile is the source of truth for matching. Without it, the platform cannot compare you with scholarship requirements. Completing academic, location, income, and eligibility details unlocks the Matched Feed and more accurate scores.',
    links: [{ label: 'Complete your Student Profile', to: ROUTES.profile }]
  },
  {
    id: 'update-matching-info',
    category: 'Student Profile',
    q: 'How do I update my matching information?',
    a: 'Edit and save your details on the Student Profile page. Changes to course, year level, GWA, region, income, and special eligibility are used the next time matches are generated. There is no separate student Settings page for this information.',
    links: [{ label: 'Update Student Profile', to: ROUTES.profile }]
  },
  {
    id: 'what-to-provide',
    category: 'Student Profile',
    q: 'What information should I provide?',
    a: 'Provide academic level, year level, course, GWA, GWA scale, school, school type, income bracket, region, province, municipality/city, citizenship, and any special eligibility that applies to you. Accurate values help the matcher include the right scholarships and exclude ones you cannot qualify for.',
    links: [{ label: 'Open Student Profile', to: ROUTES.profile }]
  }
];

const QUICK_LINKS = [
  { label: 'Student Profile', to: ROUTES.profile, icon: User, hint: 'Update matching information' },
  { label: 'Matched Feed', to: ROUTES.matches, icon: Award, hint: 'See ranked scholarship matches' },
  { label: 'Scholarship Search', to: ROUTES.search, icon: Search, hint: 'Browse and filter listings' },
  { label: 'Saved Scholarships', to: ROUTES.saved, icon: Bookmark, hint: 'Review bookmarked grants' },
  { label: 'Deadline Alerts', to: ROUTES.alerts, icon: Bell, hint: 'Track upcoming due dates' }
];

const matchesQuery = (faq, query) => {
  if (!query) return true;

  return [faq.q, faq.a, faq.category].some((value) =>
    value.toLowerCase().includes(query)
  );
};

export function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  const query = searchQuery.trim().toLowerCase();

  const groupedFaqs = useMemo(() => {
    return FAQ_CATEGORIES.map((category) => ({
      category,
      items: FAQ_ITEMS.filter((faq) => faq.category === category && matchesQuery(faq, query))
    })).filter((group) => group.items.length > 0);
  }, [query]);

  const hasMatches = groupedFaqs.length > 0;

  const toggleFaq = (id) => {
    setOpenFaq((current) => (current === id ? null : id));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-app-text">Student Help Center</h1>
            <p className="text-xs text-text-muted font-medium">
              Find instant answers about matching, scholarships, saved listings, and your student profile.
            </p>
          </div>
        </div>

        <div className="relative pt-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search help topics, matching, or profile questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-app-bg rounded-xl border border-app-text/10 text-xs font-semibold focus:outline-hidden focus:border-primary text-app-text"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-extrabold text-app-text flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Frequently Asked Questions
          </h2>

          {!hasMatches ? (
            <div className="bg-card-bg rounded-2xl border border-app-text/10 p-6 text-center text-xs text-text-muted">
              No help articles matching your search.
            </div>
          ) : (
            groupedFaqs.map((group) => (
              <div key={group.category} className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-primary pt-1">
                  {group.category}
                </h3>

                {group.items.map((faq) => {
                  const isOpen = openFaq === faq.id;

                  return (
                    <div
                      key={faq.id}
                      className="bg-card-bg rounded-2xl border border-app-text/10 overflow-hidden shadow-xs transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => toggleFaq(faq.id)}
                        className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs font-bold text-app-text hover:bg-app-bg/50 transition-colors cursor-pointer"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 text-xs text-text-muted font-medium border-t border-app-text/5 pt-3 leading-relaxed space-y-3">
                          <p>{faq.a}</p>
                          {faq.links?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {faq.links.map((link) => (
                                <Link
                                  key={`${faq.id}-${link.to}-${link.label}`}
                                  to={link.to}
                                  className="inline-flex items-center px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-colors"
                                >
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-app-text flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-primary" />
            Quick Links
          </h2>

          <div className="bg-card-bg rounded-2xl border border-app-text/10 p-5 shadow-xs space-y-3">
            {QUICK_LINKS.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 p-3 bg-app-bg rounded-xl border border-app-text/10 hover:border-primary/30 transition-colors"
                >
                  <span className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <span>
                    <span className="block text-xs font-bold text-app-text">{item.label}</span>
                    <span className="block text-[11px] text-text-muted">{item.hint}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpCenter;
