import type { RecordFieldChange } from '../types';

type DiffLine = { kind: 'remove' | 'add'; text: string };

function diffMultiline(from: string, to: string): DiffLine[] {
  const fromLines = from.split('\n');
  const toLines = to.split('\n');
  const toSet = new Set(toLines);
  const fromSet = new Set(fromLines);
  const lines: DiffLine[] = [];

  for (const line of fromLines) {
    if (!toSet.has(line)) lines.push({ kind: 'remove', text: line });
  }
  for (const line of toLines) {
    if (!fromSet.has(line)) lines.push({ kind: 'add', text: line });
  }

  return lines;
}

function buildDiffLines(change: RecordFieldChange): DiffLine[] {
  const from = change.from ?? '';
  const to = change.to ?? '';

  if (from === to) return [];

  if (!from && to) return [{ kind: 'add', text: to }];
  if (from && !to) return [{ kind: 'remove', text: from }];

  if (!from.includes('\n') && !to.includes('\n')) {
    return [
      { kind: 'remove', text: from },
      { kind: 'add', text: to },
    ];
  }

  const lines = diffMultiline(from, to);
  if (lines.length === 0) {
    return [
      { kind: 'remove', text: from },
      { kind: 'add', text: to },
    ];
  }

  return lines;
}

function DiffLineRow({ kind, text }: DiffLine) {
  const prefix = kind === 'remove' ? '-' : '+';
  const tone =
    kind === 'remove'
      ? 'bg-red-50 text-red-900 border-red-100'
      : 'bg-emerald-50 text-emerald-900 border-emerald-100';

  return (
    <div className={`flex gap-2 px-2 py-0.5 border-b last:border-b-0 ${tone}`}>
      <span className="shrink-0 w-3 select-none opacity-60">{prefix}</span>
      <span className="min-w-0 whitespace-pre-wrap break-words">{text || ' '}</span>
    </div>
  );
}

export function RecordChangeDiff({ changes }: { changes: RecordFieldChange[] }) {
  return (
    <div className="mt-2 space-y-3">
      {changes.map((change) => {
        const lines = buildDiffLines(change);
        if (lines.length === 0) return null;
        return (
          <div
            key={change.field}
            className="border border-cream-dark overflow-hidden bg-white font-mono text-[11px] leading-relaxed"
          >
            <div className="px-2 py-1 bg-charcoal/[0.04] text-[10px] uppercase tracking-wider text-charcoal/55 border-b border-cream-dark font-sans">
              {change.label}
            </div>
            <div>{lines.map((line, index) => <DiffLineRow key={index} {...line} />)}</div>
          </div>
        );
      })}
    </div>
  );
}
