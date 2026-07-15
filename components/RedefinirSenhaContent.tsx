// components/RedefinirSenhaContent.tsx
'use client'

import { useEffect, useState } from 'react'
import { criarClienteBrowser } from '@/lib/supabase/client'

export default function RedefinirSenhaContent() {
  const [pronto, setPronto] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'erro' | 'sucesso'>('parado')
  const [msgErro, setMsgErro] = useState('')

  useEffect(() => {
    const supabase = criarClienteBrowser()
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') setPronto(true)
    })
    // Se o hash já foi processado antes deste efeito montar, uma sessão de
    // recuperação válida já existe — libera o formulário mesmo sem o evento.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 6) { setMsgErro('A senha precisa ter pelo menos 6 caracteres.'); setEstado('erro'); return }
    if (senha !== confirmacao) { setMsgErro('As senhas não coincidem.'); setEstado('erro'); return }

    setEstado('enviando')
    const supabase = criarClienteBrowser()
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) { setMsgErro(error.message); setEstado('erro'); return }
    setEstado('sucesso')
    setTimeout(() => { location.href = '/login' }, 1500)
  }

  return (
    <main className="pagina-login">
      <div className="grao" aria-hidden="true"></div>
      <section className="painel-form" style={{ width: '100%' }}>
        <div className="cartao-login">
          <a className="marca marca-mobile" href="/">
            <span>peritos<small>academy</small></span>
          </a>
          <span className="eyebrow">Recuperação de senha</span>
          <h2>Defina sua nova senha.</h2>

          {!pronto && <p className="sub">Confirme pelo link enviado no seu e-mail pra continuar.</p>}

          {pronto && estado !== 'sucesso' && (
            <form onSubmit={onSubmit}>
              <label className="campo">
                <span>Nova senha</span>
                <input type="password" required autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </label>
              <label className="campo">
                <span>Confirme a nova senha</span>
                <input type="password" required autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} placeholder="Repita a senha" />
              </label>

              {estado === 'erro' && <p className="erro" role="alert">{msgErro}</p>}

              <button type="submit" className="btn btn-primario" disabled={estado === 'enviando'}>
                {estado === 'enviando' ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </form>
          )}

          {estado === 'sucesso' && <p className="sub">Senha atualizada, redirecionando pro login...</p>}
        </div>
      </section>
    </main>
  )
}
