import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  History,
  Loader2,
  Menu,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  getAdminSiteMenu,
  getSiteMenuVersion,
  getSiteMenuVersions,
  restoreSiteMenuVersion,
  saveAdminSiteMenu,
} from '../api/client';
import { Button, FormField, inputClass } from '../components/Layout';
import type {
  SiteMenuConfig,
  SiteMenuMobileNavItem,
  SiteMenuNavItem,
  SiteMenuVersionDetail,
  SiteMenuVersionSummary,
  SiteMenuVisibility,
} from '../types/siteMenu';

type MenuSection = 'headerNav' | 'footerNav' | 'mobileNav';

const SECTION_META: Record<
  MenuSection,
  { title: string; description: string; showVisibility: boolean; showIcon: boolean }
> = {
  headerNav: {
    title: 'Header navigation',
    description: 'Links shown in the desktop and mobile header menu.',
    showVisibility: true,
    showIcon: false,
  },
  footerNav: {
    title: 'Footer quick links',
    description: 'Links shown in the site footer.',
    showVisibility: false,
    showIcon: false,
  },
  mobileNav: {
    title: 'Mobile bottom navigation',
    description: 'Icons and labels for the fixed bottom bar on small screens.',
    showVisibility: true,
    showIcon: true,
  },
};

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function emptyNavItem(showVisibility: boolean): SiteMenuNavItem {
  return showVisibility
    ? { to: '/', label: 'New link', visibleWhen: 'always' }
    : { to: '/', label: 'New link' };
}

function emptyMobileItem(): SiteMenuMobileNavItem {
  return { to: '/', label: 'New link', icon: 'Home', visibleWhen: 'always' };
}

export function SiteMenuPage() {
  const [menu, setMenu] = useState<SiteMenuConfig | null>(null);
  const [publishedMenu, setPublishedMenu] = useState<SiteMenuConfig | null>(null);
  const [versions, setVersions] = useState<SiteMenuVersionSummary[]>([]);
  const [previewVersion, setPreviewVersion] = useState<SiteMenuVersionDetail | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadMenu = useCallback(async () => {
    const [adminState, history] = await Promise.all([
      getAdminSiteMenu(),
      getSiteMenuVersions(),
    ]);
    setMenu(adminState.menu);
    setPublishedMenu(adminState.publishedMenu);
    setVersions(history);
  }, []);

  useEffect(() => {
    loadMenu()
      .catch(() => setError('Unable to load site menu'))
      .finally(() => setLoading(false));
  }, [loadMenu]);

  const hasChanges =
    menu && publishedMenu
      ? JSON.stringify(menu) !== JSON.stringify(publishedMenu)
      : false;

  const updateSection = <K extends MenuSection>(
    section: K,
    updater: (items: SiteMenuConfig[K]) => SiteMenuConfig[K],
  ) => {
    setMenu((prev) => (prev ? { ...prev, [section]: updater(prev[section]) } : prev));
  };

  const handleSave = async () => {
    if (!menu) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveAdminSiteMenu({ menu, changeNote: changeNote.trim() || undefined });
      await loadMenu();
      setChangeNote('');
      setNotice('Site menu saved.');
    } catch {
      setError('Save failed. Check your links and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    setRestoring(true);
    setError('');
    setNotice('');
    try {
      await restoreSiteMenuVersion(versionId);
      await loadMenu();
      setPreviewVersion(null);
      setNotice('Restored menu version.');
    } catch {
      setError('Restore failed.');
    } finally {
      setRestoring(false);
    }
  };

  const handlePreviewVersion = async (versionId: string) => {
    try {
      const detail = await getSiteMenuVersion(versionId);
      setPreviewVersion(detail);
    } catch {
      setError('Unable to load version preview.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (!menu) {
    return <p className="text-center py-20 text-charcoal/50">{error || 'Site menu unavailable'}</p>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <Link to="/admin" className="text-sm text-gold hover:underline mb-2 inline-block">
            ← Dashboard
          </Link>
          <h1 className="font-serif text-2xl md:text-3xl text-charcoal flex items-center gap-2">
            <Menu size={24} className="text-gold" />
            Site Menu
          </h1>
          <p className="text-sm text-charcoal/60 mt-1">
            Manage public navigation links. Page copy stays in Site Content.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="inline-flex items-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save menu
        </Button>
      </div>

      {notice && (
        <p className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mb-6 rounded border border-cream-dark bg-white p-4">
        <FormField label="Change note (optional)">
          <input
            className={inputClass}
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="Describe what you changed"
          />
        </FormField>
        {hasChanges && (
          <p className="mt-2 text-xs text-amber-700">You have unsaved menu changes.</p>
        )}
      </div>

      <div className="space-y-8">
        {(Object.keys(SECTION_META) as MenuSection[]).map((section) => {
          const meta = SECTION_META[section];
          const items = menu[section];

          return (
            <section key={section} className="rounded border border-cream-dark bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-cream-dark bg-cream/40">
                <h2 className="font-serif text-lg text-charcoal">{meta.title}</h2>
                <p className="text-sm text-charcoal/60">{meta.description}</p>
              </div>

              <div className="divide-y divide-cream-dark">
                {items.map((item, index) => (
                  <div key={`${section}-${index}`} className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FormField label="Path">
                        <input
                          className={inputClass}
                          value={item.to}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateSection(section, (current) =>
                              current.map((entry, i) =>
                                i === index ? { ...entry, to: value } : entry,
                              ),
                            );
                          }}
                        />
                      </FormField>
                      <FormField label="Label">
                        <input
                          className={inputClass}
                          value={item.label}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateSection(section, (current) =>
                              current.map((entry, i) =>
                                i === index ? { ...entry, label: value } : entry,
                              ),
                            );
                          }}
                        />
                      </FormField>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {meta.showIcon && (
                        <FormField label="Icon">
                          <input
                            className={inputClass}
                            value={'icon' in item ? (item.icon ?? '') : ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              updateSection(section, (current) =>
                                current.map((entry, i) =>
                                  i === index ? { ...entry, icon: value } : entry,
                                ),
                              );
                            }}
                            placeholder="Home, FolderOpen, LogIn"
                          />
                        </FormField>
                      )}
                      {meta.showVisibility && (
                        <FormField label="Visible when">
                          <select
                            className={inputClass}
                            value={item.visibleWhen ?? 'always'}
                            onChange={(e) => {
                              const value = e.target.value as SiteMenuVisibility;
                              updateSection(section, (current) =>
                                current.map((entry, i) =>
                                  i === index ? { ...entry, visibleWhen: value } : entry,
                                ),
                              );
                            }}
                          >
                            <option value="always">Always</option>
                            <option value="loggedIn">Logged in</option>
                            <option value="loggedOut">Logged out</option>
                          </select>
                        </FormField>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="inline-flex items-center gap-1"
                        onClick={() =>
                          updateSection(section, (current) => moveItem(current, index, -1))
                        }
                        disabled={index === 0}
                      >
                        <ArrowUp size={14} /> Up
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="inline-flex items-center gap-1"
                        onClick={() =>
                          updateSection(section, (current) => moveItem(current, index, 1))
                        }
                        disabled={index === items.length - 1}
                      >
                        <ArrowDown size={14} /> Down
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="inline-flex items-center gap-1 text-red-700"
                        onClick={() =>
                          updateSection(section, (current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 size={14} /> Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 border-t border-cream-dark bg-cream/20">
                <Button
                  type="button"
                  variant="secondary"
                  className="inline-flex items-center gap-2"
                  onClick={() =>
                    updateSection(section, (current) => [
                      ...current,
                      section === 'mobileNav' ? emptyMobileItem() : emptyNavItem(meta.showVisibility),
                    ])
                  }
                >
                  <Plus size={16} /> Add link
                </Button>
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-10 rounded border border-cream-dark bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-cream-dark bg-cream/40 flex items-center gap-2">
          <History size={18} className="text-gold" />
          <h2 className="font-serif text-lg text-charcoal">Version history</h2>
        </div>
        {versions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-charcoal/50">No saved versions yet.</p>
        ) : (
          <ul className="divide-y divide-cream-dark">
            {versions.map((version) => (
              <li key={version.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-charcoal">
                    {version.changeNote || 'Updated site menu'}
                  </p>
                  <p className="text-xs text-charcoal/50 mt-1">
                    {version.changedByName} · {formatWhen(version.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handlePreviewVersion(version.id)}
                  >
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="inline-flex items-center gap-1"
                    disabled={restoring}
                    onClick={() => void handleRestore(version.id)}
                  >
                    <RotateCcw size={14} /> Restore
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {previewVersion && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded bg-white border border-cream-dark shadow-xl">
            <div className="px-4 py-3 border-b border-cream-dark flex items-center justify-between">
              <h3 className="font-serif text-lg">Version preview</h3>
              <Button type="button" variant="secondary" onClick={() => setPreviewVersion(null)}>
                Close
              </Button>
            </div>
            <pre className="p-4 text-xs overflow-auto whitespace-pre-wrap">
              {JSON.stringify(previewVersion.parsedContent, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
