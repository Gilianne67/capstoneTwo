import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function FeaturedScholarships() {
  const featuredScholarships = [
    {
      title: 'CHED Higher Education Grant',
      provider: 'Commission on Higher Education',
      amount: '₱60,000 / year',
      logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqw00nVALhDInyZPlqM2oXrwIiH6ffMqsNbRImhUsAQA&s=10',
      tags: ['GPA ≥ 2.0', 'Indigent Families', 'Undergraduate'],
    },
    {
      title: 'DOST-SEI Merit Scholarship',
      provider: 'Department of Science and Technology',
      amount: '₱40,000 / sem + Stipend',
      logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQOt0eEG9OC4jOKDBU5poGB4puvwHvlBTrZDDaOi_xzRw&s=10',
      tags: ['STEM Majors', 'Exam Qualified', 'Full Coverage'],
    },
    {
      title: 'SM Foundation College Scholarship',
      provider: 'SM Foundation',
      amount: '100% Tuition + Allowance',
      logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcREQDMBQHTsKLZtrYr9pFsUTtjhWBTIjbPjKtwqd3GHmGlQO5WNw1N7zD0b&s=10',
      tags: ['Partner Colleges', 'Public HS Graduate', 'Income Threshold'],
    },
  ];

  return (
    <section id="matches" className="py-20 bg-app-bg border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          
          <h2 className="text-3xl sm:text-4xl font-extrabold text-app-text tracking-tight">
            Featured Scholarships
          </h2>
          <p className="text-text-muted text-sm sm:text-base leading-relaxed">
            Explore verified grants and nationwide programs actively recruiting qualified Filipino applicants.
          </p>
        </div>

        {/* Scholarship Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuredScholarships.map((item, idx) => (
            <div
              key={idx}
              className="bg-card-bg rounded-3xl p-7 border border-slate-200/80 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Top Accent Line on Hover */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

              <div>
                {/* Header Layout: Logo on Left | Title & Provider on Right */}
                <div className="flex items-start gap-4 mb-5">
                  {/* Left: Official Logo */}
                  <div className="w-16 h-16 p-1 bg-white rounded-2xl border border-slate-100 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
                    <img
                      src={item.logoUrl}
                      alt={`${item.provider} logo`}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.classList.add('bg-primary/10', 'text-primary', 'font-bold', 'text-sm');
                        e.target.parentElement.innerText = item.provider.substring(0, 2).toUpperCase();
                      }}
                    />
                  </div>

                  {/* Right: Title & Provider */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-app-text text-lg leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-xs font-semibold text-text-muted mt-1 truncate">
                      {item.provider}
                    </p>
                  </div>
                </div>

                {/* Below: Grant Amount */}
                <div className="text-primary font-black text-2xl mb-4">
                  {item.amount}
                </div>

                {/* Below: Tags */}
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {item.tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="px-2.5 py-1 bg-app-bg text-text-muted font-medium border border-slate-200/90 rounded-lg text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button className="w-full py-3 text-sm font-bold text-primary hover:text-white bg-primary/10 hover:bg-primary rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group/btn">
                <span>View Requirements</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </button>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}