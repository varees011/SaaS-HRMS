import { Router, type Router as ExpressRouter } from "express";
import { authController } from "./auth.controller.js";
import {
  authenticate,
  requirePermissions
} from "../../core/auth.js";
import {
  changePasswordSchema,
  disableMfaSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  mfaCodeSchema,
  refreshSchema,
  resetPasswordSchema,
  sessionParamsSchema,
  sessionsQuerySchema
} from "./auth.schema.js";
import { authRateLimit } from "./auth-rate-limit.middleware.js";
import { validate } from "../../core/validate.middleware.js";

export const authRouter: ExpressRouter = Router();

authRouter.get(
  "/tenants",
  authController.tenants.bind(authController)
);
authRouter.post(
  "/login",
  authRateLimit,
  validate({ body: loginSchema }),
  authController.login.bind(authController)
);
authRouter.post(
  "/refresh",
  authRateLimit,
  validate({ body: refreshSchema }),
  authController.refresh.bind(authController)
);
authRouter.post(
  "/password/forgot",
  authRateLimit,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword.bind(authController)
);
authRouter.post(
  "/password/reset",
  authRateLimit,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword.bind(authController)
);

authRouter.use(authenticate);

authRouter.get(
  "/me",
  requirePermissions("self.profile.read"),
  authController.me.bind(authController)
);
authRouter.post(
  "/logout",
  validate({ body: logoutSchema }),
  authController.logout.bind(authController)
);
authRouter.post(
  "/password/change",
  requirePermissions("self.security.manage"),
  validate({ body: changePasswordSchema }),
  authController.changePassword.bind(authController)
);
authRouter.get(
  "/sessions",
  requirePermissions("self.sessions.manage"),
  validate({ query: sessionsQuerySchema }),
  authController.sessions.bind(authController)
);
authRouter.delete(
  "/sessions/:id",
  requirePermissions("self.sessions.manage"),
  validate({ params: sessionParamsSchema }),
  authController.revokeSession.bind(authController)
);
authRouter.post(
  "/mfa/setup",
  requirePermissions("self.security.manage"),
  authController.setupMfa.bind(authController)
);
authRouter.post(
  "/mfa/confirm",
  requirePermissions("self.security.manage"),
  validate({ body: mfaCodeSchema }),
  authController.confirmMfa.bind(authController)
);
authRouter.post(
  "/mfa/disable",
  requirePermissions("self.security.manage"),
  validate({ body: disableMfaSchema }),
  authController.disableMfa.bind(authController)
);
