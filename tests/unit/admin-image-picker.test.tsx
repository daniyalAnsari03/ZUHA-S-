import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadImageAction: vi.fn(),
  listMediaAction: vi.fn(),
}));

vi.mock("@/app/admin/actions", () => ({
  uploadImageAction: mocks.uploadImageAction,
  listMediaAction: mocks.listMediaAction,
}));

import { ImagePicker } from "@/components/admin/image-picker";

async function openUploadTab() {
  render(<ImagePicker name="image" label="Product image" />);

  fireEvent.click(screen.getByText("Select"));
  fireEvent.click(await screen.findByText("Upload New"));

  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;

  return (sizeInBytes: number) => {
    const file = new File(["x"], "look.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: sizeInBytes });
    fireEvent.change(input, { target: { files: [file] } });
  };
}

describe("ImagePicker upload errors", () => {
  beforeEach(() => {
    mocks.listMediaAction.mockResolvedValue({ ok: true, files: [] });
  });

  it("shows the friendly server message for an over-cap upload", async () => {
    mocks.uploadImageAction.mockResolvedValue({
      ok: false,
      error: "File too large. Maximum size is 5MB.",
    });

    const upload = await openUploadTab();
    upload(6 * 1024 * 1024);

    expect(
      await screen.findByText("File too large. Maximum size is 5MB."),
    ).toBeInTheDocument();
  });

  it("surfaces the real message of an unexpected server error", async () => {
    mocks.uploadImageAction.mockRejectedValue(
      new Error("Server action failed: connection reset"),
    );

    const upload = await openUploadTab();
    upload(1024);

    expect(
      await screen.findByText("Server action failed: connection reset"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Upload failed.")).not.toBeInTheDocument();
  });

  it("falls back to a generic message when no error message is available", async () => {
    mocks.uploadImageAction.mockRejectedValue(new Error(""));

    const upload = await openUploadTab();
    upload(1024);

    expect(await screen.findByText("Upload failed.")).toBeInTheDocument();
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    mocks.uploadImageAction.mockRejectedValue("connection reset");

    const upload = await openUploadTab();
    upload(1024);

    expect(await screen.findByText("Upload failed.")).toBeInTheDocument();
  });

  it("clears the loading state after a failed upload", async () => {
    mocks.uploadImageAction.mockRejectedValue(new Error("bucket unreachable"));

    const upload = await openUploadTab();
    upload(1024);

    expect(await screen.findByText("bucket unreachable")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Click to upload")).toBeInTheDocument();
    });
  });
});
