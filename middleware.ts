import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Por enquanto, redireciona para /login se não tem cookie de sessão
  const temSessao = request.cookies.getAll().some(c => c.name.includes("sb-"));

  const publica = ["/login", "/auth", "/favicon.ico"].some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (!temSessao && !publica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};