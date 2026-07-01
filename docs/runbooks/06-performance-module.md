# 06-Performance Module

Performance owns dashboards, review cycles, goals, KRAs, KPIs, reviews, assessments, and evidence.

## Owners

- Backend: Performance Team
- Frontend: Performance UI Team

## Backend Files

```text
src/modules/performance/
  controllers/
  routes/
  services/
  validators/
```

## Frontend Files

```text
frontend/src/features/performance/
  api/
  pages/
  types/
```

## Key Endpoints

```text
GET   /api/v1/performance/dashboard
GET   /api/v1/performance/cycles
POST  /api/v1/performance/cycles
GET   /api/v1/performance/goals
POST  /api/v1/performance/goals
POST  /api/v1/performance/goals/:goalId/kras
POST  /api/v1/performance/kras/:kraId/kpis
PATCH /api/v1/performance/kpis/:id/progress
GET   /api/v1/performance/reviews
POST  /api/v1/performance/reviews
PATCH /api/v1/performance/reviews/:id/self-assessment
PATCH /api/v1/performance/reviews/:id/manager-assessment
```

## Debugging

- Dashboard metrics: backend `services/performance.service.ts`.
- Review state: backend `services/performance.service.ts`.
- UI workflow: frontend `pages/performance-page.tsx`.
- Access denied: backend `routes/performance.routes.ts`.
