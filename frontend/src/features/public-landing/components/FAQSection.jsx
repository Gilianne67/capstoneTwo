import React, { useState } from 'react';
import { HelpCircle, ChevronDown, GraduationCap, Building2 } from 'lucide-react';

export default function FAQSection() {
  const [activeTab, setActiveTab] = useState('students');
  const [openIndex, setOpenIndex] = useState(0);

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const studentFaqs = [
    {
      question: 'Is IskolarMatch completely free for students?',
      answer: 'Yes! Creating an account, viewing your matched scholarships, and getting application links is 100% free for all students.',
    },
    {
      question: 'How does the scholarship matching system work?',
      answer: 'When you create your profile (grades, location, field of study, and household income), our algorithm uses transparent mathematical weighted scoring to calculate match percentage scores and rank scholarships you qualify for.',
    },
    {
      question: 'Do I submit my application directly on IskolarMatch?',
      answer: 'No, IskolarMatch is a discovery and directory portal. Once you find a matched scholarship, we provide direct links, submission guidelines, and clear details on where and how to submit your official application to the provider.',
    },
    {
      question: 'Can I view scholarships without creating an account?',
      answer: 'You can browse featured listings, but creating a free account allows our weighted scoring system to automatically evaluate your specific qualifications and rank grants tailored to your profile.',
    },
  ];

  const providerFaqs = [
    {
      question: 'How do scholarship providers publish their grants?',
      answer: 'Providers simply register an account, fill out their scholarship details and eligibility requirements (such as minimum GWA, target location, or income bracket), and publish their listing on our platform.',
    },
    {
      question: 'How do students apply to our scholarships?',
      answer: 'When posting a grant, you provide your official application portal URL, email submission details, or physical office address. IskolarMatch directs qualified, pre-matched students straight to your destination.',
    },
    {
      question: 'Do providers review or process student applications inside IskolarMatch?',
      answer: 'No. IskolarMatch operates purely as a discovery and matching directory. Application processing remains entirely on your own website, portal, or physical office workflow.',
    },
    {
      question: 'Is there support available for setting up our organization’s listing?',
      answer: 'Yes! Our team is available to assist you in creating, updating, and formatting your scholarship listings anytime.',
    },
  ];

  const currentFaqs = activeTab === 'students' ? studentFaqs : providerFaqs;

  return (
    <section id="faq" className="py-20 bg-app-bg border-t border-slate-200/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-app-text tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-text-muted text-sm sm:text-base leading-relaxed">
            Got questions? Here is everything you need to know about using IskolarMatch.
          </p>
        </div>

        {/* Audience Toggle Buttons */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex p-1.5 bg-slate-200/60 rounded-2xl border border-slate-300/50">
            <button
              onClick={() => {
                setActiveTab('students');
                setOpenIndex(0);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'students'
                  ? 'bg-card-bg text-primary shadow-sm'
                  : 'text-text-muted hover:text-app-text'
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              For Students
            </button>
            <button
              onClick={() => {
                setActiveTab('providers');
                setOpenIndex(0);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'providers'
                  ? 'bg-card-bg text-primary shadow-sm'
                  : 'text-text-muted hover:text-app-text'
              }`}
            >
              <Building2 className="h-4 w-4" />
              For Providers
            </button>
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4">
          {currentFaqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="bg-card-bg border border-slate-200/80 rounded-2xl overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggleAccordion(index)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 font-bold text-app-text text-base hover:text-primary transition-colors focus:outline-none"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-text-muted transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-primary' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-text-muted text-sm leading-relaxed border-t border-slate-100">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}