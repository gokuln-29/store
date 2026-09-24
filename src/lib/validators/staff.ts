import { z } from "zod";
import { emailSchema } from "./auth";

export const PASSWORD_MIN = 10;

export const passwordSchema = z.string().min(PASSWORD_MIN, "passwordTooShort").max(128, "tooLong");

export const staffRoleSchema = z.enum(["OWNER", "STAFF"]);

export const createStaffSchema = z.object({
  name: z.string().trim().min(1, "required").max(80, "tooLong"),
  email: emailSchema,
  role: staffRoleSchema,
  password: passwordSchema,
});
export type CreateStaffInput = z.input<typeof createStaffSchema>;

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "required").max(128, "tooLong"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "required"),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword !== v.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "passwordMismatch" });
    }
    if (v.newPassword === v.currentPassword) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: "passwordUnchanged" });
    }
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
