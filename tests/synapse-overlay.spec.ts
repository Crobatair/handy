import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.install();
});
test("helper receives the live transcript without replacing Handy preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 560, height: 360 });
  await page.goto("/tests/synapse-overlay.html");
  await page.evaluate(() => (window as any).synapseTest.shortcutStart());
  await expect(
    page.getByRole("region", { name: "Live guidance helper" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Build a search tool for our support team",
      "with clear filters",
    ),
  );
  await expect(page.getByText(/with clear filters/)).toHaveCount(0);
  await page.clock.fastForward(30_000);
  await expect(page.getByText("Updating…", { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).synapseTest.resolve());
  await expect(
    page.getByText("Who is the intended audience?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Important parts of your request", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/floating-panel.png" });
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByText("Copied · ready to paste", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(
    page.getByRole("region", { name: "Live guidance helper" }),
  ).toHaveCount(0);
});

test("skip guidance keeps recording and rejects a pending suggestion", async ({
  page,
}) => {
  await page.goto("/tests/synapse-overlay.html");
  await page.evaluate(() => (window as any).synapseTest.shortcutStart());
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Review the interface and fix the recording controls.",
    ),
  );
  await page.clock.fastForward(30_000);
  await expect(page.getByText("Updating…", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip live guidance" }).click();
  await page.evaluate(() => (window as any).synapseTest.resolve());
  await expect(
    page.getByText("Who is the intended audience?", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resume live guidance" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume live guidance" }).click();
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Review the interface and fix the recording controls for keyboard users.",
    ),
  );
  await page.clock.fastForward(30_000);
  await expect(page.getByText("Updating…", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await page.evaluate(() => (window as any).synapseTest.resolve());
  await expect(page.getByRole("list").nth(1)).toHaveText(
    /Confirm the audience.*Choose the output format/,
  );
});

test("plain dictation never opens or requests the guided helper", async ({
  page,
}) => {
  await page.goto("/tests/synapse-overlay.html");
  await page.evaluate(() => (window as any).synapseTest.plainStart());
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Write a simple sentence without live guidance.",
    ),
  );
  await expect(
    page.getByRole("region", { name: "Live guidance helper" }),
  ).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).synapseTest.lastMode)).toBe(
    "",
  );
  await page.evaluate(() => (window as any).synapseTest.shortcutStart());
  await expect(
    page.getByRole("region", { name: "Live guidance helper" }),
  ).toBeVisible();
});

test("pausing one guided session leaves the next guided session enabled", async ({
  page,
}) => {
  await page.goto("/tests/synapse-overlay.html");
  await page.evaluate(() => (window as any).synapseTest.shortcutStart());
  await page.getByRole("button", { name: "Skip live guidance" }).click();
  await expect(
    page.getByRole("button", { name: "Resume live guidance" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("synapse.guidance")),
  ).not.toBe("false");
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.evaluate(() => (window as any).synapseTest.shortcutStart());
  await expect(
    page.getByRole("button", { name: "Skip live guidance" }),
  ).toBeVisible();
});

test("guidance waits thirty seconds and ignores unchanged words", async ({
  page,
}) => {
  await page.goto("/tests/synapse-overlay.html");
  await page.evaluate(() => (window as any).synapseTest.shortcutStart());
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Review the interface and fix the recording controls.",
    ),
  );
  await page.clock.fastForward(29_000);
  expect(
    await page.evaluate(() => (window as any).synapseTest.guidanceCalls),
  ).toBe(0);
  await page.clock.fastForward(1_000);
  await expect
    .poll(() => page.evaluate(() => (window as any).synapseTest.guidanceCalls))
    .toBe(1);
  await page.evaluate(() => (window as any).synapseTest.resolve());
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "REVIEW the interface, and fix the recording controls!",
    ),
  );
  await page.clock.fastForward(60_000);
  expect(
    await page.evaluate(() => (window as any).synapseTest.guidanceCalls),
  ).toBe(1);
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Review the interface and fix the recording controls for keyboard users.",
    ),
  );
  await page.clock.fastForward(1_000);
  await expect
    .poll(() => page.evaluate(() => (window as any).synapseTest.guidanceCalls))
    .toBe(2);
});

test("floating guide interval can be changed to ten seconds", async ({
  page,
}) => {
  await page.goto("/tests/synapse-overlay.html");
  await page.evaluate(() => (window as any).synapseTest.shortcutStart());
  await page
    .getByRole("button", { name: "Feedback interval", exact: true })
    .click();
  await page.getByRole("radio", { name: "10 seconds", exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Review the interface and improve the recording controls.",
    ),
  );
  await page.clock.fastForward(9_000);
  expect(
    await page.evaluate(() => (window as any).synapseTest.guidanceCalls),
  ).toBe(0);
  await page.clock.fastForward(1_000);
  await expect
    .poll(() => page.evaluate(() => (window as any).synapseTest.guidanceCalls))
    .toBe(1);
});

test("task mode can be switched and guidance text selected and copied", async ({
  page,
}) => {
  await page.goto("/tests/synapse-overlay.html");
  await page.evaluate(() => (window as any).synapseTest.shortcutStart());
  await page
    .getByRole("combobox", { name: "Task mode", exact: true })
    .selectOption("message");
  await expect(
    page.getByRole("combobox", { name: "Task mode", exact: true }),
  ).toHaveValue("message");
  expect(
    await page.evaluate(() => localStorage.getItem("synapse.modeId")),
  ).toBe("message");
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Please review this interface and improve it.",
    ),
  );
  await page.clock.fastForward(30_000);
  await expect(page.getByText("Updating…", { exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).synapseTest.resolve());
  await page
    .getByText("Task: review the interface.", { exact: true })
    .selectText();
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  expect(await page.evaluate(() => (window as any).synapseTest.copied)).toBe(
    "Task: review the interface.",
  );
});

test("timing control opens from the title bar with clear pacing choices", async ({
  page,
}) => {
  await page.setViewportSize({ width: 560, height: 360 });
  await page.goto("/tests/synapse-overlay.html");
  await page.evaluate(() => (window as any).synapseTest.shortcutStart());
  await page
    .locator("header")
    .getByRole("button", { name: "Feedback interval", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Feedback interval", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Fewer AI requests", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "15 seconds", exact: true }).check();
  await expect(page.getByText("Balanced", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/feedback-timing.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("authentication rejection pauses requests without stopping dictation", async ({
  page,
}) => {
  await page.goto("/tests/synapse-overlay.html");
  await page.evaluate(() => {
    (window as any).synapseTest.guidanceAuthError = true;
    (window as any).synapseTest.shortcutStart();
    (window as any).synapseTest.emit(
      "Please review this interface and improve the recording controls.",
    );
  });
  await page.clock.fastForward(30_000);
  await expect(
    page.getByText(/Authentication failed for test provider/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resume live guidance" }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Please review this interface and improve the recording controls for all users.",
    ),
  );
  await page.clock.fastForward(60_000);
  expect(
    await page.evaluate(() => (window as any).synapseTest.guidanceCalls),
  ).toBe(1);
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
});
