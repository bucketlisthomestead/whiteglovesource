import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2, Printer } from 'lucide-react';
import { getMyProjects } from '../api/client';
import type { Project } from '../types';
import { SearchField, matchesSearch } from '../components/SearchField';

export function LabelsHubPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getMyProjects()
      .then((list) => setProjects(list as unknown as Project[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () =>
      projects
        .filter((p) => p.isActive !== false)
        .filter((p) =>
          matchesSearch(search, p.name, p.propertyAddress, p.propertyCity, p.client?.name),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projects, search],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl text-charcoal">Print Inventory Labels</h1>
        <p className="text-sm text-charcoal/60 mt-1">
          Select a project to preview and print QR labels for warehouse check-in.
        </p>
      </div>

      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Search projects…"
        className="mb-4"
      />

      <div className="bg-white border border-cream-dark divide-y divide-cream-dark">
        {visible.length === 0 && (
          <p className="px-4 py-8 text-sm text-charcoal/50 text-center">No projects found.</p>
        )}
        {visible.map((p) => (
          <Link
            key={p.id}
            to={`/admin/labels/print/${encodeURIComponent(p.id)}`}
            className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-cream/50 transition-colors min-h-[64px]"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-xs text-charcoal/50 truncate">{p.propertyAddress}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gold shrink-0">
              <Printer size={12} /> Print
              <ChevronRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
