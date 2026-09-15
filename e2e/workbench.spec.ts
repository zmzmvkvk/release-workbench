import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("happy path: structure → approve → gate", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/workbench");
  await expect(page.getByRole("heading", { name: /검증된 릴리즈/ })).toBeVisible();

  await page.getByRole("button", { name: /rw-004/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();

  await expect(page.getByText("status:")).toContainText("awaiting_plan_review", {
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "계획 승인 → 실행" }).click();
  await expect(page.getByRole("button", { name: "수정 없이 계속" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "수정 없이 계속" }).click();
  await expect(page.getByText("status:")).toContainText("awaiting_gate", { timeout: 25_000 });

  await page.getByRole("button", { name: "게이트 승인" }).click();
  await expect(page.getByText("status:")).toContainText("completed", { timeout: 15_000 });
});

test("citation missing blocks plan approve", async ({ page }) => {
  await page.goto("/workbench");
  await page.getByRole("button", { name: /rw-012/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText(/근거\(citation\) 없는 요구/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "계획 승인 → 실행" })).toBeDisabled();
});

test("evals page shows benchmark table", async ({ page }) => {
  await page.goto("/workbench/evals");
  await expect(page.getByRole("heading", { name: "합성 벤치마크" })).toBeVisible();
  await expect(page.getByText("rw-004")).toBeVisible();
});

test("cancel during structuring reaches cancelled", async ({ page }) => {
  await page.goto("/workbench");
  await page.getByRole("button", { name: /rw-005/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("structuring", { timeout: 10_000 });
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByText("status:")).toContainText("cancelled", { timeout: 10_000 });
});

test("duplicate blocked fixture shows banner", async ({ page }) => {
  await page.goto("/workbench");
  await page.getByRole("button", { name: /rw-011/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("동일 idempotencyKey 실행이 이미 진행 중")).toBeVisible({
    timeout: 10_000,
  });
});

test("invalid structured output fails run", async ({ page }) => {
  await page.goto("/workbench");
  await page.getByRole("button", { name: /rw-007/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("failed", { timeout: 20_000 });
});

test("xss fixture shows sanitized note", async ({ page }) => {
  await page.goto("/workbench");
  await page.getByRole("button", { name: /rw-013/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText(/sanitized:/i)).toBeVisible({ timeout: 20_000 });
});

test("plan reject reaches rejected_at_plan", async ({ page }) => {
  await page.goto("/workbench");
  await page.getByRole("button", { name: /rw-009/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("awaiting_plan_review", {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "계획 거절" }).click();
  await expect(page.getByText("status:")).toContainText("rejected_at_plan", {
    timeout: 10_000,
  });
});

test("tool args edit HITL control appears during execute", async ({ page }) => {
  await page.goto("/workbench");
  await page.getByRole("button", { name: /rw-004/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("awaiting_plan_review", {
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "계획 승인 → 실행" }).click();
  await expect(page.getByRole("button", { name: "인자 수정 적용" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel("도구 인자 JSON").fill('{"allowedMime":["application/pdf"]}');
  await page.getByRole("button", { name: "인자 수정 적용" }).click();
  await expect(page.getByText("도구 인자 수정: t_patch")).toBeVisible({ timeout: 10_000 });
});

test("stream reconnect banner on rw-006", async ({ page }) => {
  await page.goto("/workbench");
  await page.getByRole("button", { name: /rw-006/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("연결 재개됨 (seq 연속)")).toBeVisible({ timeout: 20_000 });
});

test("step limit fixture reaches failed", async ({ page }) => {
  await page.goto("/workbench");
  await page.getByRole("button", { name: /rw-014/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("failed", { timeout: 20_000 });
});

test("tool fail then retry on rw-008", async ({ page }) => {
  await page.goto("/workbench");
  await page.getByRole("button", { name: /rw-008/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText(/tool failed:/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/tool retried/i)).toBeVisible({ timeout: 20_000 });
});

test("axe: workbench shell has no critical/serious issues", async ({ page }) => {
  await page.goto("/workbench");
  await expect(page.getByRole("heading", { name: /검증된 릴리즈/ })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["critical", "serious"].includes(v.impact ?? ""),
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
