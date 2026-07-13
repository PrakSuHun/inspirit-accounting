import { NextRequest, NextResponse } from "next/server";

// 단일 사용자 비밀번호 보호. 로컬/배포 공통.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 로그인 페이지·API·정적파일은 통과
  // MCP 커넥터(/api/mcp·/api/sse)는 쿠키 대신 자체 토큰(MCP_TOKEN)으로 인증하므로 통과
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/mcp") ||
    pathname.startsWith("/api/sse") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("inspirit_auth")?.value;
  if (cookie && cookie === process.env.APP_PASSWORD) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
