import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-serif text-3xl">Page not found</h1>
      <p className="max-w-md text-sm text-charcoal-muted">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/">
        <Button variant="outline">Go home</Button>
      </Link>
    </div>
  );
}
