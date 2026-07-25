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
      question: 'Is IskolarMatch completely free to use for students?',
      answer: 'Yes! Creating an account, matching with scholarships, and submitting applications through IskolarMatch is 100% free for all students.',
    },
    {
      question: 'How does IskolarMatch find scholarships for me?',
      answer: 'When you set up your profile with details like your location, course, grades, and household income, our system automatically compares your details with active scholarship requirements to show you your best matches.',
    },
    {
      question: 'Can I apply for more than one scholarship at the same time?',
      answer: 'Yes, you can apply to multiple scholarships! However, make sure to read each provider’s rules, as some scholarships do not allow you to hold two major grants simultaneously.',
    },
    {
      question: 'What documents do I usually need to get ready?',
      answer: 'Most scholarships ask for basic documents like your Grade Slip or Report Card (Form 137/138), Certificate of Indigency or Income Tax Return (ITR), and a valid ID or Student ID.',
    },
  ];

  const providerFaqs = [
    {
      question: 'How do we list our scholarship program on the platform?',
      answer: 'You can create a Provider account, set your scholarship criteria (such as minimum GPA, course, or location), and publish your listing once verified by our team.',
    },
    {
      question: 'How does IskolarMatch help us find qualified applicants?',
      answer: 'Instead of receiving thousands of unqualified forms, our system automatically filters candidates based on your exact requirements before they can apply.',
    },
    {
      question: 'Can we review and manage student applications directly here?',
      answer: 'Yes! We give you a simple dashboard where you can check submitted documents, update application statuses, and notify shortlisted students.',
    },
    {
      question: 'Is there support available if we need help setting up?',
      answer: 'Our support team is ready to assist you through setup, verification, and managing your listings anytime via email or direct message.',
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