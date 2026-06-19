import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/Layout';
import { useSiteContentSection } from '../context/SiteContentContext';
import { resolveSiteContentIcon } from '../lib/siteContentIcons';
import { RichOrPlain } from '../components/RichOrPlain';

export function HomePage() {
  const { data: home } = useSiteContentSection('home');

  return (
    <>
      <section className="relative min-h-[85vh] flex items-center bg-charcoal text-cream overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--color-gold)_0%,_transparent_50%)]" />
        <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] repeat" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-gold mb-6">
              {home.hero.eyebrow}
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.1] mb-6">
              {home.hero.title}
            </h1>
            <p className="text-lg md:text-xl text-cream/70 leading-relaxed mb-10 max-w-2xl">
              <RichOrPlain text={home.hero.subtitle} />
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/quote">
                <Button variant="secondary" className="w-full sm:w-auto">
                  {home.hero.primaryCta}
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
              <Link to="/demo">
                <Button variant="outline" className="w-full sm:w-auto border-cream/30 text-cream hover:bg-cream hover:text-charcoal">
                  {home.hero.secondaryCta}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">{home.servicesSection.eyebrow}</p>
            <h2 className="font-serif text-3xl md:text-4xl text-charcoal">
              {home.servicesSection.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {home.servicesSection.items.map((service) => {
              const Icon = resolveSiteContentIcon(service.icon);
              return (
                <div
                  key={service.title}
                  className="group p-6 md:p-8 bg-white border border-cream-dark hover:border-gold/40 transition-colors"
                >
                  <Icon className="text-gold mb-4" size={28} strokeWidth={1.5} />
                  <h3 className="font-serif text-xl mb-3 text-charcoal">{service.title}</h3>
                  <p className="text-sm text-charcoal/60 leading-relaxed">
                    <RichOrPlain text={service.description} />
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4 bg-charcoal text-cream">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold mb-4">{home.portalSection.eyebrow}</p>
            <h2 className="font-serif text-3xl md:text-4xl mb-6">
              {home.portalSection.title}
            </h2>
            <div className="text-cream/70 leading-relaxed mb-6">
              <RichOrPlain text={home.portalSection.description} as="div" />
            </div>
            <ul className="space-y-3 text-sm text-cream/60 mb-8">
              {home.portalSection.bullets.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 bg-gold rounded-full" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/demo">
              <Button variant="secondary">
                {home.portalSection.cta}
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
          </div>

          <div className="bg-charcoal-light border border-cream/10 p-6 md:p-8">
            <div className="space-y-4">
              {home.portalSection.sampleItems.map((item) => (
                <div key={item.piece} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-cream/10 last:border-0">
                  <div>
                    <p className="text-sm text-cream">{item.piece}</p>
                    <p className="text-xs text-cream/40">{item.room}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-cream/10 text-cream/70">{item.stage}</span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-gold/20 text-gold">{item.condition}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-cream/30 mt-6 text-center">{home.portalSection.sampleCaption}</p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl mb-4">{home.ctaSection.title}</h2>
          <div className="text-charcoal/60 mb-8">
            <RichOrPlain text={home.ctaSection.subtitle} as="div" />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/quote"><Button>{home.ctaSection.primaryCta}</Button></Link>
            <Link to="/contact"><Button variant="outline">{home.ctaSection.secondaryCta}</Button></Link>
          </div>
        </div>
      </section>
    </>
  );
}
