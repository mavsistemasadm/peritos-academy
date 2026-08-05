// components/PrimeiroAcessoContent.tsx
'use client'

import { useState } from 'react'
import { criarClienteBrowser } from '@/lib/supabase/client'

export default function PrimeiroAcessoContent() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'erro' | 'sucesso'>('parado')
  const [msgErro, setMsgErro] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEstado('enviando')
    const supabase = criarClienteBrowser()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${location.origin}/redefinir-senha`,
    })
    // Sucesso mesmo em erro de "email não existe": responder diferente para
    // email cadastrado e não cadastrado transformaria esta página num
    // verificador de quem é aluno da plataforma.
    if (error && !/not found|no user/i.test(error.message)) {
      setMsgErro(error.message)
      setEstado('erro')
      return
    }
    setEstado('sucesso')
  }

  return (
    <main className="pagina-login">
      <div className="grao" aria-hidden="true"></div>
      <section className="painel-form" style={{ width: '100%' }}>
        <div className="cartao-login">
          <a className="marca marca-mobile" href="/">
            <span>peritos<small>academy</small></span>
          </a>
          <span className="eyebrow">Primeiro acesso</span>

          {estado !== 'sucesso' && (
            <>
              <h2>Bem-vindo à nova plataforma.</h2>
              <p className="sub">
                Sua conta já está criada e seus cursos já estão liberados. Falta só
                definir a senha. Informe o e-mail que você usava na Peritos Academy
                e enviamos o link.
              </p>

              <form onSubmit={onSubmit}>
                <label className="campo">
                  <span>Seu e-mail</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="o e-mail da sua compra"
                  />
                </label>

                {estado === 'erro' && <p className="erro" role="alert">{msgErro}</p>}

                <button type="submit" className="btn btn-primario" disabled={estado === 'enviando'}>
                  {estado === 'enviando' ? 'Enviando…' : 'Receber link de acesso'}
                </button>
              </form>

              <p className="sub" style={{ marginTop: 'var(--s-3)' }}>
                Já tem senha? <a href="/login">Entrar</a>
              </p>
            </>
          )}

          {estado === 'sucesso' && (
            <>
              <h2>Link enviado.</h2>
              <p className="sub">
                Se esse e-mail estiver no nosso cadastro, o link de acesso chega em
                instantes. Abra o e-mail, defina sua senha e pronto — seus cursos
                estarão te esperando.
              </p>
              <p className="sub">
                Não chegou? Confira a caixa de spam ou{' '}
                <button
                  type="button"
                  onClick={() => setEstado('parado')}
                  style={{
                    background: 'none', border: 0, padding: 0,
                    color: 'var(--verde)', font: 'inherit',
                    textDecoration: 'underline', cursor: 'pointer',
                  }}
                >
                  tente outro e-mail
                </button>
                .
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
