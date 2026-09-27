import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// next/cache needs a Next request runtime; outside it (vitest) unstable_cache
// throws "incrementalCache missing". Identity-wrap it so unit tests exercise
// the real cache-less data path.
vi.mock("next/cache", () => ({
  unstable_cache: <T>(cb: () => Promise<T>) => cb,
  revalidateTag: () => {},
}));
