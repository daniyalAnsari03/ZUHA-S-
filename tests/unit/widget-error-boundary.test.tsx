import { render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { WidgetErrorBoundary } from "@/components/ui/widget-error-boundary";

class Bomb extends Component<{ message: string }> {
  render(): ReactNode {
    const { message } = this.props;
    if (message) {
      throw new Error(message);
    }
    return null;
  }
}

describe("WidgetErrorBoundary", () => {
  it("renders children normally when they do not throw", () => {
    render(
      <WidgetErrorBoundary>
        <div>safe widget</div>
      </WidgetErrorBoundary>,
    );
    expect(screen.getByText("safe widget")).toBeInTheDocument();
  });

  it("swallows a child render error so the rest of the page survives", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <div>
        <div>the rest of the page</div>
        <WidgetErrorBoundary>
          <Bomb message="boom" />
        </WidgetErrorBoundary>
      </div>,
    );

    expect(screen.getByText("the rest of the page")).toBeInTheDocument();
    expect(screen.queryByTestId("bomb")).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("renders a custom fallback when one is provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <WidgetErrorBoundary fallback={<div>widget unavailable</div>}>
        <Bomb message="boom" />
      </WidgetErrorBoundary>,
    );

    expect(screen.getByText("widget unavailable")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});