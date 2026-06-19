import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';
import { useSiteContentSection } from '../context/SiteContentContext';
import { RichOrPlain } from '../components/RichOrPlain';
import { useSiteMenu } from '../context/SiteMenuContext';

export function Footer() {
  const { data: footer } = useSiteContentSection('footer');
  const { menu } = useSiteMenu();

  return (
    <footer className="bg-charcoal text-cream/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <p className="font-serif text-2xl text-cream mb-3">{footer.brandName}</p>
            <div className="text-sm leading-relaxed max-w-md text-cream/60">
              <RichOrPlain text={footer.tagline} as="div" />
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold mb-4">Quick Links</p>
            <ul className="space-y-2 text-sm">
              {menu.footerNav.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:text-gold transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold mb-4">Contact</p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin size={16} className="text-gold mt-0.5 shrink-0" />
                <span>
                  {footer.contact.location}
                  <br />
                  {footer.contact.region}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={16} className="text-gold shrink-0" />
                <a href={footer.contact.phoneHref} className="hover:text-gold transition-colors">
                  {footer.contact.phone}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={16} className="text-gold shrink-0" />
                <a href={`mailto:${footer.contact.email}`} className="hover:text-gold transition-colors">
                  {footer.contact.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-cream/10 flex flex-col sm:flex-row justify-between gap-4 text-xs text-cream/40 pb-20 md:pb-0">
          <p>&copy; {new Date().getFullYear()} {footer.brandName}. All rights reserved.</p>
          <p>{footer.copyrightTagline}</p>
        </div>
      </div>
    </footer>
  );
}
