import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Renova a sessão se o token estiver perto de expirar.
  const { data: auth } = await supabase.auth.getUser();

  // Suspenso/banido: bloqueio global (não só conteúdo pago) — checado aqui
  // em vez de tem_acesso_ativo porque esse RPC só gateia rotas de conteúdo
  // pago específicas; suspensão/banimento precisa cortar QUALQUER rota.
  if (auth?.user && request.nextUrl.pathname !== "/conta-suspensa" && request.nextUrl.pathname !== "/login") {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("status")
      .eq("id", auth.user.id)
      .single();
    if (perfil?.status === "suspenso" || perfil?.status === "banido") {
      return NextResponse.redirect(new URL("/conta-suspensa", request.url));
    }
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!auth?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const { data: adminRow } = await supabase
      .from("admin_usuarios")
      .select("id")
      .eq("usuario_id", auth.user.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    if (!adminRow) {
      return NextResponse.redirect(new URL("/acesso-negado", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};