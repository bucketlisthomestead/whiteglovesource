export type UserRole = 'admin' | 'designer' | 'client' | 'operations' | (string & {});

export type Permission =
  | 'dashboard.view'
  | 'quotes.view'
  | 'quotes.manage'
  | 'projects.view'
  | 'projects.manage'
  | 'projects.advance'
  | 'users.view'
  | 'users.manage'
  | 'roles.manage'
  | 'settings.manage'
  | 'warehouses.manage'
  | 'field.use'
  | 'site.content.edit'
  | 'site.content.preview'
  | 'site.content.feedback'
  | 'site.content.publish'
  | 'site.menu.edit';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  designerId?: string | null;
  clientId?: string | null;
  permissions?: Permission[];
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export type ProjectStatus = 'planning' | 'pickup_storage' | 'installation' | 'complete';

export type ProjectPhase = 'planning' | 'pickup_storage' | 'installation';

export type PieceStage =
  | 'identified'
  | 'scheduled_pickup'
  | 'received'
  | 'inspected'
  | 'stored'
  | 'staged'
  | 'scheduled_install'
  | 'in_transit'
  | 'delivered'
  | 'installed';

export type InstallDestination = 'showroom' | 'final_site';

export type JobType =
  | 'pickup'
  | 'storage_intake'
  | 'warehouse_staging'
  | 'showroom_install'
  | 'final_install'
  | 'delivery';

export type JobStatus = 'scheduled' | 'in_progress' | 'complete' | 'cancelled';

export type CrewRole = 'driver' | 'mover' | 'lead' | 'installer' | 'warehouse';

export type PhotoMilestone = 'pickup' | 'delivery' | 'install';

export type SignoffType = 'piece' | 'inventory' | 'milestone';

export type SignerRole = 'designer' | 'client';

export type ConditionRating =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'damaged'
  | 'needs_repair';

export type QuoteStatus = 'lead' | 'pending' | 'reviewing' | 'quoted' | 'accepted' | 'declined';

export type StorageType = 'standard_climate' | 'premium_climate' | 'short_term';

export type PieceCatalogCategory =
  | 'seating'
  | 'tables'
  | 'bedding'
  | 'storage'
  | 'lighting'
  | 'rugs'
  | 'specialty';

export interface Designer {
  id: string;
  name: string;
  firm: string;
  email: string;
  phone?: string;
  city?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
}

export interface PickupLocation {
  id: string;
  name: string;
  address: string;
  city?: string;
  contactName?: string;
  contactPhone?: string;
  vendor?: string;
  notes?: string;
}

export interface CrewMember {
  id: string;
  name: string;
  role: CrewRole;
  phone?: string;
}

export interface JobAssignment {
  id: string;
  assignmentRole: CrewRole;
  crewMember: CrewMember;
}

export interface ScheduledJob {
  id: string;
  title: string;
  jobType: JobType;
  status: JobStatus;
  scheduledDate: string;
  startTime?: string;
  endTime?: string;
  locationAddress: string;
  locationCity?: string;
  destinationType?: InstallDestination | null;
  pieceIds?: string[];
  notes?: string;
  pickupLocation?: PickupLocation | null;
  assignments?: JobAssignment[];
}

export interface Room {
  id: string;
  name: string;
  sortOrder: number;
  notes?: string;
}

export interface PieceStagePhoto {
  id: string;
  pieceId: string;
  milestone: PhotoMilestone;
  photoUrl: string;
  capturedBy?: string;
  notes?: string;
  capturedAt: string;
}

export interface Signoff {
  id: string;
  projectId: string;
  pieceId?: string | null;
  signoffType: SignoffType;
  signerRole: SignerRole;
  signerName: string;
  milestone?: PhotoMilestone | null;
  phase?: ProjectPhase | null;
  notes?: string;
  signedAt: string;
}

export interface Piece {
  id: string;
  name: string;
  vendor?: string;
  sku?: string;
  description?: string;
  value?: number;
  currentStage: PieceStage;
  currentCondition: ConditionRating;
  currentLocation: string;
  photoUrl?: string;
  stagingNotes?: string;
  installDestination?: InstallDestination;
  pickupLocation?: PickupLocation | null;
  pickupLocationId?: string | null;
  room?: Room | null;
  roomId?: string | null;
  projectId?: string;
  stagePhotos?: PieceStagePhoto[];
  signoffs?: Signoff[];
}

export interface PieceEvent {
  id: string;
  stage: PieceStage;
  condition: ConditionRating;
  location: string;
  notes?: string;
  verifiedBy?: string;
  photoUrl?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  propertyAddress: string;
  propertyCity?: string;
  targetInstallDate?: string;
  planningCompletedDate?: string;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  stagingPlanOverview?: string;
  primaryInstallDestination?: InstallDestination;
  showroomAddress?: string;
  isDemo: boolean;
  isActive?: boolean;
  mileRate?: number;
  projectBaseFee?: number;
  additionalPickupSurcharge?: number;
  minimumQuote?: number;
  designer: Designer;
  client: Client;
  rooms: Room[];
  pieces: Piece[];
  pickupLocations?: PickupLocation[];
  scheduledJobs?: ScheduledJob[];
  signoffs?: Signoff[];
  stats: {
    totalPieces: number;
    totalRooms: number;
    stageSummary: Record<string, number>;
    phaseSummary?: Record<ProjectPhase, number>;
    upcomingJobs?: number;
  };
}

export interface ContactForm {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface PieceCatalogItem {
  id: string;
  category: PieceCatalogCategory;
  name: string;
  description?: string;
  pickupFee: number;
  storageFeeMonthly: number;
  installFee: number;
  sortOrder: number;
}

export interface QuoteRoomItem {
  catalogItemId: string;
  quantity: number;
}

export interface QuoteRoom {
  name: string;
  items: QuoteRoomItem[];
}

export interface QuoteLineItem {
  category: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface QuoteEstimate {
  lineItems: QuoteLineItem[];
  subtotalPieces: number;
  subtotalMileage: number;
  subtotalStorage: number;
  subtotalPickups: number;
  projectBaseFee: number;
  estimatedTotal: number;
  totalPieces: number;
  totalRooms: number;
  milesToStorage: number;
  milesToInstall: number;
  storageLocationId?: string | null;
  storageLocationName?: string | null;
  mileageNote?: string | null;
}

export interface QuoteEstimateInput {
  rooms: QuoteRoom[];
  pickupAddress?: string;
  propertyAddress?: string;
  storageMonths: number;
  storageType: StorageType;
  pickupLocationCount: number;
}

export interface QuoteLeadForm {
  contactName: string;
  email: string;
  phone?: string;
  company?: string;
  serviceType: string;
}

export interface CompleteQuoteForm {
  projectDescription?: string;
  propertyAddress?: string;
  pickupAddress?: string;
  preferredDate?: string;
  storageMonths?: number;
  storageType?: StorageType;
  pickupLocationCount?: number;
  rooms: QuoteRoom[];
}

export interface QuoteForm {
  contactName: string;
  email: string;
  phone?: string;
  company?: string;
  serviceType: string;
  projectDescription?: string;
  propertyAddress?: string;
  pickupAddress?: string;
  estimatedPieces?: number;
  preferredDate?: string;
  milesToStorage?: number;
  milesToInstall?: number;
  storageMonths?: number;
  storageType?: StorageType;
  pickupLocationCount?: number;
  rooms?: QuoteRoom[];
}

export interface QuoteRequest extends QuoteForm {
  id: string;
  status: QuoteStatus;
  isActive?: boolean;
  quotedAmount?: number;
  estimatedTotal?: number;
  lineItems?: QuoteLineItem[];
  projectId?: string | null;
  storageLocationId?: string | null;
  storageLocationName?: string | null;
  internalNotes?: string | null;
  mileRate?: number;
  projectBaseFee?: number;
  additionalPickupSurcharge?: number;
  minimumQuote?: number;
  deliveryMileRate?: never;
  createdAt: string;
}

export interface UpdateAdminQuoteForm {
  contactName?: string;
  email?: string;
  phone?: string;
  company?: string;
  serviceType?: string;
  projectDescription?: string;
  propertyAddress?: string;
  pickupAddress?: string;
  preferredDate?: string;
  estimatedPieces?: number;
  quotedAmount?: number;
  internalNotes?: string;
  status?: QuoteStatus;
  milesToStorage?: number;
  milesToInstall?: number;
  storageMonths?: number;
  storageType?: StorageType;
  pickupLocationCount?: number;
  mileRate?: number | null;
  projectBaseFee?: number | null;
  additionalPickupSurcharge?: number | null;
  minimumQuote?: number | null;
  isActive?: boolean;
}

export interface StorageLocation {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageLocationForm {
  name: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  isActive?: boolean;
}

export interface CreateDesignerInput {
  name: string;
  firm: string;
  email: string;
  phone?: string;
  city?: string;
  password: string;
}

export interface CreateClientInput {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  password: string;
}

export interface CreateProjectForm {
  name: string;
  designerId?: string;
  newDesigner?: CreateDesignerInput;
  clientId?: string;
  newClient?: CreateClientInput;
  propertyAddress: string;
  propertyCity?: string;
  description?: string;
  targetInstallDate?: string;
}

export interface UpdateProjectForm {
  isActive?: boolean;
  status?: ProjectStatus;
}

export interface CreateProjectFromQuoteForm {
  designerId?: string;
  newDesigner?: CreateDesignerInput;
  name?: string;
  clientId?: string;
  newClient?: CreateClientInput;
}

export interface ContactMessage extends ContactForm {
  id: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  designerId: string | null;
  clientId: string | null;
  isActive: boolean;
  createdAt: string;
  designer: Pick<Designer, 'id' | 'name' | 'firm' | 'email'> | null;
  client: Pick<Client, 'id' | 'name' | 'email'> | null;
  workSummary?: UserWorkSummary;
}

export interface UserWorkSummary {
  quoted: number;
  inProgress: number;
  finished: number;
}

export interface UserWorkItem {
  id: string;
  kind: 'quote' | 'project';
  title: string;
  status: string;
  statusLabel: string;
  updatedAt: string;
  projectId: string | null;
  isActive: boolean;
}

export interface UserWorkDetail extends UserWorkSummary {
  items: UserWorkItem[];
}

export interface CreateAdminUserForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  designerId?: string;
  clientId?: string;
  newDesigner?: { name: string; firm: string; phone?: string; city?: string };
  newClient?: { phone?: string; address?: string; city?: string };
}

export interface UpdateAdminUserForm {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
  designerId?: string | null;
  clientId?: string | null;
}

export interface DashboardData {
  dateRange: { from: string; to: string };
  stats: {
    projects: number;
    projectsInProgress: number;
    projectsInProgressTotal: number;
    projectsComplete: number;
    projectsCompleteTotal: number;
    pieces: number;
    quotes: number;
    quotesTotal: number;
    unreadMessages: number;
    users: number;
    pendingQuotes: number;
    pendingQuotesTotal: number;
    leadQuotes: number;
    leadQuotesTotal: number;
  };
  recentQuotes: QuoteRequest[];
  recentMessages: ContactMessage[];
  activeProjects: Project[];
}

export interface PieceEventForm {
  stage: PieceStage;
  condition: ConditionRating;
  location: string;
  notes?: string;
  photoUrl?: string;
  photoBase64?: string;
  photoMilestone?: PhotoMilestone;
}

export interface CreateSignoffForm {
  projectId: string;
  signoffType: SignoffType;
  signerRole: SignerRole;
  pieceId?: string;
  milestone?: PhotoMilestone;
  phase?: ProjectPhase;
  notes?: string;
}

export interface SyncMutation {
  clientMutationId: string;
  type: 'piece_event';
  payload: {
    pieceId: string;
    stage: string;
    condition: string;
    location: string;
    notes?: string;
    verifiedBy?: string;
    photoUrl?: string;
    photoBase64?: string;
    photoMilestone?: string;
  };
  createdAt: string;
}

export type ProjectDocumentType = 'inventory' | 'status_full' | 'status_phase';

export interface ProjectDocument {
  id: string;
  projectId: string;
  documentType: ProjectDocumentType;
  phase: ProjectPhase | null;
  title: string;
  filename: string;
  note: string | null;
  generatedByName: string | null;
  createdAt: string;
  downloadUrl: string;
}

export interface SaveProjectDocumentForm {
  documentType: ProjectDocumentType;
  phase?: ProjectPhase;
  note?: string;
}

export type ProjectActivityCategory =
  | 'origin'
  | 'approval'
  | 'update'
  | 'schedule'
  | 'document'
  | 'communication';

export type ProjectActivityType =
  | 'project_created'
  | 'quote'
  | 'piece_update'
  | 'signoff'
  | 'stage_photo'
  | 'document'
  | 'pickup'
  | 'job'
  | 'message'
  | 'record_edit';

export interface RecordFieldChange {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
}

export interface ProjectActivityEntry {
  id: string;
  type: ProjectActivityType;
  category: ProjectActivityCategory;
  occurredAt: string;
  title: string;
  summary?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectMessage {
  id: string;
  projectId: string;
  authorUserId: string;
  authorName: string;
  authorRole: UserRole;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface QuoteMessage {
  id: string;
  quoteId: string;
  authorUserId: string;
  authorName: string;
  authorRole: UserRole;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export type QuoteActivityType = 'message' | 'edit' | 'quote_sent';

export interface QuoteActivityEntry {
  id: string;
  type: QuoteActivityType;
  occurredAt: string;
  title: string;
  summary?: string;
  actor?: string;
  changes?: RecordFieldChange[];
}

export interface ProjectQuoteSummary {
  id: string;
  contactName: string;
  email: string;
  phone: string | null;
  company: string | null;
  serviceType: string;
  projectDescription: string;
  propertyAddress: string | null;
  pickupAddress: string | null;
  preferredDate: string | null;
  status: QuoteStatus;
  statusLabel: string;
  quotedAmount: number | null;
  estimatedTotal: number | null;
  internalNotes: string | null;
  milesToStorage: number;
  milesToInstall: number;
  storageMonths: number;
  storageLocationName: string | null;
  mileRate: number | null;
  projectBaseFee: number | null;
  additionalPickupSurcharge: number | null;
  minimumQuote: number | null;
  rooms: QuoteRoom[] | null;
  lineItems: QuoteLineItem[] | null;
  createdAt: string;
  updatedAt: string;
}

export type PortalNotificationType =
  | 'quote_lead'
  | 'quote_submitted'
  | 'project_opened'
  | 'project_message';

export interface PortalNotification {
  id: string;
  type: PortalNotificationType;
  title: string;
  body: string;
  link: string | null;
  quoteId: string | null;
  projectId: string | null;
  read: boolean;
  createdAt: string;
}

export interface AppSettings {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  businessCity: string | null;
  businessState: string | null;
  businessZip: string | null;
  mileRate: number;
  projectBaseFee: number;
  additionalPickupSurcharge: number;
  minimumQuote: number;
  allowDigitalSignatures: boolean;
  updatedAt: string;
}

export type UpdateAppSettingsForm = Partial<
  Omit<AppSettings, 'updatedAt'>
>;

export type ContractProposalStatus = 'draft' | 'sent' | 'signed';

export type ContractSignerRole = 'admin' | 'client';

export type PhasePaymentStatus = 'not_due' | 'due' | 'captured';

export interface ContractSignatureEntry {
  name: string;
  signedAt: string;
  userId?: string;
  signatureStorageKey?: string;
}

export interface ContractSignatureMetadata {
  admin?: ContractSignatureEntry;
  client?: ContractSignatureEntry;
}

export interface ProjectPhasePayment {
  id: string | null;
  projectId: string;
  phase: ProjectPhase;
  status: PhasePaymentStatus;
  amountExpected: number | null;
  capturedAt: string | null;
  capturedByUserId: string | null;
  capturedByName: string | null;
  note: string | null;
  updatedAt: string | null;
}

export interface ContractProposal {
  id: string;
  projectId: string;
  status: ContractProposalStatus;
  proposalFilename: string | null;
  signedUploadFilename: string | null;
  signedUploadMimeType: string | null;
  signatureMetadata: ContractSignatureMetadata | null;
  generatedByName: string | null;
  allowDigitalSignatures: boolean;
  createdAt: string;
  updatedAt: string;
  hasProposal: boolean;
  hasSignedUpload: boolean;
  isFullySigned: boolean;
  proposalDownloadUrl: string | null;
  signedDownloadUrl: string | null;
}

export interface CaptureContractSignatureForm {
  role: ContractSignerRole;
  signerName: string;
  signatureDataUrl: string;
}

export interface UpdatePhasePaymentForm {
  status: PhasePaymentStatus;
  amountExpected?: number | null;
  note?: string | null;
}

export interface PermissionDefinition {
  key: Permission;
  label: string;
  description: string;
  group: string;
}

export interface AppRoleRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  isSystem: boolean;
  isActive: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssignableRole {
  slug: string;
  name: string;
  isSystem: boolean;
}

export type CreateAppRoleForm = {
  slug: string;
  name: string;
  description?: string;
  permissions: Permission[];
};

export type UpdateAppRoleForm = {
  name?: string;
  description?: string | null;
  permissions?: Permission[];
  isActive?: boolean;
};

