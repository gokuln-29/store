/** A PDF download response that browsers and proxies never cache. */
export function pdfResponse(file: { filename: string; pdf: Uint8Array }): Response {
  return new Response(Buffer.from(file.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
