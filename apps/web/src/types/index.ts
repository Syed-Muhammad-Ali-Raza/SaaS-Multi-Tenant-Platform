import type { Role, User as SharedUser } from "saas-shared";

export type User = Omit<SharedUser, "lastLoginAt" | "createdAt" | "updatedAt"> & {
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  status: string;
  organization: Organization;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  role: Role;
  expiresAt: string;
  acceptedAt: string | null;
  invitedById: string;
  createdAt: string;
  organization: Pick<Organization, "id" | "name" | "slug">;
  invitedBy: { id: string; email: string; name: string };
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  memberships: Membership[];
  activeOrg: Organization | null;
}

export interface RefreshResponse extends AuthResponse {}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}