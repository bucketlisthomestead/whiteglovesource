import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, FormField, inputClass, textareaClass } from '../components/Layout';
import {
  DesignerAssignFields,
  ClientAssignFields,
  emptyNewDesigner,
  emptyNewClient,
} from '../components/AdminPartyFields';
import type { CreateClientInput, CreateDesignerInput } from '../types';
import {
  getDashboard,
  updateQuote,
  updateProject,
  markMessageRead,
  getAdminDesigners,
  getAdminClients,
  createProject,
  getStorageLocations,
  createStorageLocation,
  updateStorageLocation,
  deleteStorageLocation,
} from '../api/client';
import type { DashboardData, QuoteRequest, Designer, Client, StorageLocation, StorageLocationForm } from '../types';
import { formatDate, formatCurrency, QUOTE_STATUS_LABELS, DASHBOARD_STAT_TONES, type DashboardStatTone } from '../lib/labels';
import { formatDashboardDateRange } from '../lib/dashboardDates';
import { useDateRangeFilter } from '../lib/useDateRangeFilter';
import { Loader2, Mail, FileText, Plus, FolderPlus, Warehouse, Trash2 } from 'lucide-react';
import { SearchField, matchesSearch } from '../components/SearchField';
import { DateRangeFilter } from '../components/DateRangeFilter';

export function AdminPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [newProject, setNewProject] = useState({
    name: '',
    designerId: '',
    clientId: '',
    propertyAddress: '',
    propertyCity: '',
    description: '',
    targetInstallDate: '',
  });
  const [designerMode, setDesignerMode] = useState<'existing' | 'new'>('existing');
  const [clientMode, setClientMode] = useState<'existing' | 'new' | 'auto'>('existing');
  const [newDesigner, setNewDesigner] = useState<CreateDesignerInput>(emptyNewDesigner());
  const [newClient, setNewClient] = useState<CreateClientInput>(emptyNewClient());

  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([]);
  const [newWarehouse, setNewWarehouse] = useState<StorageLocationForm>({
    name: '',
    address: '',
    city: '',
    state: 'NC',
    zip: '',
    notes: '',
  });
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const {
    preset: datePreset,
    handlePresetChange: handleDatePresetChange,
    customFrom,
    customTo,
    setCustomFrom,
    setCustomTo,
    applyCustom,
    appliedRange,
  } = useDateRangeFilter('next6');
  const [quoteSearch, setQuoteSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');

  const load = () => {
    setLoading(true);
    getDashboard({ includeArchived: showArchived, from: appliedRange.from, to: appliedRange.to })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([getAdminDesigners(), getAdminClients(), getStorageLocations()])
      .then(([d, c, warehouses]) => {
        setDesigners(d);
        setClients(c);
        setStorageLocations(warehouses);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [showArchived, appliedRange.from, appliedRange.to]);

  const handleAddWarehouse = async () => {
    if (!newWarehouse.name || !newWarehouse.address) return;
    setActionLoading(true);
    try {
      const created = await createStorageLocation(newWarehouse);
      setStorageLocations((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewWarehouse({ name: '', address: '', city: '', state: 'NC', zip: '', notes: '' });
      setShowWarehouseForm(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleWarehouse = async (location: StorageLocation) => {
    const updated = await updateStorageLocation(location.id, { isActive: !location.isActive });
    setStorageLocations((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  };

  const handleDeleteWarehouse = async (id: string) => {
    if (!window.confirm('Remove this warehouse? Quotes will use remaining active locations.')) return;
    await deleteStorageLocation(id);
    setStorageLocations((prev) => prev.filter((w) => w.id !== id));
  };

  const refreshParties = () =>
    Promise.all([getAdminDesigners(), getAdminClients()]).then(([d, c]) => {
      setDesigners(d);
      setClients(c);
    });

  const resetNewProjectForm = () => {
    setNewProject({
      name: '', designerId: '', clientId: '', propertyAddress: '',
      propertyCity: '', description: '', targetInstallDate: '',
    });
    setDesignerMode('existing');
    setClientMode('existing');
    setNewDesigner(emptyNewDesigner());
    setNewClient(emptyNewClient());
  };

  const isDesignerReady =
    designerMode === 'existing'
      ? !!newProject.designerId
      : !!(newDesigner.name && newDesigner.firm && newDesigner.email && newDesigner.password.length >= 6);

  const isClientReady =
    clientMode === 'existing'
      ? !!newProject.clientId
      : !!(newClient.name && newClient.email && newClient.password.length >= 6);

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.propertyAddress || !isDesignerReady || !isClientReady) return;
    setActionLoading(true);
    try {
      const project = await createProject({
        name: newProject.name,
        propertyAddress: newProject.propertyAddress,
        propertyCity: newProject.propertyCity || undefined,
        description: newProject.description || undefined,
        targetInstallDate: newProject.targetInstallDate || undefined,
        ...(designerMode === 'existing'
          ? { designerId: newProject.designerId }
          : { newDesigner }),
        ...(clientMode === 'existing'
          ? { clientId: newProject.clientId }
          : { newClient }),
      });
      setShowNewProject(false);
      resetNewProjectForm();
      await refreshParties();
      load();
      navigate(`/project/${project.id}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    await markMessageRead(id);
    load();
  };

  const handleArchiveQuote = async (quote: QuoteRequest, isActive: boolean) => {
    setActionLoading(true);
    try {
      await updateQuote(quote.id, { isActive });
      load();
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveProject = async (projectId: string, isActive: boolean) => {
    setActionLoading(true);
    try {
      await updateProject(projectId, { isActive });
      load();
    } finally {
      setActionLoading(false);
    }
  };

  const toggleShowArchived = () => setShowArchived((v) => !v);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center py-20 text-charcoal/50">Unable to load dashboard</p>;
  }

  const { stats, recentQuotes, recentMessages, activeProjects } = data;

  const filteredQuotes = recentQuotes.filter((q) =>
    matchesSearch(quoteSearch, q.contactName, q.email, q.serviceType, q.status, q.propertyAddress),
  );

  const filteredProjects = activeProjects.filter((p) =>
    matchesSearch(
      projectSearch,
      p.name,
      p.propertyAddress,
      p.designer?.name,
      p.designer?.firm,
      p.client?.name,
    ),
  );

  const filteredMessages = recentMessages.filter((m) =>
    matchesSearch(messageSearch, m.name, m.email, m.subject, m.message),
  );

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-2xl md:text-3xl text-charcoal">Operations Dashboard</h1>
            <p className="text-sm text-charcoal/60 mt-1">
              Quotes, projects, and inbound messages · {formatDashboardDateRange(appliedRange)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowNewProject(true)} className="min-h-[44px]">
              <Plus size={14} className="mr-2" /> New Project
            </Button>
            {stats.users > 0 && (
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-2 px-4 py-2 border border-cream-dark text-sm uppercase tracking-wider hover:border-gold hover:text-gold min-h-[44px]"
              >
                Users ({stats.users})
              </Link>
            )}
          </div>
        </div>

        <div className="mb-6">
          <DateRangeFilter
            preset={datePreset}
            onPresetChange={handleDatePresetChange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            onApplyCustom={applyCustom}
            appliedRange={appliedRange}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {([
            { label: 'In progress', value: stats.projectsInProgress, amount: stats.projectsInProgressTotal, tone: 'inProgress' as DashboardStatTone },
            { label: 'Pending', value: stats.pendingQuotes, amount: stats.pendingQuotesTotal, tone: 'pending' as DashboardStatTone },
            { label: 'Complete', value: stats.projectsComplete, amount: stats.projectsCompleteTotal, tone: 'complete' as DashboardStatTone },
            { label: 'Proposals', value: stats.quotes, amount: stats.quotesTotal },
            { label: 'Leads', value: stats.leadQuotes, amount: stats.leadQuotesTotal },
            { label: 'Pieces', value: stats.pieces },
            { label: 'Unread', value: stats.unreadMessages },
          ] as { label: string; value: number; amount?: number; tone?: DashboardStatTone }[]).map((s) => {
            const tone = s.tone ? DASHBOARD_STAT_TONES[s.tone] : null;
            const isMutedUnread = s.label === 'Unread' && stats.unreadMessages === 0;

            return (
              <div
                key={s.label}
                className={`border p-4 text-center ${
                  isMutedUnread
                    ? 'bg-white border-cream-dark opacity-60'
                    : tone
                      ? tone.container
                      : 'bg-white border-cream-dark'
                }`}
              >
                <p className="font-serif text-2xl leading-tight">
                  {s.value}
                  {s.amount != null && s.amount > 0 && (
                    <span className={`block text-sm font-sans font-medium mt-1 ${tone?.amount ?? 'text-gold'}`}>
                      {formatCurrency(s.amount)}
                    </span>
                  )}
                </p>
                <p className={`text-[10px] uppercase tracking-wider mt-1 ${tone?.label ?? 'text-charcoal/40'}`}>
                  {s.label}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end mb-4">
          <button
            type="button"
            onClick={toggleShowArchived}
            className="text-xs uppercase tracking-wider text-charcoal/50 hover:text-gold min-h-[44px] px-3"
          >
            {showArchived ? 'Hide archived' : 'Show archived quotes & projects'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-cream-dark">
            <div className="px-4 py-3 border-b border-cream-dark flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-gold" />
                <h2 className="text-sm uppercase tracking-wider font-medium">Recent Quotes</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/admin/quotes"
                  className="text-xs uppercase tracking-wider text-gold hover:underline min-h-[44px] inline-flex items-center"
                >
                  View all quotes
                </Link>
                <SearchField
                  value={quoteSearch}
                  onChange={setQuoteSearch}
                  placeholder="Search quotes…"
                  className="sm:w-56"
                />
              </div>
            </div>
            <div className="divide-y divide-cream-dark max-h-80 overflow-y-auto">
              {filteredQuotes.length === 0 && (
                <p className="px-4 py-6 text-sm text-charcoal/50 text-center">No quotes to show.</p>
              )}
              {filteredQuotes.map((q) => (
                <div
                  key={q.id}
                  className={`flex items-stretch gap-1 ${q.isActive === false ? 'bg-cream/40 opacity-70' : ''}`}
                >
                  <Link
                    to={`/admin/quotes/${q.id}`}
                    className="flex-1 text-left px-4 py-3 hover:bg-cream/50 transition-colors min-w-0"
                  >
                    <p className="text-sm font-medium flex items-center gap-2">
                      {q.contactName}
                      {q.isActive === false && (
                        <span className="text-[10px] uppercase tracking-wider text-charcoal/40 border border-cream-dark px-1.5 py-0.5">Archived</span>
                      )}
                    </p>
                    <p className="text-xs text-charcoal/50">
                      {q.serviceType} — {QUOTE_STATUS_LABELS[q.status] || q.status}
                    </p>
                    {q.estimatedTotal != null && (
                      <p className="text-xs text-gold mt-0.5">Est. {formatCurrency(Number(q.estimatedTotal))}</p>
                    )}
                    <p className="text-xs text-charcoal/40 mt-1">{formatDate(q.createdAt)}</p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleArchiveQuote(q, q.isActive === false)}
                    disabled={actionLoading}
                    className="shrink-0 px-3 text-[10px] uppercase tracking-wider text-gold hover:bg-cream/50 min-w-[72px]"
                    title={q.isActive === false ? 'Restore quote' : 'Archive quote'}
                  >
                    {q.isActive === false ? 'Restore' : 'Archive'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-cream-dark">
            <div className="px-4 py-3 border-b border-cream-dark flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus size={16} className="text-gold" />
                <h2 className="text-sm uppercase tracking-wider font-medium">Active Projects</h2>
              </div>
              <SearchField
                value={projectSearch}
                onChange={setProjectSearch}
                placeholder="Search projects…"
                className="sm:w-56"
              />
            </div>
            <div className="divide-y divide-cream-dark max-h-80 overflow-y-auto">
              {filteredProjects.length === 0 && (
                <p className="px-4 py-6 text-sm text-charcoal/50 text-center">No active projects.</p>
              )}
              {filteredProjects.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-stretch gap-1 ${p.isActive === false ? 'bg-cream/40 opacity-70' : ''}`}
                >
                  <Link
                    to={`/project/${p.id}`}
                    className="flex-1 text-left px-4 py-3 hover:bg-cream/50 transition-colors min-w-0"
                  >
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-charcoal/50 truncate">{p.propertyAddress}</p>
                    {p.designer && (
                      <p className="text-xs text-charcoal/40 mt-1">{p.designer.name} · {p.designer.firm}</p>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleArchiveProject(p.id, p.isActive === false)}
                    disabled={actionLoading}
                    className="shrink-0 px-3 text-[10px] uppercase tracking-wider text-gold hover:bg-cream/50 min-w-[72px]"
                  >
                    {p.isActive === false ? 'Restore' : 'Archive'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white border border-cream-dark">
          <div className="px-4 py-3 border-b border-cream-dark flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-gold" />
              <h2 className="text-sm uppercase tracking-wider font-medium">Contact Messages</h2>
            </div>
            <SearchField
              value={messageSearch}
              onChange={setMessageSearch}
              placeholder="Search messages…"
              className="sm:w-56"
            />
          </div>
          <div className="divide-y divide-cream-dark max-h-64 overflow-y-auto">
            {filteredMessages.length === 0 && (
              <p className="px-4 py-6 text-sm text-charcoal/50 text-center">No messages.</p>
            )}
            {filteredMessages.map((m) => (
              <div
                key={m.id}
                className={`px-4 py-3 ${!m.isRead ? 'bg-gold/5' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{m.name} · {m.email}</p>
                    <p className="text-xs text-charcoal/50">{m.subject}</p>
                    <p className="text-xs text-charcoal/60 mt-1 line-clamp-2">{m.message}</p>
                  </div>
                  {!m.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(m.id)}
                      className="shrink-0 text-[10px] uppercase tracking-wider text-gold min-h-[44px] px-2"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 bg-white border border-cream-dark">
          <div className="px-4 py-3 border-b border-cream-dark flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Warehouse size={16} className="text-gold" />
              <h2 className="text-sm uppercase tracking-wider font-medium">Warehouses</h2>
            </div>
            <button
              type="button"
              onClick={() => setShowWarehouseForm((v) => !v)}
              className="text-xs uppercase tracking-wider text-gold min-h-[44px] px-3"
            >
              {showWarehouseForm ? 'Cancel' : 'Add warehouse'}
            </button>
          </div>
          {showWarehouseForm && (
            <div className="p-4 border-b border-cream-dark grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Name">
                <input className={inputClass} value={newWarehouse.name} onChange={(e) => setNewWarehouse((w) => ({ ...w, name: e.target.value }))} />
              </FormField>
              <FormField label="Address">
                <input className={inputClass} value={newWarehouse.address} onChange={(e) => setNewWarehouse((w) => ({ ...w, address: e.target.value }))} />
              </FormField>
              <FormField label="City">
                <input className={inputClass} value={newWarehouse.city} onChange={(e) => setNewWarehouse((w) => ({ ...w, city: e.target.value }))} />
              </FormField>
              <FormField label="State">
                <input className={inputClass} value={newWarehouse.state} onChange={(e) => setNewWarehouse((w) => ({ ...w, state: e.target.value }))} />
              </FormField>
              <FormField label="ZIP">
                <input className={inputClass} value={newWarehouse.zip} onChange={(e) => setNewWarehouse((w) => ({ ...w, zip: e.target.value }))} />
              </FormField>
              <FormField label="Notes">
                <textarea className={textareaClass} rows={2} value={newWarehouse.notes} onChange={(e) => setNewWarehouse((w) => ({ ...w, notes: e.target.value }))} />
              </FormField>
              <p className="text-xs text-charcoal/50 md:col-span-2">Address is geocoded on save — used to calculate quote mileage to the nearest warehouse.</p>
              <Button onClick={handleAddWarehouse} loading={actionLoading} className="md:col-span-2 min-h-[48px]">
                Save warehouse
              </Button>
            </div>
          )}
          <div className="divide-y divide-cream-dark">
            {storageLocations.length === 0 && (
              <p className="px-4 py-6 text-sm text-charcoal/50 text-center">No warehouses yet — add at least one for quote mileage.</p>
            )}
            {storageLocations.map((w) => (
              <div key={w.id} className={`px-4 py-3 flex items-center justify-between gap-4 ${!w.isActive ? 'opacity-60' : ''}`}>
                <div>
                  <p className="text-sm font-medium">{w.name}</p>
                  <p className="text-xs text-charcoal/50">{w.address}{w.city ? `, ${w.city}` : ''}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => handleToggleWarehouse(w)} className="text-[10px] uppercase tracking-wider text-gold min-h-[44px] px-2">
                    {w.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" onClick={() => handleDeleteWarehouse(w.id)} className="text-[10px] uppercase tracking-wider text-red-600 min-h-[44px] px-2">
                    <Trash2 size={12} className="inline mr-1" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0 bg-charcoal/50" onClick={() => setShowNewProject(false)} />
          <div className="relative w-full max-w-lg bg-cream p-6 md:rounded max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif text-xl mb-4">New Project</h3>
            <div className="space-y-4">
              <FormField label="Project Name">
                <input className={inputClass} value={newProject.name} onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))} />
              </FormField>
              <DesignerAssignFields
                mode={designerMode}
                onModeChange={setDesignerMode}
                designerId={newProject.designerId}
                onDesignerIdChange={(id) => setNewProject((p) => ({ ...p, designerId: id }))}
                designers={designers}
                newDesigner={newDesigner}
                onNewDesignerChange={setNewDesigner}
              />
              <ClientAssignFields
                mode={clientMode}
                onModeChange={setClientMode}
                clientId={newProject.clientId}
                onClientIdChange={(id) => setNewProject((p) => ({ ...p, clientId: id }))}
                clients={clients}
                newClient={newClient}
                onNewClientChange={setNewClient}
              />
              <FormField label="Property Address">
                <input className={inputClass} value={newProject.propertyAddress} onChange={(e) => setNewProject((p) => ({ ...p, propertyAddress: e.target.value }))} />
              </FormField>
              <FormField label="City">
                <input className={inputClass} value={newProject.propertyCity} onChange={(e) => setNewProject((p) => ({ ...p, propertyCity: e.target.value }))} />
              </FormField>
              <FormField label="Description">
                <textarea className={textareaClass} rows={3} value={newProject.description} onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))} />
              </FormField>
              <FormField label="Target Install Date">
                <input type="date" className={inputClass} value={newProject.targetInstallDate} onChange={(e) => setNewProject((p) => ({ ...p, targetInstallDate: e.target.value }))} />
              </FormField>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowNewProject(false)} className="flex-1 min-h-[48px]">Cancel</Button>
              <Button
                onClick={handleCreateProject}
                loading={actionLoading}
                disabled={!newProject.name || !newProject.propertyAddress || !isDesignerReady || !isClientReady}
                className="flex-1 min-h-[48px]"
              >
                <FolderPlus size={14} className="mr-2" /> Create Project
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
