const ADMIN_LOGIN_PATH_PATTERN = /^\/[A-Za-z0-9_-]{32,}$/;

export function getAdminLoginPath(): string | null {
  const path = process.env.ADMIN_LOGIN_PATH?.trim();
  return path && ADMIN_LOGIN_PATH_PATTERN.test(path) ? path : null;
}