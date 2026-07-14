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
  const pathname = request.nextUrl.pathname;
  const rotaNeutra =
    pathname === "/login" ||
    pathname === "/conta-suspensa" ||
    pathname === "/manutencao" ||
    pathname === "/email/cancelar";
  // Rotas de API têm autenticação própria (token/secret compartilhado —
  // cron, webhooks, ponte interna de email) e nunca devem ser redirecionadas
  // pra uma página HTML por suspensão/manutenção; isso quebraria o contrato
  // dessas rotas (esperam JSON/200, não um redirect 307).
  const ehRotaApi = pathname.startsWith("/api/");

  // Admin ativo — computado uma vez e reusado no gate de /admin e no bypass
  // de manutenção (evita duas queries iguais).
  let ehAdmin = false;
  if (auth?.user) {
    const { data: adminRow } = await supabase
      .from("admin_usuarios")
      .select("id")
      .eq("usuario_id", auth.user.id)
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();
    ehAdmin = !!adminRow;
  }

  // Suspenso/banido: bloqueio global (não só conteúdo pago) — checado aqui
  // em vez de tem_acesso_ativo porque esse RPC só gateia rotas de conteúdo
  // pago específicas; suspensão/banimento precisa cortar QUALQUER rota.
  if (auth?.user && !rotaNeutra && !ehRotaApi) {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("status")
      .eq("id", auth.user.id)
      .single();
    if (perfil?.status === "suspenso" || perfil?.status === "banido") {
      return NextResponse.redirect(new URL("/conta-suspensa", request.url));
    }
  }

  // Modo manutenção: bloqueia TODO visitante não-admin (logado ou não) em
  // qualquer rota — checado aqui (não no layout) porque precisa do pathname
  // pra excluir /login e /manutencao do próprio redirect sem entrar em loop,
  // e middleware já paga uma query por request nesse mesmo estilo (ver
  // suspensão acima); layout root não tem o pathname sem um hack extra.
  if (!rotaNeutra && !ehAdmin && !ehRotaApi) {
    const { data: config } = await supabase
      .from("config_plataforma")
      .select("modo_manutencao")
      .eq("id", 1)
      .maybeSingle();
    if (config?.modo_manutencao) {
      return NextResponse.redirect(new URL("/manutencao", request.url));
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!auth?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!ehAdmin) {
      return NextResponse.redirect(new URL("/acesso-negado", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};