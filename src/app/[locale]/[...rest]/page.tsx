import { notFound } from "next/navigation";

// Catch-all so unknown paths under a locale render the localized not-found page.
export default function CatchAllPage() {
  notFound();
}
