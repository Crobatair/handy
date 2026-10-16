import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto("/tests/synapse-workspace.html");
});
test("cloud recording displays partial text and applies a Synapse mode", async ({
  page,
}) => {
  await page.getByLabel("Speech recognition").selectOption("deepgram");
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeDisabled();
  await page.getByLabel("Deepgram API key", { exact: true }).fill("test-key");
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Build a search tool",
      "for our support team.",
    ),
  );
  await expect(
    page.getByText("for our support team.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as any).synapseTest.emit("Wrong session", "", "old-session"),
  );
  await expect(page.getByText("Wrong session", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByText("Build a search tool for our support team.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply task mode" }).click();
  await expect(
    page.getByText("Prepared: Build a search tool for our support team.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("deepgramKey")),
  ).toBeNull();
});
test("mode changes invalidate pending guidance and allow a fresh result", async ({
  page,
}) => {
  await page.getByRole("checkbox", { name: "Live guidance" }).check();
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Build a search tool for our support team.",
    ),
  );
  await page.clock.fastForward(30_000);
  await expect(page.getByText("Updating…", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await page
    .getByRole("combobox", { name: /^Task mode/ })
    .selectOption("message");
  await page.evaluate(() => (window as any).synapseTest.resolve());
  await expect(
    page.getByText("Who is the intended audience?", { exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    (window as any).synapseTest.emit(
      "Build a search tool for our support team with filters.",
    ),
  );
  await page.clock.fastForward(30_000);
  await expect(page.getByText("Updating…", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await page.evaluate(() => (window as any).synapseTest.resolve());
  await expect(
    page.getByText("Who is the intended audience?", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).synapseTest.lastMode)).toBe(
    "message",
  );
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/workspace.png", fullPage: true });
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeEnabled();
});
test("a failed start restores the recording controls", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).synapseTest.startError = true;
  });
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByRole("alert")).toContainText("Microphone unavailable");
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeEnabled();
});

test("stream failure stops the session without discarding the displayed transcript", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.evaluate(() => {
    (window as any).synapseTest.emit("Text received before the failure.");
    (window as any).synapseTest.failStream();
  });
  await expect(page.getByRole("alert")).toContainText("Deepgram disconnected");
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeEnabled();
  await expect(
    page.getByText("Text received before the failure.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).synapseTest.canceled)).toBe(
    1,
  );
});

test("an interrupted start cannot restore a phantom recording", async ({
  page,
}) => {
  await page.evaluate(() => {
    (window as any).synapseTest.deferStart = true;
  });
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByRole("button", { name: "Starting…" })).toBeDisabled();
  await page.evaluate(() => (window as any).synapseTest.failStream());
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeEnabled();
  await page.evaluate(() => (window as any).synapseTest.resolveStart());
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeEnabled();
});

test("stop applies the selected mode and copies final text natively", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByText("Final text copied. Paste it with Ctrl+V (⌘V on Mac).", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).synapseTest.copied)).toBe(
    "Prepared: Build a search tool for our support team.",
  );
});
test("plain transcription copies raw text when automatic mode is disabled", async ({
  page,
}) => {
  await page
    .getByRole("checkbox", { name: "Apply task mode when I stop" })
    .uncheck();
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByText("Transcript copied. Paste it with Ctrl+V (⌘V on Mac).", {
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).synapseTest.copied)).toBe(
    "Build a search tool for our support team.",
  );
});

test("Handy shortcut sessions share the workspace live view", async ({
  page,
}) => {
  await page.evaluate(() => (window as any).synapseTest.shortcutStart());
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as any).synapseTest.emit("Live shortcut words", "still arriving"),
  );
  await expect(page.getByText("still arriving", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(
    page.getByText("A corrected shortcut transcript.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeEnabled();
});

test("saved Opus instructions can be edited, retained, and restored", async ({
  page,
}) => {
  await page
    .getByRole("combobox", { name: /^Task mode/ })
    .selectOption("opus_prompt");
  const instructions = page.getByRole("textbox", {
    name: /^Mode instructions/,
  });
  await expect(instructions).toHaveValue(
    /finished user request for Claude Opus 5.5/,
  );
  await instructions.fill(
    "Keep the speaker's requirements and write a clear request.",
  );
  await page.reload();
  await expect(page.getByRole("combobox", { name: /^Task mode/ })).toHaveValue(
    "opus_prompt",
  );
  await expect(instructions).toHaveValue(
    "Keep the speaker's requirements and write a clear request.",
  );
  await page
    .getByRole("button", { name: "Restore default instructions" })
    .click();
  await expect(instructions).toHaveValue(
    /finished user request for Claude Opus 5.5/,
  );
});

test("prompt editor offers room to edit and guidance can be skipped while recording", async ({
  page,
}) => {
  const editor = page.getByRole("textbox", { name: /^Mode instructions/ });
  expect(
    await editor.evaluate((element) => getComputedStyle(element).resize),
  ).toBe("vertical");
  expect((await editor.boundingBox())!.height).toBeGreaterThanOrEqual(256);
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.getByRole("button", { name: "Skip live guidance" }).click();
  await expect(
    page.getByRole("button", { name: "Stop recording" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resume live guidance" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/prompt-editor.png",
    fullPage: true,
  });
});

test("feedback interval persists across reload", async ({ page }) => {
  await page
    .getByRole("button", { name: "Feedback interval", exact: true })
    .click();
  await page.getByRole("radio", { name: "15 seconds", exact: true }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Feedback interval", exact: true }),
  ).toContainText("15s");
});
