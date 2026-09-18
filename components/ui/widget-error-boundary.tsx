"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /**
   * Rendered when the wrapped subtree throws. Defaults to nothing so a broken
   * widget can never blank or crash the rest of the site.
   */
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * Error boundary scoped to a single self-contained widget (floating chat,
 * notification badge, etc.). If anything inside the wrapped subtree throws
 * during render or a lifecycle method, only that subtree is replaced by the
 * silent fallback — the rest of the page keeps rendering normally.
 *
 * This prevents a future bug in either component from ever blanking or
 * crashing the entire storefront again.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[widget-boundary] caught error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}