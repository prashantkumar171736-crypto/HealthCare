const ADMIN_LOGIN_PATH_PATTERN = /^\/[A-Za-z0-9_-]{32,}$/;
const DEFAULT_ADMIN_LOGIN_PATH = "/care-console-0690ab664602e108d88aecd47cacd9c3";

export function getAdminLoginPath(): string | null {
  const path = process.env.ADMIN_LOGIN_PATH?.trim();
  return path && ADMIN_LOGIN_PATH_PATTERN.test(path) ? path : DEFAULT_ADMIN_LOGIN_PATH;
}