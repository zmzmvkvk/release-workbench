import { expect, test } from "@playwright/test";

/**
 * Scripted demo for video capture (DEMO_SCRIPT.md).
 * Does not assert CI-critical paths — recording quality first.
 */
test("record release workbench demo", async ({ page }) => {
  await page.goto("/workbench");
  await expect(page.getByRole("heading", { name: /검증된 릴리즈/ })).toBeVisible();
  await page.waitForTimeout(2000);

  await page.getByRole("button", { name: /rw-004/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("awaiting_plan_review", {
    timeout: 20_000,
  });
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: "계획 승인 → 실행" }).click();
  // HITL tool args
  const argsBtn = page.getByRole("button", { name: "인자 수정 적용" });
  const skipBtn = page.getByRole("button", { name: "수정 없이 계속" });
  if (await argsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByLabel("도구 인자 JSON").fill(
      '{"project":"cleanroom-react","allowedMime":["application/pdf"]}',
    );
    await argsBtn.click();
    await page.waitForTimeout(800);
  } else if (await skipBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await skipBtn.click();
  }
  await expect(page.getByText("status:")).toContainText("awaiting_gate", {
    timeout: 25_000,
  });
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: "게이트 승인" }).click();
  await expect(page.getByText("status:")).toContainText("completed", {
    timeout: 10_000,
  });
  await page.waitForTimeout(1200);

  // Failure: citation block
  await page.getByRole("button", { name: /rw-012/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText(/근거\(citation\) 없는 요구/)).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(1500);

  // Failure: cancel
  await page.getByRole("button", { name: /rw-005/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("structuring", {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByText("status:")).toContainText("cancelled", {
    timeout: 10_000,
  });
  await page.waitForTimeout(1200);

  // Failure: duplicate
  await page.getByRole("button", { name: /rw-011/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText(/idempotencyKey/)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1200);

  await page.goto("/workbench/evals");
  await expect(page.getByRole("heading", { name: "합성 벤치마크" })).toBeVisible();
  await expect(page.getByText(/Workers AI spot/i)).toBeVisible();
  await page.waitForTimeout(3000);
});
