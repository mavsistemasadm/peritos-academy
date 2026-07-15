// components/LoginContent.tsx
'use client'

import { useState } from 'react'
import { criarClienteBrowser } from '@/lib/supabase/client'
import { IconeChevronRight } from '@/components/Icones'

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

function traduzErro(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar.'
  if (/too many requests/i.test(msg)) return 'Muitas tentativas. Aguarde um instante e tente de novo.'
  return msg || 'Algo falhou. Tente de novo.'
}

type Selos = { membros: number; missoes: number; casos: number }

export default function LoginContent({ selos, nomePlataforma, logoUrl, paginaInicialPosLogin }: {
  selos: Selos; nomePlataforma: string; logoUrl: string | null; paginaInicialPosLogin: string
}) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'erro'>('parado')
  const [msgErro, setMsgErro] = useState('')

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEstado('enviando')
    const supabase = criarClienteBrowser()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setMsgErro(traduzErro(error.message))
      setEstado('erro')
      return
    }
    // recarrega pelo servidor para a sessão valer em toda a plataforma
    location.href = paginaInicialPosLogin || '/'
  }

  const logo = logoUrl
    ? <img src={logoUrl} alt={nomePlataforma} className="marca-img" />
    : <span>peritos<small>academy</small></span>

  return (
    <main className="pagina-login">
      <div className="grao" aria-hidden="true"></div>

      {/* ============ PAINEL EDITORIAL ============ */}
      <section className="painel-marca" aria-hidden="true">
        <div className="aurora-log"></div>
        <a className="marca" href="/">
          {logo}
        </a>
        <div className="painel-frase">
          <span className="eyebrow">Plataforma do perito</span>
          <h1>Do conhecimento à <span className="grad-txt">autoridade.</span></h1>
          <p>Aulas, casos reais, jornada de evolução e a comunidade que assina laudos, tudo em um lugar.</p>
        </div>
        <div className="painel-selos num">
          <div className="selo"><b>{fmtNum(selos.membros)}</b><span>peritos na comunidade</span></div>
          <div className="selo"><b>{selos.missoes}</b><span>missões na jornada</span></div>
          <div className="selo"><b>{selos.casos}</b><span>casos resolvidos esta semana</span></div>
        </div>
      </section>

      {/* ============ CARTÃO DE LOGIN ============ */}
      <section className="painel-form">
        <div className="cartao-login">
          <a className="marca marca-mobile" href="/">
            {logo}
          </a>
          <span className="eyebrow">Acesso do aluno</span>
          <h2>Bem-vindo de volta.</h2>
          <p className="sub">Entre com seu e-mail e senha.</p>

          <form onSubmit={entrar}>
            <label className="campo">
              <span>E-mail</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </label>
            <label className="campo">
              <span>Senha</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Sua senha"
              />
            </label>

            {estado === 'erro' && (
              <p className="erro" role="alert">{msgErro}</p>
            )}

            <button type="submit" className="btn btn-primario" disabled={estado === 'enviando'}>
              {estado === 'enviando' ? 'Entrando…' : 'Entrar'}
              {estado !== 'enviando' && (
                <IconeChevronRight size={13} strokeWidth={2.4} />
              )}
            </button>
          </form>

          <p className="rodape-form">Acesso em breve também pelo <b>Nexus</b>, com login único.</p>
        </div>
      </section>
    </main>
  )
}