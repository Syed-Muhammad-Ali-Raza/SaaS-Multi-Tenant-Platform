import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
}

async function main() {
  const email = "super@admin.com";
  const password = "SuperAdmin123!";

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.log("Seed user already exists, skipping.");
    return;
  }

  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Super Admin",
      isSuperAdmin: true,
      emailVerified: true,
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: "Demo Org",
      slug: generateSlug("Demo Org"),
    },
  });

  await prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: "ORG_ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`Seeded:`);
  console.log(`  User: ${email} / ${password}`);
  console.log(`  Organization: ${org.name} (slug: ${org.slug})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
