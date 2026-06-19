import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useEffect, useId } from 'react';
import { Bold, Italic, Link2, List, ListOrdered, Unlink } from 'lucide-react';
import { FormField } from '../Layout';
import { normalizeRichTextOutput } from '../../lib/richText';

type RichTextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
};

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`p-1.5 border transition-colors ${
        active
          ? 'border-gold bg-gold/10 text-charcoal'
          : 'border-cream-dark text-charcoal/50 hover:text-gold hover:border-gold/40'
      }`}
    >
      {children}
    </button>
  );
}

export function RichTextField({ label, value, onChange, required, placeholder }: RichTextFieldProps) {
  const fieldId = useId();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        code: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        id: fieldId,
        class: 'prose-editor min-h-[100px] px-4 py-3 focus:outline-none',
        'data-placeholder': placeholder ?? '',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(normalizeRichTextOutput(ed.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = normalizeRichTextOutput(editor.getHTML());
    const incoming = normalizeRichTextOutput(value || '');
    if (current !== incoming) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <FormField label={label} required={required}>
      <div className="border border-cream-dark bg-white focus-within:border-gold transition-colors">
        {editor && (
          <div className="flex flex-wrap gap-1 p-2 border-b border-cream-dark bg-cream/30">
            <ToolbarButton
              label="Bold"
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold size={14} />
            </ToolbarButton>
            <ToolbarButton
              label="Italic"
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic size={14} />
            </ToolbarButton>
            <ToolbarButton
              label="Bullet list"
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List size={14} />
            </ToolbarButton>
            <ToolbarButton
              label="Numbered list"
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={14} />
            </ToolbarButton>
            <ToolbarButton
              label="Add link"
              active={editor.isActive('link')}
              onClick={setLink}
            >
              <Link2 size={14} />
            </ToolbarButton>
            <ToolbarButton
              label="Remove link"
              onClick={() => editor.chain().focus().unsetLink().run()}
            >
              <Unlink size={14} />
            </ToolbarButton>
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </FormField>
  );
}
