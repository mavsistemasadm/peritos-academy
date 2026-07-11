import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Se não está logado e não está na página de login, redireciona
  const token = request.cookies.get("sb-access-token") || 
                request.cookies.getAll().find(c => c.name.includes("auth-token"));
  
  const publica = ["/login", "/auth", "/_next", "/favicon.ico"].some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (!token && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};