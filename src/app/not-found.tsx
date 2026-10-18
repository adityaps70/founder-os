import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="mt-2 text-xl font-semibold">We couldn't find that page</h1>
      <p className="mt-2 text-sm text-muted">It may have been deleted, or you may not have access to this workspace.</p>
      <Link href="/app" className={buttonClass("secondary", "md", "mt-6")}>
        Back to my workspace
      </Link>
    </div>
  );
}
