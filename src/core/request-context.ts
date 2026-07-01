export interface RequestContext {
  requestId: string;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
}
