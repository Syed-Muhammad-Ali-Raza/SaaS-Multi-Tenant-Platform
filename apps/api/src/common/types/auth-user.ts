import { Role } from "saas-shared";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  emailVerified: boolean;
  orgId: string | null;
  role: Role | null;
  memberships?: unknown[];
}