import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/lib/permissions";

declare module "next-auth" {
  interface User {
    role: AppRole;
    sessionVersion: number;
  }

  interface Session {
    user: {
      id: string;
      role: AppRole;
    } & DefaultSession["user"];
  }
}
