import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getDemoProject, getMyProjects, getProject, downloadInventoryPdf, downloadStatusReportPdf, saveProjectDocument, updateProject } from '../api/client';
import { cacheProject, getCachedProject, getCachedDemoProject } from '../offline/db';
import { loadDemoProject, saveDemoSession, resetDemoProject } from '../offline/demoSession';
import { recalcProjectStats } from '../offline/demoLocal';
import type { Project, Piece, Signoff } from '../types';
import { PageHeader } from '../components/Layout';
import { StageBadge, ConditionBadge } from '../components/Badges';
import { PiecePhoto } from '../components/PiecePhoto';
import { PieceUpdateForm } from '../components/PieceUpdateForm';
import { StagePhotos } from '../components/StagePhotos';
import { InventorySignoffPanel, PieceMilestoneSignoffs } from '../components/SignoffSection';
import { PdfExportMenu, type PdfExportType } from '../components/PdfExportMenu';
import { PdfExportDialog, exportTypeToDocument } from '../components/PdfExportDialog';
import { ProjectDocumentsPanel } from '../components/ProjectDocumentsPanel';
import { ContractAgreementSection } from '../components/ContractAgreementSection';
import { PhasePaymentsSection } from '../components/PhasePaymentsSection';
import { ProjectAuditPanel } from '../components/ProjectAuditPanel';
import { ProjectLabelsSection } from '../components/ProjectLabelsSection';
import { ProjectChangeOrdersSection } from '../components/ProjectChangeOrdersSection';
import { ProjectScopeReductionSection } from '../components/ProjectScopeReductionSection';
import { SearchField, matchesSearch } from '../components/SearchField';
import {
  ProjectPhaseTimeline,
  CompactProjectPhaseTimeline,
  StagingPlanSection,
  PickupLocationsSection,
  ScheduleSection,
} from '../components/ProjectWorkflow';
import { ProjectLayoutSwitcher } from '../components/ProjectLayoutSwitcher';
import { useProjectLayout } from '../hooks/useProjectLayout';
import {
  shouldShowTimeline,
  visibleTabs,
  type ProjectTabId,
} from '../lib/projectLayout';
import { PERMISSIONS, hasAnyPermission } from '../lib/permissions';
import { useAuth } from '../context/AuthContext';
import {
  PROJECT_STATUS_LABELS,
  PHASE_LABELS,
  STAGE_PHASE,
  INSTALL_DEST_LABELS,
  nextProjectStatus,
  formatCurrency,
  formatDate,
} from '../lib/labels';
import {
  MapPin, Calendar, User, Building2, Package, ChevronRight, X,
  Loader2, AlertCircle, Pencil, Wifi, RotateCcw, ChevronDown,
} from 'lucide-react';

interface ProjectPortalProps {
  projectId?: string;
  isDemo?: boolean;
}

export function ProjectPortal({ projectId, isDemo }: ProjectPortalProps) {
  const { user, isDesigner, hasPermission } = useAuth();
  const { layoutId, setLayoutId, preset: layout } = useProjectLayout();
  const [searchParams] = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<ProjectTabId>('inventory');
  const [pieceSearch, setPieceSearch] = useState('');
  const [headerDetailsOpen, setHeaderDetailsOpen] = useState(
    () => !layout.defaultCollapsed.headerDetails,
  );
  const [headerPricingOpen, setHeaderPricingOpen] = useState(
    () => !layout.defaultCollapsed.headerPricing,
  );
  const [headerDocumentsOpen, setHeaderDocumentsOpen] = useState(
    () => !layout.defaultCollapsed.headerDocuments,
  );
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pendingExport, setPendingExport] = useState<PdfExportType | null>(null);
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0);
  const [demoFromSession, setDemoFromSession] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [advancingStatus, setAdvancingStatus] = useState(false);

  const canEdit =
    isDemo ||
    !!(user && (isDesigner || hasPermission(PERMISSIONS.PROJECTS_MANAGE)));
  const canAdvance = hasPermission(PERMISSIONS.PROJECTS_ADVANCE);
  const canPrintLabels = hasAnyPermission(
    user?.permissions,
    [PERMISSIONS.PROJECTS_MANAGE, PERMISSIONS.FIELD_USE],
    user?.role,
  );
  const showLabelsSection = !!(canPrintLabels && (user || isDemo));
  const labelsExpanded = searchParams.get('labels') === '1';

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'audit' && user && !isDemo) setActiveTab('audit');
    if (tab === 'changes' && user && !isDemo) setActiveTab('changes');
    if (searchParams.get('labels') === '1') setActiveTab('inventory');
  }, [searchParams, user, isDemo]);

  useEffect(() => {
    setHeaderDetailsOpen(!layout.defaultCollapsed.headerDetails);
    setHeaderPricingOpen(!layout.defaultCollapsed.headerPricing);
    setHeaderDocumentsOpen(!layout.defaultCollapsed.headerDocuments);
  }, [layoutId, layout.defaultCollapsed.headerDetails, layout.defaultCollapsed.headerPricing, layout.defaultCollapsed.headerDocuments]);

  const tabsForUser = useMemo(
    () => visibleTabs(layout, { isDemo: !!isDemo, hasUser: !!user }),
    [layout, isDemo, user],
  );

  useEffect(() => {
    if (!tabsForUser.some((t) => t.id === activeTab)) {
      setActiveTab(tabsForUser[0]?.id ?? 'inventory');
    }
  }, [tabsForUser, activeTab]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        if (isDemo) {
          let data: Project | null = null;
          let sessionLoaded = false;

          try {
            const result = await loadDemoProject(getDemoProject);
            data = result.project;
            sessionLoaded = result.fromSession;
          } catch {
            // fall through to API / legacy cache
          }

          if (!data) {
            try {
              data = await getDemoProject();
            } catch {
              data = (await getCachedDemoProject()) ?? (await getCachedProject(projectId ?? '')) ?? null;
            }
          }

          if (!data) throw new Error('unavailable');

          try {
            await cacheProject(data);
          } catch {
            // non-fatal
          }

          setDemoFromSession(sessionLoaded);
          setFromCache(sessionLoaded);
          setProject(data);
        } else if (projectId) {
          try {
            const data = await getProject(projectId);
            await cacheProject(data);
            setFromCache(false);
            setProject(data);
          } catch {
            const cached = await getCachedProject(projectId);
            if (!cached) throw new Error('offline');
            setFromCache(true);
            setProject(cached);
          }
        } else {
          throw new Error('no project');
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId, isDemo]);

  const handleAdvanceProject = async () => {
    if (!project || isDemo || !canAdvance) return;
    const next = nextProjectStatus(project.status);
    if (!next) return;
    if (
      !window.confirm(
        `Move this project to ${PROJECT_STATUS_LABELS[next]}? This updates the workflow phase for the whole job.`,
      )
    ) {
      return;
    }
    setAdvancingStatus(true);
    try {
      const updated = await updateProject(project.id, { status: next });
      setProject(updated);
      await cacheProject(updated);
    } catch {
      window.alert('Unable to advance project phase.');
    } finally {
      setAdvancingStatus(false);
    }
  };

  const persistDemo = async (next: Project) => {
    const updated = recalcProjectStats(next);
    setProject(updated);
    await saveDemoSession(updated);
    setDemoFromSession(true);
  };

  const handleResetDemo = async () => {
    if (!isDemo || !confirm('Reset the demo to its original state? Your local changes will be cleared.')) return;
    setResetting(true);
    try {
      const fresh = await resetDemoProject(getDemoProject);
      await cacheProject(fresh);
      setProject(fresh);
      setDemoFromSession(false);
      setSelectedPiece(null);
      setEditingPiece(null);
    } catch {
      alert('Unable to reset — check your connection and try again.');
    } finally {
      setResetting(false);
    }
  };

  const filteredPieces = useMemo(() => {
    if (!project) return [];
    let list = selectedRoom === 'all'
      ? project.pieces
      : project.pieces.filter((p) => p.roomId === selectedRoom);
    if (pieceSearch.trim()) {
      list = list.filter((p) =>
        matchesSearch(pieceSearch, p.name, p.vendor, p.room?.name, p.currentLocation),
      );
    }
    return list;
  }, [project, selectedRoom, pieceSearch]);

  const handlePieceUpdate = async (updated: Piece) => {
    if (!project) return;
    const next = {
      ...project,
      pieces: project.pieces.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
    };
    if (isDemo) {
      await persistDemo(next);
    } else {
      setProject(recalcProjectStats(next));
    }
    setEditingPiece(null);
    setSelectedPiece(updated);
  };

  const handleSignoff = async (signoff: Signoff) => {
    if (!project) return;
    const next = {
      ...project,
      signoffs: [...(project.signoffs || []), signoff],
      pieces: project.pieces.map((p) =>
        signoff.pieceId === p.id
          ? { ...p, signoffs: [...(p.signoffs || []), signoff] }
          : p,
      ),
    };
    if (isDemo) {
      await persistDemo(next);
    } else {
      setProject(next);
    }
  };

  const downloadPdfBlob = async (type: PdfExportType, note?: string) => {
    if (!project) throw new Error('no project');
    let blob: Blob;
    let filename: string;
    const safeName = project.name.slice(0, 24).replace(/[^\w\s-]/g, '').trim();

    if (type === 'inventory') {
      blob = await downloadInventoryPdf(project.id, note);
      filename = `inventory-${safeName}.pdf`;
    } else if (type === 'status-full') {
      blob = await downloadStatusReportPdf(project.id, undefined, note);
      filename = `status-report-${safeName}.pdf`;
    } else {
      const phase = type.replace('status-', '') as 'planning' | 'pickup_storage' | 'installation';
      blob = await downloadStatusReportPdf(project.id, phase, note);
      filename = `signoff-${phase}-${safeName}.pdf`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePdfDownload = async (note?: string) => {
    if (!project || isDemo || !pendingExport) return;
    setPdfLoading(true);
    try {
      await downloadPdfBlob(pendingExport, note);
    } catch {
      throw new Error('download failed');
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePdfSave = async (note?: string) => {
    if (!project || isDemo || !pendingExport) return;
    setPdfLoading(true);
    try {
      const { documentType, phase } = exportTypeToDocument(pendingExport);
      await saveProjectDocument(project.id, { documentType, phase, note });
      setDocumentsRefreshKey((k) => k + 1);
    } catch {
      throw new Error('save failed');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center pb-24">
        <AlertCircle className="text-gold mb-4" size={40} />
        <h2 className="font-serif text-2xl mb-2">Project Unavailable</h2>
        <p className="text-charcoal/60 max-w-md mx-auto">
          {isDemo
            ? 'Could not load the demo project. Check that the backend is running on port 3001, then refresh.'
            : 'Connect to load project data, sign in if this is a private project, or view a previously cached version.'}
        </p>
        {isDemo && (
          <Link to="/demo" className="mt-4 text-sm text-gold underline" onClick={() => window.location.reload()}>
            Retry
          </Link>
        )}
      </div>
    );
  }

  const showMarketingHeader = isDemo || !user;

  return (
    <>
      {showMarketingHeader && (
        <PageHeader
          eyebrow={isDemo ? 'Live Demo' : 'Project Portal'}
          title={isDemo ? 'Project Portal Preview' : project.name}
          subtitle={isDemo ? 'Sample project showing designer and client visibility.' : project.description}
          dark
        />
      )}

      {!showMarketingHeader && !isDemo && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <p className="text-xs text-charcoal/50">{project.description}</p>
        </div>
      )}

      {isDemo && (
        <div className="bg-sky-50 text-sky-900 text-xs py-2.5 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wifi size={12} className="shrink-0" />
            <span>
              Demo sandbox — changes are saved in your browser only, not on the server.
              {demoFromSession && ' You have unsaved-to-server edits from a previous visit.'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetDemo}
            disabled={resetting}
            className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-sky-800 hover:text-sky-950 border border-sky-200 bg-white px-3 py-2 min-h-[36px] shrink-0"
          >
            {resetting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            Reset Demo
          </button>
        </div>
      )}

      {fromCache && !isDemo && (
        <div className="bg-amber-50 text-amber-800 text-xs text-center py-2 px-4 flex items-center justify-center gap-2">
          <Wifi size={12} /> Showing cached data — connect to refresh
        </div>
      )}

      <section className={`max-w-7xl mx-auto px-4 py-6 md:py-10 ${showMarketingHeader ? 'pb-28 md:pb-10' : 'pb-6'}`}>
        <div className="bg-white border border-cream-dark p-4 md:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-charcoal/10 text-charcoal">
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
              {!isDemo && <h2 className="font-serif text-xl mt-2">{project.name}</h2>}
              {layout.headerMode === 'compact' && (
                <p className="text-xs text-charcoal/55 mt-1 truncate">
                  {project.propertyAddress}
                  {project.propertyCity ? `, ${project.propertyCity}` : ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <ProjectLayoutSwitcher layoutId={layoutId} onChange={setLayoutId} />
              {user && !isDemo && (
                <PdfExportMenu loading={pdfLoading} onExport={setPendingExport} />
              )}
            </div>
          </div>

          {pendingExport && (
            <PdfExportDialog
              exportType={pendingExport}
              loading={pdfLoading}
              onClose={() => setPendingExport(null)}
              onDownload={handlePdfDownload}
              onSave={handlePdfSave}
            />
          )}

          {layout.headerMode === 'full' && user && !isDemo && (
            <div className="mt-4">
              <ProjectDocumentsPanel projectId={project.id} refreshKey={documentsRefreshKey} />
            </div>
          )}

          {(layout.headerMode === 'full' ||
            (layout.headerMode === 'tiered' && headerDetailsOpen) ||
            (layout.headerMode === 'compact' && headerDetailsOpen)) && (
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${
                layout.headerMode === 'full' ? 'pt-4 border-t border-cream-dark mt-4' : 'pt-3 mt-3'
              }`}
            >
              <InfoItem icon={MapPin} label="Property" value={`${project.propertyAddress}, ${project.propertyCity || ''}`} />
              <InfoItem icon={Calendar} label="Target Install" value={formatDate(project.targetInstallDate)} />
              <InfoItem icon={User} label="Designer" value={`${project.designer.name} — ${project.designer.firm}`} />
              <InfoItem icon={Building2} label="Client" value={project.client.name} />
            </div>
          )}

          {layout.headerMode !== 'full' && (
            <button
              type="button"
              onClick={() => setHeaderDetailsOpen((v) => !v)}
              className="mt-3 flex items-center gap-1 text-xs uppercase tracking-wider text-charcoal/60 min-h-[44px]"
            >
              <ChevronDown size={14} className={`transition-transform ${headerDetailsOpen ? 'rotate-180' : ''}`} />
              {headerDetailsOpen ? 'Hide project details' : 'Show project details'}
            </button>
          )}

          {!isDemo && project.mileRate != null && layout.headerMode === 'full' && (
            <div className="mt-4 pt-4 border-t border-cream-dark">
              <p className="text-[10px] uppercase tracking-wider text-charcoal/55 mb-2">
                Locked pricing (from quote)
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-charcoal/55">Mile rate</p>
                  <p className="text-charcoal">{formatCurrency(Number(project.mileRate))}/mi</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-charcoal/55">Coordination</p>
                  <p className="text-charcoal">{formatCurrency(Number(project.projectBaseFee ?? 0))}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-charcoal/55">Extra pickup</p>
                  <p className="text-charcoal">
                    {formatCurrency(Number(project.additionalPickupSurcharge ?? 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-charcoal/55">Min quote</p>
                  <p className="text-charcoal">{formatCurrency(Number(project.minimumQuote ?? 0))}</p>
                </div>
              </div>
            </div>
          )}

          {!isDemo && project.mileRate != null && layout.headerMode !== 'full' && (
            <div className="mt-3 border-t border-cream-dark pt-3">
              <button
                type="button"
                onClick={() => setHeaderPricingOpen((v) => !v)}
                className="flex items-center gap-1 text-xs uppercase tracking-wider text-charcoal/60 min-h-[44px]"
              >
                <ChevronDown size={14} className={`transition-transform ${headerPricingOpen ? 'rotate-180' : ''}`} />
                Locked pricing
              </button>
              {headerPricingOpen && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-charcoal/55">Mile rate</p>
                    <p className="text-charcoal">{formatCurrency(Number(project.mileRate))}/mi</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-charcoal/55">Coordination</p>
                    <p className="text-charcoal">{formatCurrency(Number(project.projectBaseFee ?? 0))}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-charcoal/55">Extra pickup</p>
                    <p className="text-charcoal">
                      {formatCurrency(Number(project.additionalPickupSurcharge ?? 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-charcoal/55">Min quote</p>
                    <p className="text-charcoal">{formatCurrency(Number(project.minimumQuote ?? 0))}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {layout.headerMode === 'tiered' && user && !isDemo && (
            <div className="mt-3 border-t border-cream-dark pt-3">
              <button
                type="button"
                onClick={() => setHeaderDocumentsOpen((v) => !v)}
                className="flex items-center gap-1 text-xs uppercase tracking-wider text-charcoal/60 min-h-[44px] mb-2"
              >
                <ChevronDown size={14} className={`transition-transform ${headerDocumentsOpen ? 'rotate-180' : ''}`} />
                Project documents
              </button>
              {headerDocumentsOpen && (
                <ProjectDocumentsPanel projectId={project.id} refreshKey={documentsRefreshKey} />
              )}
            </div>
          )}
        </div>

        {shouldShowTimeline(layout, activeTab) &&
          (layout.timelineMode === 'compact' ? (
            <CompactProjectPhaseTimeline project={project} />
          ) : (
            <ProjectPhaseTimeline
              project={project}
              showAdvance={!!(canAdvance && user && !isDemo && project.status !== 'complete')}
              onAdvance={() => void handleAdvanceProject()}
              advancing={advancingStatus}
            />
          ))}

        <div className="flex gap-1 overflow-x-auto mb-6 -mx-4 px-4 scrollbar-hide border-b border-cream-dark">
          {tabsForUser.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`shrink-0 px-4 py-3 text-xs uppercase tracking-wider min-h-[44px] border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-gold text-charcoal font-medium'
                  : 'border-transparent text-charcoal/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'changes' && !isDemo && canEdit && (
          <div className="mb-6 space-y-6">
            <ProjectChangeOrdersSection project={project} canManage />
            <ProjectScopeReductionSection project={project} canManage />
          </div>
        )}

        {activeTab === 'plan' && (
          <>
            {layout.scopeOnTab === 'plan' && !isDemo && canEdit && (
              <div className="mb-6 space-y-6">
                <ProjectChangeOrdersSection project={project} canManage />
                <ProjectScopeReductionSection project={project} canManage />
              </div>
            )}
            <StagingPlanSection project={project} />
            <PickupLocationsSection project={project} />
            {layout.scheduleOnTab === 'plan' && <ScheduleSection project={project} />}
          </>
        )}

        {activeTab === 'schedule' && layout.scheduleOnTab === 'schedule' && (
          <ScheduleSection project={project} />
        )}

        {activeTab === 'contract' && user && !isDemo && (
          <>
            <ContractAgreementSection project={project} />
            <PhasePaymentsSection project={project} />
          </>
        )}

        {activeTab === 'audit' && user && !isDemo && projectId && (
          <ProjectAuditPanel projectId={projectId} />
        )}

        {activeTab === 'inventory' && (
        <>
        {layout.inventoryOrder === 'operations' && (
          <>
            <SearchField
              value={pieceSearch}
              onChange={setPieceSearch}
              placeholder="Search pieces…"
              className="mb-4"
            />
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 scrollbar-hide">
              <FilterPill active={selectedRoom === 'all'} onClick={() => setSelectedRoom('all')}>
                All ({project.pieces.length})
              </FilterPill>
              {project.rooms.map((room) => (
                <FilterPill
                  key={room.id}
                  active={selectedRoom === room.id}
                  onClick={() => setSelectedRoom(room.id)}
                >
                  {room.name} ({project.pieces.filter((p) => p.roomId === room.id).length})
                </FilterPill>
              ))}
            </div>
            <div className="space-y-2 md:space-y-0 md:bg-white md:border md:border-cream-dark mb-6">
              {filteredPieces.map((piece) => (
                <button
                  key={piece.id}
                  type="button"
                  onClick={() => setSelectedPiece(piece)}
                  className="w-full text-left bg-white md:bg-transparent border md:border-0 border-cream-dark p-4 md:px-6 md:py-4 md:border-t md:border-cream-dark hover:bg-cream/50 transition-colors group active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <PiecePhoto piece={piece} size="thumb" className="rounded-sm border border-cream-dark" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-charcoal group-hover:text-gold transition-colors flex items-center gap-1">
                        {piece.name}
                        <ChevronRight size={14} className="opacity-50 shrink-0" />
                      </p>
                      {piece.vendor && <p className="text-xs text-charcoal/40">{piece.vendor}</p>}
                      <p className="text-xs text-charcoal/50 mt-0.5">{PHASE_LABELS[STAGE_PHASE[piece.currentStage]]}</p>
                      <p className="text-xs text-charcoal/50 mt-1 md:hidden">{piece.room?.name}</p>
                      <p className="text-xs text-charcoal/40 mt-1 line-clamp-1">{piece.currentLocation}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StageBadge stage={piece.currentStage} />
                      <ConditionBadge condition={piece.currentCondition} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {showLabelsSection &&
          (layout.defaultCollapsed.labels ? (
            <CollapsibleSection
              title="Inventory labels"
              defaultOpen={labelsExpanded}
              className="mb-6"
            >
              <ProjectLabelsSection
                project={project}
                isDemo={isDemo}
                defaultExpanded={labelsExpanded || !layout.defaultCollapsed.labels}
                embedded
              />
            </CollapsibleSection>
          ) : (
            <ProjectLabelsSection
              project={project}
              isDemo={isDemo}
              defaultExpanded={labelsExpanded}
            />
          ))}

        {layout.defaultCollapsed.signoffs ? (
          <CollapsibleSection
            title="Phase signoffs"
            defaultOpen={false}
            className="mb-6"
          >
            <InventorySignoffPanel project={project} onSignoff={handleSignoff} isDemo={isDemo} />
          </CollapsibleSection>
        ) : (
          <InventorySignoffPanel project={project} onSignoff={handleSignoff} isDemo={isDemo} />
        )}

        {layout.showPhaseStatCards && (
        <div className="grid grid-cols-3 gap-2 mb-6">
          {PHASE_LABELS && (['planning', 'pickup_storage', 'installation'] as const).map((phase) => (
            <StatCard
              key={phase}
              label={PHASE_LABELS[phase]}
              value={project.stats.phaseSummary?.[phase] || 0}
              small
            />
          ))}
        </div>
        )}

        {layout.inventoryOrder === 'classic' && (
        <>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 scrollbar-hide">
          <FilterPill active={selectedRoom === 'all'} onClick={() => setSelectedRoom('all')}>
            All ({project.pieces.length})
          </FilterPill>
          {project.rooms.map((room) => (
            <FilterPill
              key={room.id}
              active={selectedRoom === room.id}
              onClick={() => setSelectedRoom(room.id)}
            >
              {room.name} ({project.pieces.filter((p) => p.roomId === room.id).length})
            </FilterPill>
          ))}
        </div>

        <div className="space-y-2 md:space-y-0 md:bg-white md:border md:border-cream-dark">
          {filteredPieces.map((piece) => (
            <button
              key={piece.id}
              type="button"
              onClick={() => setSelectedPiece(piece)}
              className="w-full text-left bg-white md:bg-transparent border md:border-0 border-cream-dark p-4 md:px-6 md:py-4 md:border-t md:border-cream-dark hover:bg-cream/50 transition-colors group active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <PiecePhoto piece={piece} size="thumb" className="rounded-sm border border-cream-dark" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-charcoal group-hover:text-gold transition-colors flex items-center gap-1">
                    {piece.name}
                    <ChevronRight size={14} className="opacity-50 shrink-0" />
                  </p>
                  {piece.vendor && <p className="text-xs text-charcoal/40">{piece.vendor}</p>}
                  <p className="text-xs text-charcoal/50 mt-0.5">{PHASE_LABELS[STAGE_PHASE[piece.currentStage]]}</p>
                  <p className="text-xs text-charcoal/50 mt-1 md:hidden">{piece.room?.name}</p>
                  <p className="text-xs text-charcoal/40 mt-1 line-clamp-1">{piece.currentLocation}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <StageBadge stage={piece.currentStage} />
                  <ConditionBadge condition={piece.currentCondition} />
                </div>
              </div>
            </button>
          ))}
        </div>
        </>
        )}
        </>
        )}
      </section>

      {selectedPiece && !editingPiece && (
        <PieceDetailPanel
          piece={selectedPiece}
          project={project}
          canEdit={!!canEdit}
          isDemo={isDemo}
          onEdit={() => setEditingPiece(selectedPiece)}
          onClose={() => setSelectedPiece(null)}
          onSignoff={handleSignoff}
        />
      )}

      {editingPiece && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0 bg-charcoal/50" onClick={() => setEditingPiece(null)} />
          <div className="relative w-full max-w-md shadow-xl">
            <PieceUpdateForm
              piece={editingPiece}
              isDemo={isDemo}
              onSuccess={handlePieceUpdate}
              onCancel={() => setEditingPiece(null)}
              layout="modal"
            />
          </div>
        </div>
      )}
    </>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  className = '',
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`bg-white border border-cream-dark ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[44px] text-left hover:bg-cream/30 transition-colors"
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-charcoal">{title}</span>
        <ChevronDown size={16} className={`text-charcoal/50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 border-t border-cream-dark">{children}</div>}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-gold mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-charcoal/40">{label}</p>
        <p className="text-sm text-charcoal/80">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: number; small?: boolean }) {
  return (
    <div className="bg-white border border-cream-dark p-2 md:p-3 text-center">
      <p className={`font-serif ${small ? 'text-base md:text-lg' : 'text-xl md:text-2xl'} text-charcoal`}>{value}</p>
      <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-charcoal/40 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-4 py-2.5 text-xs uppercase tracking-wider transition-colors min-h-[44px] ${
        active ? 'bg-charcoal text-cream' : 'bg-white border border-cream-dark text-charcoal/60'
      }`}
    >
      {children}
    </button>
  );
}

function PieceDetailPanel({
  piece,
  project,
  canEdit,
  isDemo,
  onEdit,
  onClose,
  onSignoff,
}: {
  piece: Piece;
  project: Project;
  canEdit: boolean;
  isDemo?: boolean;
  onEdit: () => void;
  onClose: () => void;
  onSignoff: (signoff: Signoff) => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-charcoal/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-cream h-full overflow-y-auto shadow-2xl pb-24">
        <div className="sticky top-0 bg-cream border-b border-cream-dark px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-gold" />
            <span className="text-xs uppercase tracking-wider text-charcoal/50">Piece Detail</span>
          </div>
          <button type="button" onClick={onClose} className="p-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-5">
          <StagePhotos piece={piece} />

          <div>
            <h3 className="font-serif text-xl md:text-2xl">{piece.name}</h3>
            {piece.vendor && <p className="text-sm text-charcoal/50">{piece.vendor}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-1">Room</p>
              <p className="text-sm">{piece.room?.name || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-1">Value</p>
              <p className="text-sm">{formatCurrency(piece.value)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-1">Stage</p>
              <StageBadge stage={piece.currentStage} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-1">Condition</p>
              <ConditionBadge condition={piece.currentCondition} />
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-1">Location</p>
            <p className="text-sm text-charcoal/70">{piece.currentLocation}</p>
          </div>

          {piece.stagingNotes && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-1">Staging Plan</p>
              <p className="text-sm text-charcoal/70">{piece.stagingNotes}</p>
            </div>
          )}

          {piece.pickupLocation && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-1">Pickup From</p>
              <p className="text-sm text-charcoal/70">{piece.pickupLocation.name}</p>
            </div>
          )}

          {piece.installDestination && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-charcoal/40 mb-1">Install At</p>
              <p className="text-sm text-charcoal/70">{INSTALL_DEST_LABELS[piece.installDestination]}</p>
            </div>
          )}

          <PieceMilestoneSignoffs project={project} piece={piece} onSignoff={onSignoff} isDemo={isDemo} />

          {canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="w-full flex items-center justify-center gap-2 py-4 bg-charcoal text-cream text-sm uppercase tracking-wider min-h-[52px]"
            >
              <Pencil size={16} /> Update Stage / Condition
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [listTab, setListTab] = useState<'active' | 'completed'>('active');
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const inOpsShell = !!user;

  useEffect(() => {
    if (user) {
      getMyProjects()
        .then((list) => {
          setProjects(list as unknown as Project[]);
          list.forEach((p) => getProject(p.id).then(cacheProject).catch(() => {}));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const activeProjects = projects.filter((p) => p.status !== 'complete');
  const completedProjects = projects.filter((p) => p.status === 'complete');
  const tabProjects = listTab === 'completed' ? completedProjects : activeProjects;
  const visibleProjects = useMemo(
    () =>
      tabProjects.filter((p) =>
        matchesSearch(search, p.name, p.propertyAddress, p.propertyCity, p.description),
      ),
    [tabProjects, search],
  );

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold" size={32} /></div>;
  }

  return (
    <>
      {!inOpsShell && (
        <PageHeader eyebrow="Projects" title="Your Projects" subtitle="Track every piece from receiving to installation." />
      )}
      <section className={`max-w-3xl mx-auto px-4 ${inOpsShell ? 'py-6' : 'py-8 pb-28'}`}>
        {inOpsShell && (
          <p className="text-xs text-charcoal/50 mb-4">
            Active and completed projects — open a project to manage inventory, signoffs, and exports.
          </p>
        )}
        {user && (
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search projects by name or address…"
            className="mb-4"
          />
        )}
        {user && (
          <div className="flex gap-1 overflow-x-auto mb-6 -mx-4 px-4 scrollbar-hide border-b border-cream-dark">
            {([
              ['active', 'Active'],
              ['completed', 'Completed'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setListTab(tab)}
                className={`shrink-0 px-4 py-3 text-xs uppercase tracking-wider min-h-[44px] border-b-2 transition-colors ${
                  listTab === tab
                    ? 'border-gold text-charcoal font-medium'
                    : 'border-transparent text-charcoal/50'
                }`}
              >
                {label}
                <span className="ml-1.5 text-charcoal/40">
                  ({tab === 'active' ? activeProjects.length : completedProjects.length})
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {listTab === 'active' && (
            <Link
              to="/demo"
              className="block p-4 bg-charcoal text-cream border border-charcoal min-h-[64px] flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">Morrison Lake House (Demo)</p>
                <p className="text-xs text-cream/60">Public sample project</p>
              </div>
              <ChevronRight size={18} />
            </Link>
          )}

          {visibleProjects.map((p) => (
            <Link
              key={p.id}
              to={`/project/${p.id}`}
              className="block p-4 bg-white border border-cream-dark hover:border-gold min-h-[64px] flex items-center justify-between active:scale-[0.99] transition-transform"
            >
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-charcoal/50">{p.propertyAddress}</p>
                {listTab === 'active' && p.status !== 'planning' && (
                  <p className="text-xs text-gold mt-1">{PROJECT_STATUS_LABELS[p.status]}</p>
                )}
              </div>
              <ChevronRight size={18} className="text-charcoal/30" />
            </Link>
          ))}

          {user && visibleProjects.length === 0 && (
            <p className="text-center text-sm text-charcoal/50 py-8">
              {search.trim()
                ? 'No projects match your search.'
                : listTab === 'completed'
                  ? 'No completed projects yet.'
                  : 'No active projects. New projects will appear here once created.'}
            </p>
          )}

          {!user && (
            <p className="text-center text-sm text-charcoal/50 pt-4">
              <Link to="/login" className="text-gold hover:underline">Sign in</Link> to view your projects
            </p>
          )}
        </div>
      </section>
    </>
  );
}
