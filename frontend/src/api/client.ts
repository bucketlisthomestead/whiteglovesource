import axios from 'axios';
import type {
  AuthResponse,
  ContactForm,
  CreateProjectForm,
  UpdateProjectForm,
  CreateProjectFromQuoteForm,
  CreateSignoffForm,
  DashboardData,
  Designer,
  Client,
  Piece,
  PieceEvent,
  PieceEventForm,
  Project,
  ProjectPhase,
  QuoteForm,
  QuoteLeadForm,
  CompleteQuoteForm,
  QuoteEstimate,
  QuoteEstimateInput,
  QuoteRequest,
  Signoff,
  SyncMutation,
} from '../types';

const TOKEN_KEY = 'wgds_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export const login = (email: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data);

export const getDemoProject = () =>
  api.get<Project>('/projects/demo').then((r) => r.data);

export const getProject = (id: string) =>
  api.get<Project>(`/projects/${id}`).then((r) => r.data);

export const getMyProjects = () =>
  api.get<Project[]>('/projects/my').then((r) => r.data);

export const getPiece = (id: string) =>
  api.get<Piece & { events: PieceEvent[] }>(`/projects/pieces/${id}`).then((r) => r.data);

export const submitContact = (data: ContactForm) =>
  api.post('/contact', data).then((r) => r.data);

export const submitQuote = (data: QuoteForm) =>
  api.post('/quotes', data).then((r) => r.data);

export const startQuoteLead = (data: QuoteLeadForm) =>
  api.post<QuoteRequest>('/quotes/lead', data).then((r) => r.data);

export const completeQuote = (id: string, data: CompleteQuoteForm) =>
  api.patch<QuoteRequest>(`/quotes/${id}`, data).then((r) => r.data);

export const estimateQuote = (data: QuoteEstimateInput) =>
  api.post<QuoteEstimate>('/quotes/estimate', data).then((r) => r.data);

export const getPieceCatalog = () =>
  api.get<import('../types').PieceCatalogItem[]>('/catalog/pieces').then((r) => r.data);

export const addPieceEvent = (pieceId: string, data: PieceEventForm) =>
  api.post(`/projects/pieces/${pieceId}/events`, data).then((r) => r.data);

export const createSignoff = (data: CreateSignoffForm) =>
  api.post<Signoff>('/signoffs', data).then((r) => r.data);

export const getProjectSignoffs = (projectId: string) =>
  api.get<Signoff[]>(`/signoffs/project/${projectId}`).then((r) => r.data);

export const uploadPhoto = (file: File | Blob) => {
  const form = new FormData();
  form.append('photo', file);
  return api.post<{ url: string }>('/uploads/photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const syncBatch = (mutations: SyncMutation[]) =>
  api.post<{ results: { clientMutationId: string; success: boolean; error?: string }[] }>(
    '/sync',
    { mutations },
  ).then((r) => r.data);

export const getDashboard = (query: {
  includeArchived?: boolean;
  from?: string;
  to?: string;
} = {}) => {
  const params = new URLSearchParams();
  if (query.includeArchived) params.set('includeArchived', 'true');
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const qs = params.toString();
  return api.get<DashboardData>(`/admin/dashboard${qs ? `?${qs}` : ''}`).then((r) => r.data);
};

export const getAdminQuotes = (query: {
  includeArchived?: boolean;
  from?: string;
  to?: string;
  status?: import('../types').QuoteStatus;
} = {}) => {
  const params = new URLSearchParams();
  if (query.includeArchived) params.set('includeArchived', 'true');
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.status) params.set('status', query.status);
  const qs = params.toString();
  return api
    .get<{ quotes: QuoteRequest[]; dateRange: { from: string; to: string } | null }>(
      `/admin/quotes${qs ? `?${qs}` : ''}`,
    )
    .then((r) => r.data);
};

export const getAdminDesigners = () =>
  api.get<Designer[]>('/admin/designers').then((r) => r.data);

export const getAdminClients = () =>
  api.get<Client[]>('/admin/clients').then((r) => r.data);

export const createProject = (data: CreateProjectForm) =>
  api.post<Project>('/admin/projects', data).then((r) => r.data);

export const updateProject = (id: string, data: UpdateProjectForm) =>
  api.patch<Project>(`/admin/projects/${id}`, data).then((r) => r.data);

export const createProjectFromQuote = (quoteId: string, data: CreateProjectFromQuoteForm) =>
  api.post<Project>(`/admin/quotes/${quoteId}/create-project`, data).then((r) => r.data);

export const getStorageLocations = () =>
  api.get<import('../types').StorageLocation[]>('/admin/storage-locations').then((r) => r.data);

export const createStorageLocation = (data: import('../types').StorageLocationForm) =>
  api.post<import('../types').StorageLocation>('/admin/storage-locations', data).then((r) => r.data);

export const updateStorageLocation = (id: string, data: Partial<import('../types').StorageLocationForm>) =>
  api.patch<import('../types').StorageLocation>(`/admin/storage-locations/${id}`, data).then((r) => r.data);

export const deleteStorageLocation = (id: string) =>
  api.delete(`/admin/storage-locations/${id}`).then((r) => r.data);

export const getAdminQuote = (id: string) =>
  api.get<QuoteRequest>(`/admin/quotes/${id}`).then((r) => r.data);

export const updateQuote = (id: string, data: import('../types').UpdateAdminQuoteForm) =>
  api.patch<QuoteRequest>(`/admin/quotes/${id}`, data).then((r) => r.data);

export const sendQuote = (id: string, data: import('../types').UpdateAdminQuoteForm) =>
  api.post<QuoteRequest>(`/admin/quotes/${id}/send`, data).then((r) => r.data);

export const markMessageRead = (id: string) =>
  api.patch(`/admin/messages/${id}/read`).then((r) => r.data);

export const getAdminUsers = () =>
  api.get<import('../types').AdminUserRecord[]>('/admin/users').then((r) => r.data);

export const createAdminUser = (data: import('../types').CreateAdminUserForm) =>
  api.post<import('../types').AdminUserRecord>('/admin/users', data).then((r) => r.data);

export const updateAdminUser = (id: string, data: import('../types').UpdateAdminUserForm) =>
  api.patch<import('../types').AdminUserRecord>(`/admin/users/${id}`, data).then((r) => r.data);

export const getAdminUserWork = (userId: string) =>
  api.get<import('../types').UserWorkDetail>(`/admin/users/${userId}/work`).then((r) => r.data);

export const getAdminSettings = () =>
  api.get<import('../types').AppSettings>('/admin/settings').then((r) => r.data);

export const updateAdminSettings = (data: import('../types').UpdateAppSettingsForm) =>
  api.patch<import('../types').AppSettings>('/admin/settings', data).then((r) => r.data);

export const getPermissionCatalog = () =>
  api.get<import('../types').PermissionDefinition[]>('/admin/permissions').then((r) => r.data);

export const getAdminRoles = () =>
  api.get<import('../types').AppRoleRecord[]>('/admin/roles').then((r) => r.data);

export const getAssignableRoles = () =>
  api.get<import('../types').AssignableRole[]>('/admin/roles/assignable').then((r) => r.data);

export const createAdminRole = (data: import('../types').CreateAppRoleForm) =>
  api.post<import('../types').AppRoleRecord>('/admin/roles', data).then((r) => r.data);

export const updateAdminRole = (id: string, data: import('../types').UpdateAppRoleForm) =>
  api.patch<import('../types').AppRoleRecord>(`/admin/roles/${id}`, data).then((r) => r.data);

export const deleteAdminRole = (id: string) =>
  api.delete<{ deleted: boolean }>(`/admin/roles/${id}`).then((r) => r.data);

export const getQuoteActivity = (quoteId: string) =>
  api.get<import('../types').QuoteActivityEntry[]>(`/admin/quotes/${quoteId}/activity`).then((r) => r.data);

export const getQuoteMessages = (quoteId: string) =>
  api.get<import('../types').QuoteMessage[]>(`/admin/quotes/${quoteId}/messages`).then((r) => r.data);

export const postQuoteMessage = (quoteId: string, data: { body: string; isInternal?: boolean }) =>
  api.post<import('../types').QuoteMessage>(`/admin/quotes/${quoteId}/messages`, data).then((r) => r.data);

async function downloadPdfBlob(path: string) {
  const token = getToken();
  const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('PDF download failed');
  return response.blob();
}

export const downloadInventoryPdf = (projectId: string, note?: string) =>
  downloadPdfBlob(`/pdf/project/${projectId}/inventory${note?.trim() ? `?note=${encodeURIComponent(note.trim())}` : ''}`);

export const downloadStatusReportPdf = (projectId: string, phase?: ProjectPhase, note?: string) => {
  const params = new URLSearchParams();
  if (phase) params.set('phase', phase);
  if (note?.trim()) params.set('note', note.trim());
  const query = params.toString();
  return downloadPdfBlob(`/pdf/project/${projectId}/status-report${query ? `?${query}` : ''}`);
};

export const getProjectDocuments = (projectId: string) =>
  api.get<import('../types').ProjectDocument[]>(`/pdf/project/${projectId}/documents`).then((r) => r.data);

export const saveProjectDocument = (projectId: string, data: import('../types').SaveProjectDocumentForm) =>
  api.post<import('../types').ProjectDocument>(`/pdf/project/${projectId}/documents`, data).then((r) => r.data);

export const getProjectActivity = (projectId: string) =>
  api.get<import('../types').ProjectActivityEntry[]>(`/projects/${projectId}/activity`).then((r) => r.data);

export const getProjectQuote = (projectId: string) =>
  api.get<import('../types').ProjectQuoteSummary | null>(`/projects/${projectId}/quote`).then((r) => r.data);

export const getProjectMessages = (projectId: string) =>
  api.get<import('../types').ProjectMessage[]>(`/projects/${projectId}/messages`).then((r) => r.data);

export const postProjectMessage = (projectId: string, data: { body: string; isInternal?: boolean }) =>
  api.post<import('../types').ProjectMessage>(`/projects/${projectId}/messages`, data).then((r) => r.data);

export const getNotifications = (limit = 40) =>
  api.get<import('../types').PortalNotification[]>(`/notifications?limit=${limit}`).then((r) => r.data);

export const getNotificationUnreadCount = () =>
  api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data.count);

export const markNotificationRead = (id: string) =>
  api.patch(`/notifications/${id}/read`).then((r) => r.data);

export const markAllNotificationsRead = () =>
  api.patch('/notifications/read-all').then((r) => r.data);

export async function openProjectDocument(documentId: string) {
  const token = getToken();
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || '/api'}/pdf/documents/${documentId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!response.ok) throw new Error('Unable to open document');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadProjectDocument(documentId: string, filename: string) {
  const token = getToken();
  const response = await fetch(
    `${import.meta.env.VITE_API_URL || '/api'}/pdf/documents/${documentId}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!response.ok) throw new Error('Unable to download document');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const getProjectContract = (projectId: string) =>
  api.get<import('../types').ContractProposal | null>(`/projects/${projectId}/contract`).then((r) => r.data);

export const generateProjectContract = (projectId: string) =>
  api.post<import('../types').ContractProposal>(`/projects/${projectId}/contract/generate`).then((r) => r.data);

export const uploadSignedContract = (projectId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api
    .post<import('../types').ContractProposal>(`/projects/${projectId}/contract/upload-signed`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const captureContractSignature = (
  projectId: string,
  data: import('../types').CaptureContractSignatureForm,
) =>
  api
    .post<import('../types').ContractProposal>(`/projects/${projectId}/contract/signatures`, data)
    .then((r) => r.data);

export const getProjectPhasePayments = (projectId: string) =>
  api
    .get<import('../types').ProjectPhasePayment[]>(`/projects/${projectId}/phase-payments`)
    .then((r) => r.data);

export const updateProjectPhasePayment = (
  projectId: string,
  phase: import('../types').ProjectPhase,
  data: import('../types').UpdatePhasePaymentForm,
) =>
  api
    .patch<import('../types').ProjectPhasePayment>(
      `/projects/${projectId}/phase-payments/${phase}`,
      data,
    )
    .then((r) => r.data);

async function downloadContractBlob(path: string) {
  const token = getToken();
  const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Download failed');
  return response.blob();
}

export const downloadContractProposal = (projectId: string) =>
  downloadContractBlob(`/projects/${projectId}/contract/proposal`);

export const downloadSignedContract = (projectId: string) =>
  downloadContractBlob(`/projects/${projectId}/contract/signed`);

export const getPublicSiteContent = () =>
  api.get<import('../types/siteContent').SiteContentBundle>('/site-content').then((r) => r.data);

export const getPreviewSiteContent = () =>
  api.get<import('../types/siteContent').SiteContentBundle>('/site-content/preview').then((r) => r.data);

export const getPublicSiteContentSection = (key: string) =>
  api.get<Record<string, unknown>>(`/site-content/${key}`).then((r) => r.data);

export const getAdminSiteContentFiles = () =>
  api.get<import('../types/siteContent').SiteContentFileMeta[]>('/admin/site-content').then((r) => r.data);

export const getSiteContentDraft = () =>
  api
    .get<import('../types/siteContent').SiteContentDraftSummary | null>('/admin/site-content/draft')
    .then((r) => (r.data && typeof r.data === 'object' ? r.data : null));

export const publishSiteContentDraft = (publishNote?: string) =>
  api.post('/admin/site-content/draft/publish', { publishNote }).then((r) => r.data);

export const discardSiteContentDraft = () =>
  api.post('/admin/site-content/draft/discard').then((r) => r.data);

export const getSiteContentDraftFeedback = () =>
  api.get<import('../types/siteContent').SiteContentFeedbackItem[]>('/admin/site-content/draft/feedback').then((r) => r.data);

export const addSiteContentDraftFeedback = (data: { contentKey?: string | null; message: string }) =>
  api.post('/admin/site-content/draft/feedback', data).then((r) => r.data);

export const getAdminSiteContent = (key: string) =>
  api
    .get<import('../types/siteContent').SiteContentAdminSection>(`/admin/site-content/${key}`)
    .then((r) => r.data);

export const saveAdminSiteContent = (
  key: string,
  data: { content: Record<string, unknown>; changeNote?: string },
) => api.put(`/admin/site-content/${key}`, data).then((r) => r.data);

export const getSiteContentVersions = (key: string) =>
  api
    .get<import('../types/siteContent').SiteContentVersionSummary[]>(
      `/admin/site-content/${key}/versions`,
    )
    .then((r) => r.data);

export const getSiteContentVersion = (key: string, versionId: string) =>
  api
    .get<import('../types/siteContent').SiteContentVersionDetail>(
      `/admin/site-content/${key}/versions/${versionId}`,
    )
    .then((r) => r.data);

export const restoreSiteContentVersion = (key: string, versionId: string) =>
  api
    .post(`/admin/site-content/${key}/versions/${versionId}/restore`)
    .then((r) => r.data);

export const getSiteContentSeo = (key: string) =>
  api
    .get<import('../types/siteContent').SeoAnalysisResult>(`/admin/site-content/${key}/seo`)
    .then((r) => r.data);

export const getSiteContentSeoSummary = () =>
  api
    .get<import('../types/siteContent').SeoSummaryItem[]>('/admin/site-content/seo/summary')
    .then((r) => r.data);

export const getPublicSiteMenu = () =>
  api.get<import('../types/siteMenu').SiteMenuConfig>('/site-menu').then((r) => r.data);

export const getAdminSiteMenu = () =>
  api.get<import('../types/siteMenu').SiteMenuAdminState>('/admin/site-menu').then((r) => r.data);

export const saveAdminSiteMenu = (data: {
  menu: import('../types/siteMenu').SiteMenuConfig;
  changeNote?: string;
}) => api.put('/admin/site-menu', data).then((r) => r.data);

export const getSiteMenuVersions = () =>
  api
    .get<import('../types/siteMenu').SiteMenuVersionSummary[]>('/admin/site-menu/versions')
    .then((r) => r.data);

export const getSiteMenuVersion = (versionId: string) =>
  api
    .get<import('../types/siteMenu').SiteMenuVersionDetail>(
      `/admin/site-menu/versions/${versionId}`,
    )
    .then((r) => r.data);

export const restoreSiteMenuVersion = (versionId: string) =>
  api.post(`/admin/site-menu/versions/${versionId}/restore`).then((r) => r.data);

export async function fetchProjectWithCache(
  id: string,
  fetcher: () => Promise<Project>,
  cacheFn: (p: Project) => Promise<void>,
  getCached: (id: string) => Promise<Project | undefined>,
): Promise<{ data: Project; fromCache: boolean }> {
  try {
    const data = await fetcher();
    await cacheFn(data);
    return { data, fromCache: false };
  } catch {
    const cached = await getCached(id);
    if (cached) return { data: cached, fromCache: true };
    throw new Error('Project unavailable offline');
  }
}
