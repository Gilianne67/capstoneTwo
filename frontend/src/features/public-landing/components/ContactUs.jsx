import { Mail, MapPin, Clock } from 'lucide-react';

const contactItems = [
  {
    icon: Mail,
    title: 'Email Support',
    detail: 'Our team typically replies within 24 hours.',
    value: 'support@iskolarmatch.ph',
    href: 'mailto:support@iskolarmatch.ph',
  },
  {
    icon: MapPin,
    title: 'HQ & Regional Network',
    detail: 'Connecting students across Luzon, Visayas, and Mindanao.',
    value: 'Tech Hubs, Philippines',
  },
  {
    icon: Clock,
    title: 'Operating Hours',
    detail: 'Automated matching active 24/7.',
    value: 'Monday – Friday: 8:00 AM – 6:00 PM PST',
  },
];

export default function ContactUs() {
  return (
    <section id="contact" className="py-20 bg-app-bg border-t border-slate-200/80 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-app-text tracking-tight">
            We&apos;re Here to Help You Succeed
          </h2>
          <p className="text-text-muted text-sm sm:text-base leading-relaxed">
            Have a question about scholarship matching, account setup, or partnership opportunities? Reach out to our team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {contactItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl shrink-0">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-app-text">{item.title}</h3>
                  <p className="text-xs text-text-muted mt-0.5">{item.detail}</p>
                  {item.href ? (
                    <a
                      href={item.href}
                      className="text-sm font-semibold text-primary hover:underline mt-1.5 inline-block"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-app-text mt-1.5">{item.value}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
