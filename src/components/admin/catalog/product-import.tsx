"use client";

import { CircleAlert, CircleCheck, FileUp, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useErrorText } from "@/hooks/use-error-text";
import { Link } from "@/i18n/navigation";
import type { ImportReport } from "@/lib/services/product-import.service";

type Response = { ok: true; report: ImportReport } | { ok: false; error: string };

export function ProductImport() {
  const t = useTranslations("Import");
  const errorText = useErrorText();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [requestError, setRequestError] = useState<string>();
  const [onlyErrors, setOnlyErrors] = useState(false);

  async function send(dryRun: boolean) {
    if (!file) return;
    setBusy(dryRun ? "check" : "import");
    setRequestError(undefined);
    const form = new FormData();
    form.set("file", file);
    form.set("dryRun", dryRun ? "1" : "0");
    try {
      const res = await fetch("/api/admin/products/import", { method: "POST", body: form });
      const body = (await res.json()) as Response;
      if (body.ok) setReport(body.report);
      else setRequestError(errorText(body.error));
    } catch {
      setRequestError(errorText("unknown"));
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setFile(null);
    setReport(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const fileErrors = report?.fileErrors ?? [];
  const blocking = fileErrors.some((e) => e.row === null);
  const valid = report ? report.products.filter((p) => p.ok).length : 0;
  const s = report?.summary;
  const creating = report?.products.filter((p) => p.ok && p.action === "create").length ?? 0;
  const updating = report?.products.filter((p) => p.ok && p.action === "update").length ?? 0;
  const shown = (report?.products ?? []).filter((p) => !onlyErrors || !p.ok);

  const describe = (e: { row: number | null; column: string | null; message: string }) =>
    e.row == null
      ? `${e.column ? `${e.column}: ` : ""}${errorText(e.message)}`
      : e.column
        ? t("errorAt", { row: e.row, column: e.column, message: errorText(e.message) ?? "" })
        : t("errorAtRow", { row: e.row, message: errorText(e.message) ?? "" });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          id="csv-file"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setReport(null);
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== null}
        >
          <FileUp className="size-4" aria-hidden />
          {t("chooseFile")}
        </Button>
        <span className="text-sm text-muted-foreground">{file ? file.name : t("noFile")}</span>
        <div className="ml-auto flex gap-2">
          {report && !report.dryRun ? (
            <>
              <Button asChild variant="outline">
                <Link href="/admin/products">{t("viewProducts")}</Link>
              </Button>
              <Button onClick={reset}>{t("startOver")}</Button>
            </>
          ) : (
            <>
              <Button
                variant={report ? "outline" : "default"}
                disabled={!file || busy !== null}
                onClick={() => send(true)}
              >
                {busy === "check" && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {busy === "check" ? t("checking") : t("check")}
              </Button>
              {report?.dryRun && !blocking && valid > 0 && (
                <Button disabled={busy !== null} onClick={() => send(false)}>
                  {busy === "import" && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  {busy === "import" ? t("importing") : t("importValid", { count: valid })}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {requestError && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}

      {report && (
        <section aria-live="polite" className="grid gap-4">
          {fileErrors.length > 0 && (
            <Alert variant="destructive">
              <CircleAlert className="size-4" aria-hidden />
              <AlertDescription>
                <p className="font-medium">{t("fileProblems")}</p>
                <ul className="mt-1 list-disc pl-5">
                  {fileErrors.map((e, i) => (
                    <li key={i}>{describe(e)}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {s && !blocking && (
            <p className="text-sm font-medium">
              {report.dryRun
                ? t("checkedSummary", {
                    rows: report.totalRows,
                    create: creating,
                    update: updating,
                    failed: s.failed,
                  })
                : t("doneSummary", { create: s.created, update: s.updated, failed: s.failed })}
            </p>
          )}
          {report.products.length > 0 && (
            <>
              {s && s.failed > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={onlyErrors}
                    onCheckedChange={(c) => setOnlyErrors(c === true)}
                  />
                  {t("showOnlyErrors")}
                </label>
              )}
              <div className="overflow-x-auto rounded-lg border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("product")}</TableHead>
                      <TableHead>{t("rows")}</TableHead>
                      <TableHead>{t("result")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((p) => (
                      <TableRow key={p.handle}>
                        <TableCell className="font-mono text-sm">{p.handle}</TableCell>
                        <TableCell className="tabular-nums">
                          {p.firstRow === p.lastRow ? p.firstRow : `${p.firstRow}–${p.lastRow}`}
                        </TableCell>
                        <TableCell>
                          {p.ok ? (
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              <CircleCheck className="size-4 text-emerald-600" aria-hidden />
                              {report.dryRun
                                ? p.action === "create"
                                  ? t("willCreate")
                                  : t("willUpdate")
                                : p.action === "create"
                                  ? t("created")
                                  : t("updated")}
                            </span>
                          ) : (
                            <div className="grid gap-1">
                              <Badge variant="destructive" className="w-fit">
                                {t("failed")}
                              </Badge>
                              <ul className="text-sm text-destructive">
                                {p.errors.map((e, i) => (
                                  <li key={i}>{describe(e)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
