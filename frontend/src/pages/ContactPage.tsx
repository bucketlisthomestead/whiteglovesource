import { useState } from 'react';
import { PageHeader, FormField, Button, inputClass, textareaClass } from '../components/Layout';
import { submitContact } from '../api/client';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { useSiteContentSection } from '../context/SiteContentContext';

export function ContactPage() {
  const { data: contact } = useSiteContentSection('contact');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await submitContact(form);
      setStatus('success');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <>
      <PageHeader
        eyebrow={contact.pageHeader.eyebrow}
        title={contact.pageHeader.title}
        subtitle={contact.pageHeader.subtitle}
      />

      <section className="max-w-xl mx-auto px-4 py-12 md:py-16">
        {status === 'success' ? (
          <div className="text-center py-12">
            <CheckCircle className="mx-auto text-gold mb-4" size={48} />
            <h2 className="font-serif text-2xl mb-2">Message Sent</h2>
            <p className="text-charcoal/60">{contact.successMessage}</p>
            <button onClick={() => setStatus('idle')} className="mt-6 text-sm text-gold underline">
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {status === 'error' && (
              <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 text-sm">
                <AlertCircle size={16} />
                {contact.errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label="Name" required>
                <input className={inputClass} value={form.name} onChange={update('name')} required />
              </FormField>
              <FormField label="Email" required>
                <input type="email" className={inputClass} value={form.email} onChange={update('email')} required />
              </FormField>
            </div>

            <FormField label="Phone">
              <input type="tel" className={inputClass} value={form.phone} onChange={update('phone')} />
            </FormField>

            <FormField label="Subject" required>
              <input className={inputClass} value={form.subject} onChange={update('subject')} required />
            </FormField>

            <FormField label="Message" required>
              <textarea className={textareaClass} value={form.message} onChange={update('message')} required />
            </FormField>

            <Button type="submit" loading={status === 'loading'} className="w-full sm:w-auto">
              Send Message
            </Button>
          </form>
        )}
      </section>
    </>
  );
}
