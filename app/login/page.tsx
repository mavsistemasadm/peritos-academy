    "use client";

    import { useState } from "react";
    import { criarClienteBrowser } from "@/lib/supabase/client";

    export default function Login() {
    const [email, setEmail] = useState("");
    const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "erro">("parado");

    async function entrar(e: React.FormEvent) {
        e.preventDefault();
        setEstado("enviando");
        const supabase = criarClienteBrowser();
        const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/` },
        });
        setEstado(error ? "erro" : "enviado");
    }

    return (
        <main className="grid min-h-screen place-items-center px-6">
        <div className="w-full max-w-sm text-center">
            <h1 className="text-4xl font-bold tracking-tight">
            Bem-vindo de volta.
            </h1>
            <p className="mt-3 text-sm text-gray-400">
            Entre com seu e-mail — enviamos um link mágico.
            </p>
            {estado === "enviado" ? (
            <p className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/5 p-6 text-sm text-gray-300">
                Link enviado! Confira sua caixa de entrada.
            </p>
            ) : (
            <form onSubmit={entrar} className="mt-8 flex flex-col gap-4">
                <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5
                            text-sm outline-none placeholder:text-gray-500
                            focus:border-green-500/45"
                />
                <button
                type="submit"
                disabled={estado === "enviando"}
                className="rounded-full bg-white py-3.5 text-sm font-semibold
                            text-black transition hover:scale-[1.02] disabled:opacity-40"
                >
                {estado === "enviando" ? "Enviando…" : "Enviar link de acesso"}
                </button>
                {estado === "erro" && (
                <p className="text-sm text-red-400">Algo falhou — tente de novo.</p>
                )}
            </form>
            )}
        </div>
        </main>
    );
    }