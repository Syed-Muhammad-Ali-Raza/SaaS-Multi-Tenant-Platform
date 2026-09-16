import { Role, MembershipStatus } from "./enums";

export interface User {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  status: MembershipStatus;
  organization: Organization;
  user?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  role: Role;
  expiresAt: Date;
  acceptedAt: Date | null;
  invitedById: string;
  organization?: Organization;
  invitedBy?: User;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  organizationId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  user: User;
  memberships: Membership[];
  activeOrg: Organization | null;
}

export interface RefreshResponse {
  accessToken: string;
  user: User;
  memberships: Membership[];
  activeOrg: Organization | null;
}
