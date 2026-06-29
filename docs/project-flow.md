# SaaS HRMS Project Flow

This document maps the main runtime and product flows for the SaaS HRMS Performance Management project.

## System Flow

```mermaid
flowchart LR
  user["User"]
  browser["Browser"]
  react["React app<br/>Vite frontend"]
  guard["Route guards<br/>AuthGuard + PermissionGuard"]
  apiClient["API client<br/>fetch + access token + refresh retry"]
  viteProxy["Vite dev proxy<br/>/api -> :3000"]
  express["Express API"]
  middleware["API middleware<br/>helmet, CORS, JSON, cookies,<br/>request context, pino logging"]
  authMw["Auth middleware<br/>JWT auth, tenant access,<br/>permission checks"]
  routers["Module routers"]
  services["Domain services"]
  prisma["Prisma client"]
  postgres["PostgreSQL database"]
  audit["Audit service"]

  user --> browser --> react --> guard --> apiClient
  apiClient --> viteProxy --> express --> middleware --> routers
  routers --> authMw --> services --> prisma --> postgres
  services --> audit --> prisma

  routers --> authRoutes["/api/v1/auth"]
  routers --> adminRoutes["/api/v1/admin"]
  routers --> perfRoutes["/api/v1/performance"]
  express --> health["/health/live"]
```

## Authentication And Session Flow

```mermaid
sequenceDiagram
  actor User
  participant Web as React frontend
  participant API as Express auth API
  participant Auth as Auth service
  participant DB as PostgreSQL

  User->>Web: Open /login
  User->>Web: Submit credentials
  Web->>API: POST /api/v1/auth/login
  API->>API: Rate limit + validate request
  API->>Auth: Verify credentials and tenant membership
  Auth->>DB: Read user, memberships, roles, permissions
  Auth->>DB: Create auth session with refresh token hash
  Auth-->>API: Access token + user context
  API-->>Web: Tokens and user permissions
  Web->>Web: Store access token in auth store
  Web->>User: Navigate to /app

  Web->>API: Authenticated API request
  API->>API: Validate bearer access token
  API->>API: Check required permission
  API-->>Web: Protected data

  Web->>API: Request receives 401
  Web->>API: POST /api/v1/auth/refresh with cookie
  API->>Auth: Rotate refresh session
  Auth->>DB: Revoke old session and create replacement
  API-->>Web: New access token
  Web->>API: Retry original request
```

## Frontend Navigation Flow

```mermaid
flowchart TD
  root["/"] --> appRedirect["Redirect to /app"]
  appRedirect --> authGuard{"Authenticated?"}
  authGuard -- "No" --> login["/login"]
  authGuard -- "Yes" --> appLayout["AppLayout"]

  appLayout --> overview["Overview dashboard"]
  appLayout --> performance["Performance"]
  appLayout --> admin["Admin pages"]
  appLayout --> selfService["Profile, security, sessions"]

  performance --> perfGuard{"Has performance permission?"}
  perfGuard -- "Yes" --> perfPage["/app/performance"]
  perfGuard -- "No" --> notFound["Not allowed / not found"]

  admin --> tenantGuard{"Has admin permission?"}
  tenantGuard -- "Yes" --> tenants["Tenants"]
  tenantGuard -- "Yes" --> orgs["Organizations"]
  tenantGuard -- "Yes" --> users["Users"]
  tenantGuard -- "Yes" --> roles["Roles"]
  tenantGuard -- "No" --> notFound

  selfService --> profile["Profile"]
  selfService --> security["Security + MFA"]
  selfService --> sessions["Sessions"]
```

## Admin And RBAC Flow

```mermaid
flowchart LR
  adminUser["Admin user"]
  adminUi["Admin UI<br/>tenants, organizations,<br/>users, roles"]
  adminApi["/api/v1/admin"]
  auth["authenticate"]
  tenantAccess["establishTenantAccess"]
  permissionCheck["requirePermissions<br/>or requireAnyPermission"]
  validation["Zod validation"]
  adminService["Admin service"]
  rbacCatalog["RBAC catalog"]
  database["PostgreSQL"]
  auditLog["Audit events"]

  adminUser --> adminUi --> adminApi
  adminApi --> auth --> tenantAccess --> permissionCheck --> validation --> adminService
  adminService --> rbacCatalog
  adminService --> database
  adminService --> auditLog --> database

  adminService --> tenantData["Tenant records"]
  adminService --> orgData["Organization hierarchy"]
  adminService --> userData["Users + memberships"]
  adminService --> roleData["Roles, permissions,<br/>role assignments"]
```

## Performance Management Flow

```mermaid
flowchart TD
  manager["Manager / HR admin"]
  employee["Employee"]
  perfUi["Performance page"]
  perfApi["/api/v1/performance"]
  access["authenticate + tenant access + permission checks"]
  service["Performance service"]
  db["PostgreSQL"]

  manager --> perfUi
  employee --> perfUi
  perfUi --> perfApi --> access --> service --> db

  service --> dashboard["Dashboard metrics"]
  service --> cycles["Review cycles"]
  service --> goals["Goals"]
  service --> kras["KRAs"]
  service --> kpis["KPIs"]
  service --> reviews["Performance reviews"]
  service --> evidence["Evidence uploads/links"]

  cycles --> goals --> kras --> kpis
  cycles --> reviews
  reviews --> selfAssessment["Employee self-assessment"]
  reviews --> managerAssessment["Manager assessment"]
  kpis --> progress["KPI progress updates"]
  reviews --> evidence
```

## Data Domain Map

```mermaid
erDiagram
  Tenant ||--o{ TenantMembership : has
  Tenant ||--o{ Organization : owns
  Tenant ||--o{ Role : defines
  Tenant ||--o{ AuthSession : contains
  Tenant ||--o{ AuditEvent : records
  Tenant ||--o{ PerformanceReviewCycle : runs

  User ||--o{ TenantMembership : joins
  User ||--o{ AuthSession : owns
  User ||--o{ RoleAssignment : receives
  User ||--o{ AuditEvent : triggers

  Role ||--o{ RolePermission : includes
  Permission ||--o{ RolePermission : grants
  Role ||--o{ RoleAssignment : assigned
  Organization ||--o{ RoleAssignment : scopes

  PerformanceReviewCycle ||--o{ PerformanceGoal : contains
  PerformanceGoal ||--o{ PerformanceKra : breaks_down_into
  PerformanceKra ||--o{ PerformanceKpi : measures
  PerformanceReviewCycle ||--o{ PerformanceReview : evaluates
  PerformanceReview ||--o{ PerformanceEvidence : supports
  PerformanceKpi ||--o{ PerformanceEvidence : proves
```
