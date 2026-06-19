import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Shield, Trash2, Pencil, X, Save } from 'lucide-react';
import {
  createAdminRole,
  deleteAdminRole,
  getAdminRoles,
  getPermissionCatalog,
  updateAdminRole,
} from '../api/client';
import type { AppRoleRecord, CreateAppRoleForm, Permission, PermissionDefinition } from '../types';
import { Button, FormField, inputClass } from './Layout';

function groupPermissions(catalog: PermissionDefinition[]) {
  const groups = new Map<string, PermissionDefinition[]>();
  for (const item of catalog) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return [...groups.entries()];
}

function PermissionGrid({
  catalog,
  selected,
  onChange,
  disabled,
}: {
  catalog: PermissionDefinition[];
  selected: Permission[];
  onChange: (next: Permission[]) => void;
  disabled?: boolean;
}) {
  const grouped = useMemo(() => groupPermissions(catalog), [catalog]);

  const toggle = (key: Permission) => {
    if (disabled) return;
    onChange(
      selected.includes(key) ? selected.filter((p) => p !== key) : [...selected, key],
    );
  };

  return (
    <div className="space-y-4">
      {grouped.map(([group, items]) => (
        <div key={group}>
          <p className="text-xs uppercase tracking-wider text-charcoal/50 mb-2">{group}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {items.map((item) => (
              <label
                key={item.key}
                className={`flex items-start gap-2 p-3 border rounded text-sm cursor-pointer ${
                  selected.includes(item.key)
                    ? 'border-gold/50 bg-gold/5'
                    : 'border-cream-dark hover:border-charcoal/20'
                } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.includes(item.key)}
                  disabled={disabled}
                  onChange={() => toggle(item.key)}
                />
                <span>
                  <span className="font-medium text-charcoal block">{item.label}</span>
                  <span className="text-xs text-charcoal/50">{item.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoleManager() {
  const [roles, setRoles] = useState<AppRoleRecord[]>([]);
  const [catalog, setCatalog] = useState<PermissionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AppRoleRecord | null>(null);
  const [createForm, setCreateForm] = useState<CreateAppRoleForm>({
    slug: '',
    name: '',
    description: '',
    permissions: [],
  });
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    permissions: Permission[];
    isActive: boolean;
  }>({ name: '', description: '', permissions: [], isActive: true });

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([getAdminRoles(), getPermissionCatalog()])
      .then(([r, c]) => {
        setRoles(r);
        setCatalog(c);
      })
      .catch(() => setError('Unable to load roles'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (role: AppRoleRecord) => {
    setEditing(role);
    setEditForm({
      name: role.name,
      description: role.description ?? '',
      permissions: role.permissions,
      isActive: role.isActive,
    });
    setShowCreate(false);
    setNotice('');
    setError('');
  };

  const handleCreate = async () => {
    setSavingId('create');
    setError('');
    setNotice('');
    try {
      await createAdminRole({
        slug: createForm.slug.trim(),
        name: createForm.name.trim(),
        description: createForm.description?.trim() || undefined,
        permissions: createForm.permissions,
      });
      setShowCreate(false);
      setCreateForm({ slug: '', name: '', description: '', permissions: [] });
      setNotice('Role created.');
      load();
    } catch {
      setError('Could not create role. Check the slug and permissions.');
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSavingId(editing.id);
    setError('');
    setNotice('');
    try {
      await updateAdminRole(editing.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        permissions: editForm.permissions,
        isActive: editForm.isActive,
      });
      setEditing(null);
      setNotice('Role updated.');
      load();
    } catch {
      setError('Could not save role changes.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (role: AppRoleRecord) => {
    if (role.isSystem || role.userCount > 0) return;
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    setSavingId(role.id);
    setError('');
    setNotice('');
    try {
      await deleteAdminRole(role.id);
      if (editing?.id === role.id) setEditing(null);
      setNotice('Role deleted.');
      load();
    } catch {
      setError('Could not delete role. Reassign users first.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-gold" size={28} />
      </div>
    );
  }

  return (
    <section className="bg-white border border-cream-dark p-5 md:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm uppercase tracking-wider font-medium text-charcoal flex items-center gap-2">
            <Shield size={16} className="text-gold" />
            User types & permissions
          </h2>
          <p className="text-xs text-charcoal/50 mt-1 max-w-xl">
            Create roles and choose what each can do — quotes, projects, users, settings, and more.
            Assign roles when creating or editing users.
          </p>
        </div>
        {!showCreate && !editing && (
          <Button type="button" onClick={() => { setShowCreate(true); setEditing(null); setError(''); }}>
            <Plus size={16} className="mr-2" />
            New role
          </Button>
        )}
      </div>

      {notice && (
        <p className="mb-4 px-4 py-3 bg-emerald-50 text-emerald-800 text-sm border border-emerald-200">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-4 px-4 py-3 bg-red-50 text-red-800 text-sm border border-red-200">{error}</p>
      )}

      {showCreate && (
        <div className="mb-6 p-4 border border-gold/30 bg-gold/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-charcoal">Create role</h3>
            <button type="button" onClick={() => setShowCreate(false)} className="text-charcoal/50 hover:text-charcoal">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormField label="Display name">
              <input
                className={inputClass}
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Operations Manager"
              />
            </FormField>
            <FormField label="Slug (login role key)">
              <input
                className={inputClass}
                value={createForm.slug}
                onChange={(e) => setCreateForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                placeholder="operations_manager"
              />
              <p className="text-xs text-charcoal/40 mt-1">Lowercase letters, numbers, underscores</p>
            </FormField>
            <div className="md:col-span-2">
            <FormField label="Description">
              <input
                className={inputClass}
                value={createForm.description ?? ''}
                onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional summary for admins"
              />
            </FormField>
            </div>
          </div>
          <PermissionGrid
            catalog={catalog}
            selected={createForm.permissions}
            onChange={(permissions) => setCreateForm((p) => ({ ...p, permissions }))}
          />
          <div className="flex gap-2 mt-4">
            <Button
              type="button"
              loading={savingId === 'create'}
              disabled={!createForm.name.trim() || !createForm.slug.trim() || createForm.permissions.length === 0}
              onClick={() => void handleCreate()}
            >
              <Save size={16} className="mr-2" />
              Create role
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mb-6 p-4 border border-gold/30 bg-gold/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-charcoal">Edit {editing.name}</h3>
              <p className="text-xs text-charcoal/50 font-mono">{editing.slug}</p>
            </div>
            <button type="button" onClick={() => setEditing(null)} className="text-charcoal/50 hover:text-charcoal">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormField label="Display name">
              <input
                className={inputClass}
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </FormField>
            <FormField label="Description">
              <input
                className={inputClass}
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              />
            </FormField>
            {!editing.isSystem && (
              <label className="flex items-center gap-2 text-sm text-charcoal md:col-span-2">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                Role is active (can be assigned to users)
              </label>
            )}
          </div>
          <PermissionGrid
            catalog={catalog}
            selected={editForm.permissions}
            onChange={(permissions) => setEditForm((p) => ({ ...p, permissions }))}
          />
          <div className="flex gap-2 mt-4">
            <Button
              type="button"
              loading={savingId === editing.id}
              disabled={!editForm.name.trim() || editForm.permissions.length === 0}
              onClick={() => void handleSaveEdit()}
            >
              <Save size={16} className="mr-2" />
              Save changes
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {roles.map((role) => (
          <div
            key={role.id}
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded ${
              role.isActive ? 'border-cream-dark' : 'border-charcoal/10 bg-charcoal/5 opacity-75'
            }`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-charcoal">{role.name}</p>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-charcoal/5 text-charcoal/60 rounded font-mono">
                  {role.slug}
                </span>
                {role.isSystem && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-gold/15 text-gold rounded">
                    System
                  </span>
                )}
                {!role.isActive && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-charcoal/10 text-charcoal/50 rounded">
                    Inactive
                  </span>
                )}
              </div>
              {role.description && (
                <p className="text-sm text-charcoal/50 mt-1">{role.description}</p>
              )}
              <p className="text-xs text-charcoal/40 mt-1">
                {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'} ·{' '}
                {role.userCount} user{role.userCount === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="secondary" onClick={() => openEdit(role)}>
                <Pencil size={14} className="mr-1.5" />
                Edit
              </Button>
              {!role.isSystem && role.userCount === 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  loading={savingId === role.id}
                  onClick={() => void handleDelete(role)}
                  className="text-red-700 border-red-200 hover:bg-red-50"
                >
                  <Trash2 size={14} className="mr-1.5" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
