import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Force client-mock transport in CI (no Worker). */
const WB = "/workbench/?mock=1";

test("happy path: structure → approve → gate", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(WB);
  await expect(page.getByRole("heading", { name: /검증된 릴리즈/ })).toBeVisible();

  await page.getByRole("button", { name: /rw-004/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();

  await expect(page.getByText("status:")).toContainText("awaiting_plan_review", {
    timeout: 20_000,
  });
  await expect(page.getByText(/prompt none-mock/)).toBeVisible();
  await expect(page.getByText(/— \(미계측\)/)).toBeVisible();

  await page.getByRole("button", { name: "계획 승인 → 실행" }).click();
  await expect(page.getByRole("button", { name: "인자 수정 적용" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "수정 없이 계속" }).click();
  await expect(page.getByText("status:")).toContainText("awaiting_gate", { timeout: 25_000 });

  await page.getByRole("button", { name: "게이트 승인" }).click();
  await expect(page.getByText("status:")).toContainText("completed", { timeout: 15_000 });
});

test("http-sse run id links to snapshot when worker available", async ({ page }) => {
  await page.goto("/workbench/");
  await page.getByRole("button", { name: /rw-004/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("awaiting_plan_review", {
    timeout: 25_000,
  });
  const snap = page.getByRole("link", { name: /^run_/ });
  // Worker up → http-sse link; otherwise mock shows plain text (no link).
  const transport = page.getByText(/transport http-sse|transport client-mock/);
  await expect(transport).toBeVisible({ timeout: 10_000 });
  if (await page.getByText("transport http-sse").isVisible().catch(() => false)) {
    await expect(snap).toBeVisible();
    await expect(snap).toHaveAttribute("href", /\/workbench\/api\/runs\/run_/);
  }
});

test("citation missing blocks plan approve", async ({ page }) => {
  await page.goto(WB);
  await page.getByRole("button", { name: /rw-012/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText(/근거\(citation\) 없는 요구/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "계획 승인 → 실행" })).toBeDisabled();
});

test("evals page shows benchmark table", async ({ page }) => {
  await page.goto("/workbench/evals");
  await expect(page.getByRole("heading", { name: "합성 벤치마크" })).toBeVisible();
  await expect(page.getByText("rw-004").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "실패·복구 시연 매트릭스" })).toBeVisible();
  await expect(page.getByRole("link", { name: "자동실행" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Workers AI spot/ })).toBeVisible();
  await expect(page.getByText("tokens p50", { exact: true })).toBeVisible();
});

test("header shows worker health or mock fallback label", async ({ page }) => {
  await page.goto(WB);
  await expect(page.getByText(/Release Workbench ·/)).toBeVisible();
  await expect(
    page.getByText(/worker SSE|worker unreachable \(client-mock fallback\)/),
  ).toBeVisible({ timeout: 10_000 });
});

test("header links to curlable evals JSON", async ({ page }) => {
  await page.goto(WB);
  await expect(page.getByRole("link", { name: "evals JSON" })).toHaveAttribute(
    "href",
    "/workbench/api/evals",
  );
});

test("native empty-state fixture has no alias honesty banner", async ({ page }) => {
  await page.goto(WB);
  await page.getByRole("button", { name: /rw-024/ }).click();
  await expect(page.getByText(/alias:/)).toHaveCount(0);
  await expect(page.getByText(/정직성: 요청 fixture/)).toHaveCount(0);
});

test("cancel during structuring reaches cancelled", async ({ page }) => {
  await page.goto(WB);
  await page.getByRole("button", { name: /rw-005/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("structuring", { timeout: 10_000 });
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByText("status:")).toContainText("cancelled", { timeout: 10_000 });
  await expect(page.getByText(/cancel \d+ms/)).toBeVisible({ timeout: 5_000 });
});

test("duplicate blocked fixture shows banner", async ({ page }) => {
  await page.goto(WB);
  await page.getByRole("button", { name: /rw-011/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("동일 idempotencyKey 실행이 이미 진행 중")).toBeVisible({
    timeout: 10_000,
  });
});

test("invalid structured output fails run", async ({ page }) => {
  await page.goto(WB);
  await page.getByRole("button", { name: /rw-007/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("failed", { timeout: 20_000 });
});

test("xss fixture shows sanitized note", async ({ page }) => {
  await page.goto(WB);
  await page.getByRole("button", { name: /rw-013/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText(/sanitized:/i)).toBeVisible({ timeout: 20_000 });
});

test("plan reject reaches rejected_at_plan", async ({ page }) => {
  await page.goto(WB);
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
  await page.goto(WB);
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
  await page.goto(WB);
  await page.getByRole("button", { name: /rw-006/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("연결 재개됨 (seq 연속)")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/reconnect ok/)).toBeVisible({ timeout: 5_000 });
});

test("step limit fixture reaches failed", async ({ page }) => {
  await page.goto(WB);
  await page.getByRole("button", { name: /rw-014/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText("status:")).toContainText("failed", { timeout: 20_000 });
});

test("tool fail then retry on rw-008", async ({ page }) => {
  await page.goto(WB);
  await page.getByRole("button", { name: /rw-008/ }).click();
  await page.getByRole("button", { name: "실행 시작" }).click();
  await expect(page.getByText(/tool failed:/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/tool retried/i)).toBeVisible({ timeout: 20_000 });
});

test("QA fail then gate reject records eval case and audit log", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(WB);
  await page.getByRole("button", { name: /rw-027/ }).click();
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
  await expect(page.getByText("QA 실패", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "게이트 거절", exact: true }).click();
  await expect(page.getByText(/평가 데이터셋에 기록/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/eval recorded: rw-027/)).toBeVisible();
  await expect(page.getByText("감사 로그 (HITL·게이트)")).toBeVisible();
  await expect(page.getByText("gate.rejected").first()).toBeVisible();
});

test("deep link selects scenario and failure filter", async ({ page }) => {
  await page.goto("/workbench/?mock=1&scenario=rw-027&filter=failure");
  await expect(page.getByRole("button", { name: /rw-027/ })).toHaveClass(
    /emerald/,
  );
  await expect(page.getByRole("button", { name: "failure", exact: true })).toHaveClass(
    /emerald/,
  );
});

test("autorun deep link starts structuring", async ({ page }) => {
  await page.goto("/workbench/?mock=1&scenario=rw-012&autorun=1");
  await expect(page.getByText("status:")).toContainText(/structuring|awaiting_plan_review|failed/, {
    timeout: 20_000,
  });
});

test("axe: workbench shell has no critical/serious issues", async ({ page }) => {
  await page.goto(WB);
  await expect(page.getByRole("heading", { name: /검증된 릴리즈/ })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["critical", "serious"].includes(v.impact ?? ""),
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
