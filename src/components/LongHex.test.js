import { act, fireEvent, render, screen } from "@testing-library/react";
import LongHex from "./LongHex";

// n bytes of hex whose two ends can be told apart.
const hexOf = (bytes) => `aa${"00".repeat(bytes - 2)}bb`;

describe("LongHex", () => {
  const writeText = jest.fn(() => Promise.resolve());
  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  test("shows up to 256 bytes as they are, without buttons", () => {
    const hex = hexOf(256);
    const { container } = render(
      <div>
        <LongHex hex={hex} />
      </div>,
    );
    expect(container.textContent).toBe(hex);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector(".copy-symbol")).toBeNull();
  });

  test("shows nothing for a missing value", () => {
    const { container } = render(
      <div>
        <LongHex hex={undefined} />
        <LongHex hex="" />
      </div>,
    );
    expect(container.textContent).toBe("");
  });

  test("shortens a longer value to 64 + 64 characters and its size, and expands it", () => {
    // An ML-DSA-44 P2PKH unlock: 3,739 bytes.
    const hex = hexOf(3739);
    const { container } = render(
      <div>
        <LongHex hex={hex} />
      </div>,
    );

    const short = `${hex.slice(0, 64)}…${hex.slice(-64)}`;
    expect(container.textContent).toContain(short);
    expect(container.textContent).toContain("(3,739 bytes)");
    expect(container.textContent).not.toContain(hex);
    const toggle = screen.getByRole("button", { name: "Show full" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(container.textContent).toContain(hex);
    expect(container.textContent).not.toContain(short);
    expect(screen.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(container.textContent).toContain(short);
    expect(container.textContent).not.toContain(hex);
  });

  test("starts shortening at 257 bytes", () => {
    const { container } = render(
      <div>
        <LongHex hex={hexOf(257)} />
      </div>,
    );
    expect(container.textContent).toContain("(257 bytes)");
  });

  test("copies the whole value, also while it is shortened", () => {
    jest.useFakeTimers();
    try {
      const hex = hexOf(2421);
      const { container } = render(
        <div>
          <LongHex hex={hex} />
        </div>,
      );
      fireEvent.click(container.querySelector(".copy-symbol"));
      expect(writeText).toHaveBeenCalledWith(hex);
      act(() => {
        jest.runOnlyPendingTimers();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  test("leaves the copy button out when the caller has one", () => {
    const { container } = render(
      <div>
        <LongHex hex={hexOf(1312)} showCopy={false} />
      </div>,
    );
    expect(container.querySelector(".copy-symbol")).toBeNull();
    expect(screen.getByRole("button", { name: "Show full" })).toBeTruthy();
  });
});
