import { SetMetadata } from "@nestjs/common";

export const REQUIRE_ORG_KEY = "requireOrg";

/**
 * Marks an endpoint as requiring an active organization context.
 * When applied, the ActiveOrgGuard rejects requests without orgId.
 */
export const RequireOrg = () => SetMetadata(REQUIRE_ORG_KEY, true);