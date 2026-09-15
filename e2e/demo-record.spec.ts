import { expect, test } from "@playwright/test";

/**
 * Scripted demo for video capture (DEMO_SCRIPT.md) — target 60–90s.
 * Uses ?mock=1 for deterministic HITL / QA / failure paths (same as CI E2E).
 */
const WB = "/workbench/?mock=1";

test("record release workbench demo", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(WB);
  await expect(page.getByRole("heading", { name: /검증된 릴리즈/ })).toBeVisible();
  await page.waitForTimeout(5000);

  // Happy path rw-004 (~20s on screen)
  await page.getByRole("button", { name: /rw-004/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("awaiting_plan_review", {
    timeout: 20_000,
  });
  await page.waitForTimeout(2800);

  await page.getByRole("button", { name: "계획 승인 → 실행" }).click();
  await expect(page.getByRole("button", { name: "인자 수정 적용" })).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(2200);
  await page.getByLabel("도구 인자 JSON").fill(
    '{"project":"cleanroom-react","allowedMime":["application/pdf"]}',
  );
  await page.getByRole("button", { name: "인자 수정 적용" }).click();
  await page.waitForTimeout(1200);
  await expect(page.getByText("status:")).toContainText("awaiting_gate", {
    timeout: 25_000,
  });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "게이트 승인", exact: true }).click();
  await expect(page.getByText("status:")).toContainText("completed", {
    timeout: 15_000,
  });
  await page.waitForTimeout(2000);

  // QA fail → gate reject → eval
  await page.getByRole("button", { name: /rw-027/ }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("awaiting_plan_review", {
    timeout: 20_000,
  });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "계획 승인 → 실행" }).click();
  await expect(page.getByRole("button", { name: "수정 없이 계속" })).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "수정 없이 계속" }).click();
  await expect(page.getByText("status:")).toContainText("awaiting_gate", {
    timeout: 25_000,
  });
  await expect(page.getByText("QA 실패", { exact: true })).toBeVisible();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "게이트 거절", exact: true }).click();
  await expect(page.getByText(/eval recorded: rw-027/)).toBeVisible({
    timeout: 10_000,
  });
  await page.waitForTimeout(2500);

  // Citation block
  await page.getByRole("button", { name: /rw-012/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText(/근거\(citation\) 없는 요구/)).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(2500);

  // Cancel
  await page.getByRole("button", { name: /rw-005/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("structuring", {
    timeout: 10_000,
  });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByText("status:")).toContainText("cancelled", {
    timeout: 10_000,
  });
  await page.waitForTimeout(2000);

  // Duplicate
  await page.getByRole("button", { name: /rw-011/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("동일 idempotencyKey 실행이 이미 진행 중")).toBeVisible({
    timeout: 10_000,
  });
  await page.waitForTimeout(2000);

  await page.goto("/workbench/evals");
  await expect(page.getByRole("heading", { name: "합성 벤치마크" })).toBeVisible();
  await expect(page.getByText("요구사항 추출 정확도", { exact: true })).toBeVisible();
  await expect(page.getByText("fixture 커버", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /evals JSON/ })).toBeVisible();
  await page.waitForTimeout(7000);
  await page.locator("#failures").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "실패·복구 시연 매트릭스" })).toBeVisible();
  await page.waitForTimeout(8000);
});
