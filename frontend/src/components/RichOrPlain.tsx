import { sanitizeRichText, isRichText } from '../lib/richText';

type RichOrPlainProps = {
  text: string;
  className?: string;
  as?: 'div' | 'span' | 'p';
};

export function RichOrPlain({ text, className = '', as: Tag = 'span' }: RichOrPlainProps) {
  if (!text) return null;

  if (isRichText(text)) {
    const clean = sanitizeRichText(text);
    if (!clean || clean === '<p></p>') return null;
    return (
      <Tag
        className={`rich-text ${className}`.trim()}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }

  return <Tag className={className}>{text}</Tag>;
}
