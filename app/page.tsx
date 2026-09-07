import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-charcoal/10 bg-white">
        <Container className="flex h-16 items-center justify-between">
          <span className="font-serif text-lg tracking-wide">
            dINS by Daniyal
          </span>
          <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
            <Link href="#" className="text-sm text-charcoal-muted hover:text-plum">
              Home
            </Link>
          </nav>
        </Container>
      </header>

      <main>
        <Container className="flex flex-col items-center gap-6 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-muted">
            Premium Pakistani Fashion
          </p>
          <h1 className="max-w-xl font-serif text-4xl leading-tight sm:text-5xl">
            Foundation ready for dINS by Daniyal
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-charcoal-muted">
            The project foundation is established. Storefront, products,
            checkout and the AI workforce are built in later phases.
          </p>
          <div className="mt-4">
            <Button>Coming soon</Button>
          </div>
        </Container>
      </main>

      <footer className="mt-auto border-t border-charcoal/10 bg-white py-10">
        <Container className="text-center text-xs text-charcoal-muted">
          © {new Date().getFullYear()} dINS by Daniyal. All rights reserved.
        </Container>
      </footer>
    </div>
  );
}
