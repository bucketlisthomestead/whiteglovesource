import { Link } from 'react-router-dom';
import { PageHeader, Button } from '../components/Layout';
import { CheckCircle } from 'lucide-react';
import { useSiteContentSection } from '../context/SiteContentContext';
import { RichOrPlain } from '../components/RichOrPlain';

export function ServicesPage() {
  const { data: services } = useSiteContentSection('services');

  return (
    <>
      <PageHeader
        eyebrow={services.pageHeader.eyebrow}
        title={services.pageHeader.title}
        subtitle={services.pageHeader.subtitle}
      />

      <section className="max-w-4xl mx-auto px-4 py-12 md:py-16 space-y-16">
        {services.serviceDetails.map((service, i) => (
          <div key={service.title} className={`${i > 0 ? 'pt-16 border-t border-cream-dark' : ''}`}>
            <h2 className="font-serif text-2xl md:text-3xl mb-4">{service.title}</h2>
            <div className="text-charcoal/60 leading-relaxed mb-6">
              <RichOrPlain text={service.description} as="div" />
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {service.includes.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-charcoal/70">
                  <CheckCircle size={16} className="text-gold mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="bg-charcoal text-cream py-16 px-4 text-center">
        <h2 className="font-serif text-2xl md:text-3xl mb-4">{services.bottomCta.title}</h2>
        <div className="text-cream/60 max-w-xl mx-auto mb-8">
          <RichOrPlain text={services.bottomCta.subtitle} as="div" />
        </div>
        <Link to="/quote"><Button variant="secondary">{services.bottomCta.cta}</Button></Link>
      </section>
    </>
  );
}
