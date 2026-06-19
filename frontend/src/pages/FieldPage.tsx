import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PieceUpdateForm } from '../components/PieceUpdateForm';
import { getDemoProject, getMyProjects, getProject } from '../api/client';
import { cacheProject } from '../offline/db';
import { loadDemoProject, saveDemoSession } from '../offline/demoSession';
import { recalcProjectStats } from '../offline/demoLocal';
import type { Project, Piece } from '../types';
import { StageBadge } from '../components/Badges';
import { PiecePhoto } from '../components/PiecePhoto';
import { Search, Loader2, ChevronRight } from 'lucide-react';

export function FieldPage() {
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { project: demo } = await loadDemoProject(getDemoProject);
        await cacheProject(demo);
        let list: Project[] = [demo];
        try {
          const mine = await getMyProjects();
          for (const p of mine) {
            if (p.id !== demo.id) {
              try {
                const full = await getProject(p.id);
                await cacheProject(full);
                list.push(full);
              } catch { /* skip */ }
            }
          }
        } catch { /* not logged in enough */ }
        setProjects(list);
        setSelectedProject(demo);
      } catch { /* offline - use cached */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    const pieceId = searchParams.get('pieceId');
    if (!pieceId || !projects.length) return;
    for (const project of projects) {
      const piece = project.pieces.find((p) => p.id === pieceId);
      if (piece) {
        setSelectedProject(project);
        setSelectedPiece(piece);
        break;
      }
    }
  }, [searchParams, projects]);

  const filteredPieces = selectedProject?.pieces.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.vendor?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold" size={32} /></div>;
  }

  if (selectedPiece) {
    const isDemo = !!selectedProject?.isDemo;
    return (
      <div className="px-4 py-6 pb-28 max-w-lg mx-auto">
        <button type="button" onClick={() => setSelectedPiece(null)} className="text-sm text-gold mb-4 min-h-[44px]">
          ← Back to pieces
        </button>
        <PieceUpdateForm
          piece={selectedPiece}
          isDemo={isDemo}
          onSuccess={async (updated) => {
            if (selectedProject) {
              const next = recalcProjectStats({
                ...selectedProject,
                pieces: selectedProject.pieces.map((p) =>
                  p.id === updated.id ? { ...p, ...updated } : p,
                ),
              });
              setSelectedProject(next);
              setProjects((prev) =>
                prev.map((p) => (p.id === next.id ? next : p)),
              );
              if (isDemo) await saveDemoSession(next);
            }
            setSelectedPiece(null);
          }}
          onCancel={() => setSelectedPiece(null)}
        />
      </div>
    );
  }

  return (
    <section className="max-w-lg mx-auto px-4 py-6">
      <p className="text-xs text-charcoal/50 mb-4">
        Log pickups and condition checks — works offline. Pending syncs show a badge on Field in the menu.
      </p>
        {projects.length > 1 && (
          <select
            value={selectedProject?.id || ''}
            onChange={(e) => setSelectedProject(projects.find((p) => p.id === e.target.value) || null)}
            className="w-full px-4 py-3 border border-cream-dark mb-4 min-h-[48px] bg-white"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        <div className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/30" />
          <input
            type="search"
            placeholder="Search pieces..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-cream-dark min-h-[48px] bg-white"
          />
        </div>

        <div className="space-y-2">
          {filteredPieces.map((piece) => (
            <button
              key={piece.id}
              type="button"
              onClick={() => setSelectedPiece(piece)}
              className="w-full text-left bg-white border border-cream-dark p-4 min-h-[72px] active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-3">
                <PiecePhoto piece={piece} size="thumb" className="rounded-sm border border-cream-dark" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{piece.name}</p>
                  <p className="text-xs text-charcoal/40">{piece.room?.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StageBadge stage={piece.currentStage} />
                  <ChevronRight size={16} className="text-charcoal/20" />
                </div>
              </div>
            </button>
          ))}
        </div>
    </section>
  );
}
