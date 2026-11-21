export type RoleType = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export type SyncStatus = 'ACTIVE' | 'ERROR' | 'PAUSED';
export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'BLOCKED';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  avatarUrl: string | null;
  role: RoleType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PublicUser = Omit<UserRecord, 'passwordHash'>;

export interface InboxRecord {
  id: string;
  resendInboxId: string;
  emailAddress: string;
  displayName: string;
  fromName: string;
  syncStatus: SyncStatus;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserInboxRecord {
  id: string;
  userId: string;
  inboxId: string;
  isDefault: boolean;
  assignedAt: string;
}

export interface SessionRecord {
  id: string;
  tokenHash: string;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface ContactRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  organization: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  inboxId: string;
  threadId: string | null;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent: string | null;
  createdAt: string;
}

export interface UserPreferenceRecord {
  userId: string;
  theme: ThemePreference;
  signatureHtml: string;
  pushEnabled: boolean;
  compactDensity: boolean;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  status: AuditStatus;
  ipAddress: string | null;
  details: string | null;
  createdAt: string;
}

export interface WebhookEventRecord {
  svixId: string;
  eventType: string;
  inboxId: string | null;
  status: 'PROCESSED' | 'FAILED' | 'IGNORED';
  errorMessage: string | null;
  receivedAt: string;
}

export interface StarredThreadRecord {
  id: string;
  userId: string;
  inboxId: string;
  threadId: string;
  createdAt: string;
}
