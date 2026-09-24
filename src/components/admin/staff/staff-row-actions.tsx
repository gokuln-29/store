"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/shared/form-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useErrorText } from "@/hooks/use-error-text";
import {
  resetStaffPasswordAction,
  setStaffActiveAction,
  setStaffRoleAction,
} from "@/lib/actions/staff.actions";
import type { ActionResult } from "@/lib/actions/result";

export function StaffRowActions({
  id,
  name,
  role,
  isActive,
}: {
  id: string;
  name: string;
  role: "OWNER" | "STAFF";
  isActive: boolean;
}) {
  const t = useTranslations("Staff");
  const tCommon = useTranslations("Common");
  const tData = useTranslations("DataTable");
  const errorText = useErrorText();
  const [isPending, startTransition] = useTransition();
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>();

  function run(action: () => Promise<ActionResult>, success: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        after?.();
      } else if (result.fieldErrors?.password) {
        setPasswordError(errorText(result.fieldErrors.password));
      } else {
        toast.error(errorText(result.error));
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            aria-label={`${tData("actions")}: ${name}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isActive ? (
            <DropdownMenuItem onSelect={() => setConfirmDeactivate(true)}>
              {t("deactivate")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={() => run(() => setStaffActiveAction(id, true), t("updated"))}
            >
              {t("activate")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() =>
              run(() => setStaffRoleAction(id, role === "OWNER" ? "STAFF" : "OWNER"), t("updated"))
            }
          >
            {role === "OWNER" ? t("makeStaff") : t("makeOwner")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setPassword("");
              setPasswordError(undefined);
              setResetOpen(true);
            }}
          >
            {t("resetPassword")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deactivateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deactivateDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => run(() => setStaffActiveAction(id, false), t("updated"))}
            >
              {t("deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => resetStaffPasswordAction(id, { password }),
                t("passwordReset"),
                () => setResetOpen(false),
              );
            }}
            className="grid gap-4"
          >
            <DialogHeader>
              <DialogTitle>
                {t("resetPassword")}: {name}
              </DialogTitle>
              <DialogDescription>{t("resetPasswordDescription")}</DialogDescription>
            </DialogHeader>
            <FormField
              id={`reset-${id}`}
              label={t("password")}
              hint={t("passwordHint")}
              error={passwordError}
            >
              {(aria) => (
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  {...aria}
                />
              )}
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {t("resetPassword")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
