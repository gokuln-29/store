/**
 * Sets a new password for an admin account (owner or staff), e.g. when the owner is locked out.
 *
 *   pnpm reset:password
 *   docker compose -f docker-compose.prod.yml run --rm migrate pnpm reset:password
 */
import { input, password } from "@inquirer/prompts";
import en from "@/messages/en.json";
import { db } from "@/lib/db";
import { isStaffRole } from "@/lib/permissions";
import { hashPassword } from "@/lib/services/auth.service";
import { emailSchema } from "@/lib/validators/auth";
import { passwordSchema } from "@/lib/validators/staff";

const errors = en.Errors as Record<string, string>;

async function main() {
  const email = await input({
    message: "Admin email",
    validate: (v) => emailSchema.safeParse(v).success || errors.emailInvalid || "Invalid email",
  });
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !isStaffRole(user.role)) {
    console.error("No owner or staff account with that email.");
    process.exit(1);
  }
  const next = await password({
    message: "New password (at least 10 characters)",
    mask: "•",
    validate: (v) => passwordSchema.safeParse(v).success || errors.passwordTooShort || "Too short",
  });
  await db.user.update({
    where: { id: user.id },
    // A new session version signs the account out everywhere.
    data: {
      passwordHash: await hashPassword(next),
      isActive: true,
      sessionVersion: { increment: 1 },
    },
  });
  console.log(`✔ Password changed for ${user.email}. Sign in again.`);
}

main()
  .catch((error: unknown) => {
    if (error instanceof Error && error.name === "ExitPromptError") process.exit(130);
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
