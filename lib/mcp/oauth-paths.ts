/** مسارات ربط MCP العامة. ملف بلا اعتماد على Node حتى يستورده الـ middleware على Edge. */

export function isMcpOauthPublicPath(pathname: string): boolean {
  return (
    pathname === "/.well-known/oauth-protected-resource" ||
    pathname.startsWith("/.well-known/oauth-protected-resource/") ||
    pathname === "/.well-known/oauth-authorization-server" ||
    pathname.startsWith("/.well-known/oauth-authorization-server/") ||
    pathname === "/oauth/authorize" ||
    pathname.startsWith("/oauth/authorize/") ||
    pathname === "/oauth/token" ||
    pathname.startsWith("/oauth/token/") ||
    pathname === "/oauth/register" ||
    pathname.startsWith("/oauth/register/")
  );
}
