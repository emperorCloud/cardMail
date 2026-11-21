export type RoleType = 'SUPER_ADMIN' | 'ADMIN' | 'USER';
export type ThemePreference = 'light' | 'dark' | 'system';
export type MailView = 'inbox' | 'sent' | 'drafts' | 'starred' | 'archive' | 'trash' | 'contacts' | 'settings' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: RoleType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserInbox {
  id: string;
  resendInboxId: string;
  emailAddress: string;
  displayName: string;
  fromName: string;
  syncStatus: 'ACTIVE' | 'ERROR' | 'PAUSED';
  lastSyncAt: string | null;
  lastError: string | null;
  isDefault: boolean;
  assignmentId: string;
}

export interface UserPreferences {
  userId: string;
  theme: ThemePreference;
  signatureHtml: string;
  pushEnabled: boolean;
  compactDensity: boolean;
  updatedAt: string;
}

export interface AttachmentItem {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface EmailMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo: string[];
  subject: string;
  html: string | null;
  text: string | null;
  attachments: AttachmentItem[];
  read: boolean;
  receivedAt: string;
}

export interface MailThread {
  id: string;
  inboxId: string;
  subject: string;
  snippet: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  emailCount: number;
  hasAttachment: boolean;
  hasDraft: boolean;
  read: boolean;
  starred?: boolean;
  receivedAt: string;
  folder: 'inbox' | 'archive' | 'spam' | 'sent' | 'trash';
  labels: Array<{ id: string; name: string; color: string }>;
}

export interface MailDraft {
  id: string;
  inboxId: string;
  type: 'standalone' | 'reply';
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  snippet: string;
  html: string | null;
  text: string | null;
  threadId: string | null;
  replyToEmailId: string | null;
  updatedAt: string;
  attachments: AttachmentItem[];
}

export interface ContactItem {
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

export interface NotificationItem {
  id: string;
  userId: string;
  inboxId: string;
  threadId: string | null;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  ipAddress: string | null;
  details: string | null;
  createdAt: string;
}

export interface ServiceStatusReport {
  mailMode: 'resend_live' | 'dev_sandbox';
  resendConfigured: boolean;
  webhookSecretConfigured: boolean;
  domain: string;
  totalInboxes: number;
  errorInboxes: number;
  recentWebhooks: Array<{
    svixId: string;
    eventType: string;
    inboxId: string | null;
    status: string;
    errorMessage: string | null;
    receivedAt: string;
  }>;
  syncErrors: Array<{
    svixId: string;
    eventType: string;
    errorMessage: string | null;
    receivedAt: string;
  }>;
}
