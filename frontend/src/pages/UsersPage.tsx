import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  getAdminDesigners,
  getAdminClients,
  getAdminUserWork,
  getAssignableRoles,
} from '../api/client';
import type { AdminUserRecord, AssignableRole, CreateAdminUserForm, Designer, Client, UserRole, UserWorkDetail } from '../types';
import { Button, FormField, inputClass, selectClass } from '../components/Layout';
import { SearchField, matchesSearch } from '../components/SearchField';
import { formatDate } from '../lib/labels';
import { useAuth } from '../context/AuthContext';
import { PERMISSIONS } from '../lib/permissions';
import { Loader2, Plus, Users, Pencil, X, Briefcase, ExternalLink } from 'lucide-react';

function roleLabel(slug: string, roles: AssignableRole[]) {
  return roles.find((r) => r.slug === slug)?.name ?? slug;
}

export function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const canManageUsers = hasPermission(PERMISSIONS.USERS_MANAGE);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<AssignableRole[]>([]);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminUserRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [workDetail, setWorkDetail] = useState<UserWorkDetail | null>(null);
  const [workLoading, setWorkLoading] = useState(false);

  const [createProfileMode, setCreateProfileMode] = useState<'existing' | 'new'>('new');

  const [createForm, setCreateForm] = useState<CreateAdminUserForm>({
    name: '',
    email: '',
    password: '',
    role: 'client',
    designerId: '',
    clientId: '',
    newDesigner: { name: '', firm: '', phone: '', city: '' },
    newClient: { phone: '', address: '', city: '' },
  });

  const [editForm, setEditForm] = useState({
    name: '',
    role: 'client' as UserRole,
    isActive: true,
    password: '',
    designerId: '',
    clientId: '',
  });

  const load = () => {
    setLoading(true);
    Promise.all([getAdminUsers(), getAdminDesigners(), getAdminClients(), getAssignableRoles()])
      .then(([u, d, c, roles]) => {
        setUsers(u);
        setDesigners(d);
        setClients(c);
        setAssignableRoles(roles);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        if (roleFilter !== 'all' && u.role !== roleFilter) return false;
        if (statusFilter === 'active' && !u.isActive) return false;
        if (statusFilter === 'inactive' && u.isActive) return false;
        return matchesSearch(
          search,
          u.name,
          u.email,
          u.role,
          u.designer?.firm,
          u.designer?.name,
          u.client?.name,
        );
      }),
    [users, search, roleFilter, statusFilter],
  );

  const openEdit = (user: AdminUserRecord) => {
    setEditing(user);
    setWorkDetail(null);
    setEditForm({
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      password: '',
      designerId: user.designerId || '',
      clientId: user.clientId || '',
    });
    if (user.role !== 'admin') {
      setWorkLoading(true);
      getAdminUserWork(user.id)
        .then(setWorkDetail)
        .catch(() => setWorkDetail(null))
        .finally(() => setWorkLoading(false));
    }
  };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.email || createForm.password.length < 6) return;
    setSaving(true);
    try {
      const payload: CreateAdminUserForm = {
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        role: createForm.role,
      };
      if (createForm.role === 'designer') {
        if (createProfileMode === 'existing' && createForm.designerId) payload.designerId = createForm.designerId;
        else if (createForm.newDesigner?.name && createForm.newDesigner.firm) {
          payload.newDesigner = {
            name: createForm.newDesigner.name,
            firm: createForm.newDesigner.firm,
            phone: createForm.newDesigner.phone || undefined,
            city: createForm.newDesigner.city || undefined,
          };
        }
      }
      if (createForm.role === 'client') {
        if (createProfileMode === 'existing' && createForm.clientId) payload.clientId = createForm.clientId;
        else if (createForm.newClient) {
          payload.newClient = {
            phone: createForm.newClient.phone || undefined,
            address: createForm.newClient.address || undefined,
            city: createForm.newClient.city || undefined,
          };
        }
      }
      await createAdminUser(payload);
      setShowCreate(false);
      setCreateForm({
        name: '', email: '', password: '', role: 'client',
        designerId: '', clientId: '',
        newDesigner: { name: '', firm: '', phone: '', city: '' },
        newClient: { phone: '', address: '', city: '' },
      });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);
    setActionError('');
    try {
      await updateAdminUser(editing.id, {
        name: editForm.name,
        role: editForm.role,
        isActive: editForm.isActive,
        password: editForm.password || undefined,
        designerId: editForm.role === 'designer' ? editForm.designerId || null : null,
        clientId: editForm.role === 'client' ? editForm.clientId || null : null,
      });
      setEditing(null);
      load();
    } catch {
      setActionError('Unable to save user changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: AdminUserRecord) => {
    if (user.id === currentUser?.id && user.isActive) {
      setActionError('You cannot deactivate your own account.');
      return;
    }
    setTogglingId(user.id);
    setActionError('');
    try {
      await updateAdminUser(user.id, { isActive: !user.isActive });
      load();
    } catch {
      setActionError(
        user.id === currentUser?.id
          ? 'You cannot deactivate your own account.'
          : 'Unable to update account status.',
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  return (
    <section className="max-w-5xl mx-auto px-4 py-6 md:py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs text-charcoal/50 max-w-xl">
            Team logins, interior designers, and clients — manage roles, linked profiles, and quote/project volume.
          </p>
        </div>
        {canManageUsers && (
          <Button onClick={() => { setShowCreate(true); setCreateProfileMode('new'); }} className="min-h-[44px] shrink-0">
            <Plus size={14} className="mr-2" /> Add User
          </Button>
        )}
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2">{actionError}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search name, email, firm…"
          className="flex-1"
        />
        <select
          className={`${selectClass} sm:w-44 min-h-[44px]`}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
        >
          <option value="all">All roles</option>
          {assignableRoles.map((r) => (
            <option key={r.slug} value={r.slug}>{r.name}</option>
          ))}
        </select>
        <select
          className={`${selectClass} sm:w-44 min-h-[44px]`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      <div className="bg-white border border-cream-dark divide-y divide-cream-dark">
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-sm text-charcoal/50 text-center">No users match your search.</p>
        )}
        {filtered.map((u) => (
          <div key={u.id} className={`px-4 py-3 flex items-start justify-between gap-3 ${!u.isActive ? 'opacity-60 bg-cream/30' : ''}`}>
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-2 flex-wrap">
                {u.name}
                <span className="text-[10px] uppercase tracking-wider border border-cream-dark px-1.5 py-0.5 text-charcoal/60">
                  {roleLabel(u.role, assignableRoles)}
                </span>
                {!u.isActive && (
                  <span className="text-[10px] uppercase tracking-wider text-charcoal/40">Inactive</span>
                )}
              </p>
              <p className="text-xs text-charcoal/50">{u.email}</p>
              {u.designer && (
                <p className="text-xs text-charcoal/60 mt-1">Designer: {u.designer.name} — {u.designer.firm}</p>
              )}
              {u.client && (
                <p className="text-xs text-charcoal/60 mt-1">Client profile: {u.client.name}</p>
              )}
              {u.role !== 'admin' && u.workSummary && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <WorkStat label="Quoted" value={u.workSummary.quoted} />
                  <WorkStat label="In progress" value={u.workSummary.inProgress} />
                  <WorkStat label="Finished" value={u.workSummary.finished} />
                </div>
              )}
              <p className="text-[10px] text-charcoal/40 mt-1">Added {formatDate(u.createdAt.slice(0, 10))}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canManageUsers && (
              <>
              <button
                type="button"
                onClick={() => handleToggleActive(u)}
                disabled={togglingId === u.id || (u.isActive && u.id === currentUser?.id)}
                title={u.isActive && u.id === currentUser?.id ? 'You cannot deactivate your own account' : undefined}
                className="text-[10px] uppercase tracking-wider text-gold min-h-[44px] px-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {togglingId === u.id ? 'Saving…' : u.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                type="button"
                onClick={() => openEdit(u)}
                className="flex items-center gap-1 text-xs uppercase tracking-wider text-gold min-h-[44px] px-2"
              >
                <Pencil size={14} /> Edit
              </button>
              </>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <UserFormModal title="Add User" onClose={() => setShowCreate(false)}>
          <UserFormFields
            role={createForm.role}
            onRoleChange={(role) => setCreateForm((p) => ({ ...p, role }))}
            name={createForm.name}
            onNameChange={(name) => setCreateForm((p) => ({ ...p, name }))}
            email={createForm.email}
            onEmailChange={(email) => setCreateForm((p) => ({ ...p, email }))}
            password={createForm.password}
            onPasswordChange={(password) => setCreateForm((p) => ({ ...p, password }))}
            designerId={createForm.designerId || ''}
            onDesignerIdChange={(designerId) => setCreateForm((p) => ({ ...p, designerId }))}
            clientId={createForm.clientId || ''}
            onClientIdChange={(clientId) => setCreateForm((p) => ({ ...p, clientId }))}
            newDesigner={createForm.newDesigner!}
            onNewDesignerChange={(newDesigner) => setCreateForm((p) => ({ ...p, newDesigner }))}
            newClient={createForm.newClient!}
            onNewClientChange={(newClient) => setCreateForm((p) => ({ ...p, newClient }))}
            designers={designers}
            clients={clients}
            assignableRoles={assignableRoles}
            profileMode={createProfileMode}
            onProfileModeChange={setCreateProfileMode}
          />
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1 min-h-[48px]">Cancel</Button>
            <Button onClick={handleCreate} loading={saving} className="flex-1 min-h-[48px]">Create User</Button>
          </div>
        </UserFormModal>
      )}

      {editing && (
        <UserFormModal title={`Edit — ${editing.name}`} onClose={() => setEditing(null)}>
          <FormField label="Name" required>
            <input className={inputClass} value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
          </FormField>
          <FormField label="Email">
            <input className={inputClass} value={editing.email} disabled />
          </FormField>
          <FormField label="Role" required>
            <select className={selectClass} value={editForm.role} onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as UserRole }))}>
              {assignableRoles.map((r) => (
                <option key={r.slug} value={r.slug}>{r.name}</option>
              ))}
            </select>
          </FormField>
          {editForm.role === 'designer' && (
            <FormField label="Linked designer profile" required>
              <select className={selectClass} value={editForm.designerId} onChange={(e) => setEditForm((p) => ({ ...p, designerId: e.target.value }))}>
                <option value="">Select designer…</option>
                {designers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} — {d.firm}</option>
                ))}
              </select>
            </FormField>
          )}
          {editForm.role === 'client' && (
            <FormField label="Linked client profile" required>
              <select className={selectClass} value={editForm.clientId} onChange={(e) => setEditForm((p) => ({ ...p, clientId: e.target.value }))}>
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="New password (optional)">
            <input type="password" className={inputClass} value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))} placeholder="Leave blank to keep current" minLength={6} />
          </FormField>
          <label className="flex items-center gap-2 text-sm mt-4 min-h-[44px]">
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))} />
            Account active (can sign in)
          </label>

          {editing.role !== 'admin' && (
            <div className="mt-6 border-t border-cream-dark pt-4">
              <h4 className="text-sm uppercase tracking-wider font-medium flex items-center gap-2 mb-3">
                <Briefcase size={14} className="text-gold" /> Quotes & Projects
              </h4>
              {workLoading && (
                <div className="flex items-center gap-2 text-xs text-charcoal/50 py-4">
                  <Loader2 size={14} className="animate-spin" /> Loading work history…
                </div>
              )}
              {!workLoading && workDetail && (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <WorkStat label="Quoted" value={workDetail.quoted} />
                    <WorkStat label="In progress" value={workDetail.inProgress} />
                    <WorkStat label="Finished" value={workDetail.finished} />
                  </div>
                  {workDetail.items.length === 0 ? (
                    <p className="text-xs text-charcoal/50">No quotes or projects linked to this user yet.</p>
                  ) : (
                    <ul className="max-h-48 overflow-y-auto border border-cream-dark divide-y divide-cream-dark">
                      {workDetail.items.map((item) => (
                        <li key={`${item.kind}-${item.id}`} className="px-3 py-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-charcoal truncate">{item.title}</p>
                            <p className="text-[10px] text-charcoal/50 mt-0.5">
                              {item.kind === 'quote' ? 'Quote' : 'Project'} · {item.statusLabel}
                              {!item.isActive && ' · Archived'}
                            </p>
                            <p className="text-[10px] text-charcoal/40">{formatDate(item.updatedAt.slice(0, 10))}</p>
                          </div>
                          {item.projectId && (
                            <Link
                              to={`/project/${item.projectId}`}
                              className="shrink-0 text-[10px] uppercase tracking-wider text-gold flex items-center gap-1 min-h-[44px] px-1"
                            >
                              <ExternalLink size={12} /> Open
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setEditing(null)} className="flex-1 min-h-[48px]">Cancel</Button>
            <Button onClick={handleUpdate} loading={saving} className="flex-1 min-h-[48px]">Save Changes</Button>
          </div>
        </UserFormModal>
      )}
    </section>
  );
}

function WorkStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-[10px] uppercase tracking-wider border border-cream-dark px-2 py-1 bg-cream/40">
      {label}: <span className="font-medium text-charcoal">{value}</span>
    </span>
  );
}

function UserFormModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-charcoal/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-cream p-6 md:rounded max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl flex items-center gap-2">
            <Users size={18} className="text-gold" /> {title}
          </h3>
          <button type="button" onClick={onClose} className="p-2 text-charcoal/40 min-h-[44px] min-w-[44px]">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function UserFormFields({
  role,
  onRoleChange,
  name,
  onNameChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  designerId,
  onDesignerIdChange,
  clientId,
  onClientIdChange,
  newDesigner,
  onNewDesignerChange,
  newClient,
  onNewClientChange,
  designers,
  clients,
  assignableRoles,
  profileMode,
  onProfileModeChange,
}: {
  role: UserRole;
  onRoleChange: (r: UserRole) => void;
  name: string;
  onNameChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
  password: string;
  onPasswordChange: (v: string) => void;
  designerId: string;
  onDesignerIdChange: (v: string) => void;
  clientId: string;
  onClientIdChange: (v: string) => void;
  newDesigner: { name: string; firm: string; phone?: string; city?: string };
  onNewDesignerChange: (v: { name: string; firm: string; phone?: string; city?: string }) => void;
  newClient: { phone?: string; address?: string; city?: string };
  onNewClientChange: (v: { phone?: string; address?: string; city?: string }) => void;
  designers: Designer[];
  clients: Client[];
  assignableRoles: AssignableRole[];
  profileMode: 'existing' | 'new';
  onProfileModeChange: (m: 'existing' | 'new') => void;
}) {
  return (
    <div className="space-y-4">
      <FormField label="Full name" required>
        <input className={inputClass} value={name} onChange={(e) => onNameChange(e.target.value)} />
      </FormField>
      <FormField label="Email (login)" required>
        <input type="email" className={inputClass} value={email} onChange={(e) => onEmailChange(e.target.value)} />
      </FormField>
      <FormField label="Password" required>
        <input type="password" className={inputClass} value={password} onChange={(e) => onPasswordChange(e.target.value)} minLength={6} />
      </FormField>
      <FormField label="Role" required>
        <select className={selectClass} value={role} onChange={(e) => onRoleChange(e.target.value as UserRole)}>
          {assignableRoles.map((r) => (
            <option key={r.slug} value={r.slug}>{r.name}</option>
          ))}
        </select>
      </FormField>

      {role === 'designer' && (
        <>
          <div className="flex gap-1">
            {(['existing', 'new'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onProfileModeChange(m)}
                className={`flex-1 py-2 text-xs uppercase tracking-wider border min-h-[40px] ${
                  profileMode === m ? 'border-gold bg-gold/10 text-charcoal' : 'border-cream-dark text-charcoal/50'
                }`}
              >
                {m === 'existing' ? 'Existing profile' : 'New profile'}
              </button>
            ))}
          </div>
          {profileMode === 'existing' ? (
            <FormField label="Designer profile" required>
              <select className={selectClass} value={designerId} onChange={(e) => onDesignerIdChange(e.target.value)}>
                <option value="">Select…</option>
                {designers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} — {d.firm}</option>
                ))}
              </select>
            </FormField>
          ) : (
            <div className="space-y-3 border border-cream-dark p-3">
              <input className={inputClass} placeholder="Designer name" value={newDesigner.name} onChange={(e) => onNewDesignerChange({ ...newDesigner, name: e.target.value })} />
              <input className={inputClass} placeholder="Design firm" value={newDesigner.firm} onChange={(e) => onNewDesignerChange({ ...newDesigner, firm: e.target.value })} />
            </div>
          )}
        </>
      )}

      {role === 'client' && (
        <>
          <div className="flex gap-1">
            {(['existing', 'new'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onProfileModeChange(m)}
                className={`flex-1 py-2 text-xs uppercase tracking-wider border min-h-[40px] ${
                  profileMode === m ? 'border-gold bg-gold/10 text-charcoal' : 'border-cream-dark text-charcoal/50'
                }`}
              >
                {m === 'existing' ? 'Existing profile' : 'New profile'}
              </button>
            ))}
          </div>
          {profileMode === 'existing' ? (
            <FormField label="Client profile" required>
              <select className={selectClass} value={clientId} onChange={(e) => onClientIdChange(e.target.value)}>
                <option value="">Select…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                ))}
              </select>
            </FormField>
          ) : (
            <div className="space-y-3 border border-cream-dark p-3">
              <input className={inputClass} placeholder="Phone" value={newClient.phone || ''} onChange={(e) => onNewClientChange({ ...newClient, phone: e.target.value })} />
              <input className={inputClass} placeholder="Address" value={newClient.address || ''} onChange={(e) => onNewClientChange({ ...newClient, address: e.target.value })} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
