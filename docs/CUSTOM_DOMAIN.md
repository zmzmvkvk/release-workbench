# Custom domain (roomy.page)

현재 라이브(Workers.dev):

https://roomy-page-workbench.hommy.workers.dev/workbench

## 목표 URL

`https://roomy.page/workbench` (포트폴리오 `/portfolio`와 역할 분리)

## Cloudflare에서 할 일

1. Worker `roomy-page-workbench`에 커스텀 도메인 `roomy.page` 연결  
   **또는** 기존 `roomy-page-portfolio` Worker에 `/workbench*` 경로를 이 Worker/자산으로 라우팅
2. DNS는 이미 `roomy.page`가 Workers에 붙어 있으면 경로 라우팅만 추가
3. 배포 후 케이스스터디·README URL을 `roomy.page/workbench`로 교체

## 로컬 확인

```bash
cd portfolio/workbench
pnpm deploy
curl -sI https://roomy-page-workbench.hommy.workers.dev/   # 302 → /workbench
curl -sI https://roomy-page-workbench.hommy.workers.dev/workbench  # 200
```

포트폴리오 Worker(`roomy-page-portfolio`)는 `/portfolio`만 담당. 워크벤치를 같은 워커에 합치지 않는 편이 AX 플래그십 분리가 분명하다.
