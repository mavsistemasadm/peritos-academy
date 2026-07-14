// components/AdminConfiguracoesContent.tsx
'use client'

import { useState, useTransition } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { ConfigPlataforma, IntegracaoStatus } from '@/lib/queries/admin-configuracoes'
import {
  atualizarIdentidade, uploadLogo, uploadFavicon, uploadOgImage,
  atualizarComportamento, atualizarTextos, atualizarSEO,
} from '@/app/admin/configuracoes/actions'
import { IconeCheck, IconeAlertTriangle, IconeLink } from '@/components/Icones'
import { useAdminToast, AdminToastContainer } from '@/components/AdminToast'

type Aba = 'identidade' | 'comportamento' | 'textos' | 'seo' | 'integracoes'

export default function AdminConfiguracoesContent({ config, integracoes }: {
  config: ConfigPlataforma; integracoes: IntegracaoStatus[]
}) {
  const [aba, setAba] = useState<Aba>('identidade')
  const toast = useAdminToast()

  return (
    <div className="ad-cursos">
      <AdminToastContainer toasts={toast.toasts} remover={toast.remover} />
      <div className="ad-cursos-cab">
        <div>
          <h1>Configurações</h1>
          <p className="ad-sub">Identidade, comportamento e textos gerais da plataforma. Gamificação, Financeiro e Notificações têm configuração própria nos respectivos módulos.</p>
        </div>
      </div>

      <div className="ad-abas">
        <button type="button" className={`ad-aba${aba === 'identidade' ? ' ativa' : ''}`} onClick={() => setAba('identidade')}>Identidade</button>
        <button type="button" className={`ad-aba${aba === 'comportamento' ? ' ativa' : ''}`} onClick={() => setAba('comportamento')}>Comportamento</button>
        <button type="button" className={`ad-aba${aba === 'textos' ? ' ativa' : ''}`} onClick={() => setAba('textos')}>Textos</button>
        <button type="button" className={`ad-aba${aba === 'seo' ? ' ativa' : ''}`} onClick={() => setAba('seo')}>SEO</button>
        <button type="button" className={`ad-aba${aba === 'integracoes' ? ' ativa' : ''}`} onClick={() => setAba('integracoes')}>Integrações</button>
      </div>

      {aba === 'identidade' && <IdentidadeAba config={config} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'comportamento' && <ComportamentoAba config={config} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'textos' && <TextosAba config={config} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'seo' && <SEOAba config={config} onErro={toast.erro} onSucesso={toast.sucesso} />}
      {aba === 'integracoes' && <IntegracoesAba integracoes={integracoes} />}
    </div>
  )
}

// ============================================================
// Identidade
// ============================================================
function IdentidadeAba({ config, onErro, onSucesso }: { config: ConfigPlataforma; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [logoUrl, setLogoUrl] = useState(config.logoUrl)
  const [faviconUrl, setFaviconUrl] = useState(config.faviconUrl)

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarIdentidade(fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Identidade salva com sucesso'); router.refresh() }
    })
  }

  function onUploadLogo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    const fd = new FormData()
    fd.set('arquivo', arquivo)
    startTransition(async () => {
      const r = await uploadLogo(fd)
      if (!r.ok) onErro(r.erro)
      else { setLogoUrl(r.url ?? null); onSucesso('Logo atualizado com sucesso'); router.refresh() }
    })
  }

  function onUploadFavicon(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    const fd = new FormData()
    fd.set('arquivo', arquivo)
    startTransition(async () => {
      const r = await uploadFavicon(fd)
      if (!r.ok) onErro(r.erro)
      else { setFaviconUrl(r.url ?? null); onSucesso('Favicon atualizado com sucesso'); router.refresh() }
    })
  }

  return (
    <>
      <section className="ad-card">
        <h2>Logo e favicon</h2>
        <div className="ad-form-linha" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="ad-capa-preview ad-capa-preview-sm" style={logoUrl ? { backgroundImage: `url(${logoUrl})` } : undefined}>
              {!logoUrl && <span>Sem logo</span>}
            </div>
            <label className="ad-btn-secundario ad-upload-btn" style={{ marginTop: 8 }}>
              Trocar logo
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onUploadLogo} hidden disabled={pendente} />
            </label>
          </div>
          <div>
            <div className="ad-capa-preview ad-capa-preview-sm" style={faviconUrl ? { backgroundImage: `url(${faviconUrl})` } : undefined}>
              {!faviconUrl && <span>Sem favicon</span>}
            </div>
            <label className="ad-btn-secundario ad-upload-btn" style={{ marginTop: 8 }}>
              Trocar favicon
              <input type="file" accept="image/png,image/x-icon,image/svg+xml" onChange={onUploadFavicon} hidden disabled={pendente} />
            </label>
          </div>
        </div>
        <p className="ad-fin-nota">Sem logo, o cabeçalho e a tela de login mostram o texto padrão "peritos academy".</p>
      </section>

      <section className="ad-card">
        <h2>Identidade e contato</h2>
        <form onSubmit={onSalvar} className="ad-form">
          <div className="ad-form-linha">
            <label>Nome da plataforma
              <input name="nome_plataforma" defaultValue={config.nomePlataforma} required />
            </label>
            <label>Slogan
              <input name="slogan" defaultValue={config.slogan ?? ''} placeholder="Do conhecimento à autoridade." />
            </label>
          </div>
          <div className="ad-form-linha">
            <label>E-mail de suporte
              <input name="email_suporte" type="email" defaultValue={config.emailSuporte ?? ''} placeholder="suporte@peritosacademy.com" />
            </label>
            <label>WhatsApp de suporte
              <input name="whatsapp_suporte" defaultValue={config.whatsappSuporte ?? ''} placeholder="+55 11 90000-0000" />
            </label>
          </div>
          <div className="ad-form-linha">
            <label>Instagram
              <input name="instagram_url" defaultValue={config.instagramUrl ?? ''} placeholder="https://instagram.com/..." />
            </label>
            <label>YouTube
              <input name="youtube_url" defaultValue={config.youtubeUrl ?? ''} placeholder="https://youtube.com/..." />
            </label>
            <label>LinkedIn
              <input name="linkedin_url" defaultValue={config.linkedinUrl ?? ''} placeholder="https://linkedin.com/..." />
            </label>
          </div>
          <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar'}</button>
        </form>
      </section>
    </>
  )
}

// ============================================================
// Comportamento
// ============================================================
function ComportamentoAba({ config, onErro, onSucesso }: { config: ConfigPlataforma; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [manutencao, setManutencao] = useState(config.modoManutencao)

  function onToggleManutencao(e: ChangeEvent<HTMLInputElement>) {
    const ligando = e.target.checked
    if (ligando) {
      if (!confirm('Ativar o modo manutenção? Todo visitante que não for admin será redirecionado pra uma página de manutenção em TODAS as rotas.')) {
        e.target.checked = false
        return
      }
    }
    setManutencao(ligando)
  }

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (manutencao && !config.modoManutencao) {
      if (!confirm('Confirma mesmo? Ao salvar, o modo manutenção entra em vigor imediatamente.')) return
    }
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarComportamento(fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Comportamento salvo com sucesso'); router.refresh() }
    })
  }

  return (
    <form onSubmit={onSalvar}>
      <section className="ad-card">
        <h2>Pós-login e módulos públicos</h2>
        <label>Página inicial após o login
          <input name="pagina_inicial_pos_login" defaultValue={config.paginaInicialPosLogin} placeholder="/" />
        </label>
        <div className="ad-form-linha" style={{ marginTop: 12 }}>
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="comunidade_ativa" defaultChecked={config.comunidadeAtiva} />
            Comunidade ativa
          </label>
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="desafios_ativos" defaultChecked={config.desafiosAtivos} />
            Desafios ativos
          </label>
          <label className="ad-checkbox-linha">
            <input type="checkbox" name="agenda_ativa" defaultChecked={config.agendaAtiva} />
            Agenda ativa
          </label>
        </div>
        <p className="ad-fin-nota">Desligar um módulo esconde o link no menu E bloqueia acesso direto à rota.</p>
      </section>

      <section className="ad-card">
        <h2><IconeAlertTriangle size={16} /> Modo manutenção</h2>
        <label className="ad-checkbox-linha">
          <input type="checkbox" name="modo_manutencao" checked={manutencao} onChange={onToggleManutencao} />
          Ativar modo manutenção
        </label>
        <label style={{ marginTop: 10 }}>Mensagem exibida aos visitantes
          <textarea name="mensagem_manutencao" defaultValue={config.mensagemManutencao ?? ''} rows={3} placeholder="Estamos em manutenção programada. Voltamos em breve." />
        </label>
        <p className="ad-fin-nota">Admins continuam navegando normalmente e veem um banner fixo avisando que o modo manutenção está ativo.</p>
      </section>

      <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar'}</button>
    </form>
  )
}

// ============================================================
// Textos
// ============================================================
function TextosAba({ config, onErro, onSucesso }: { config: ConfigPlataforma; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarTextos(fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('Textos salvos com sucesso'); router.refresh() }
    })
  }

  return (
    <section className="ad-card">
      <h2>Textos institucionais</h2>
      <p>Renderizados em <a href="/termos" target="_blank" style={{ textDecoration: 'underline' }}>/termos</a> e <a href="/privacidade" target="_blank" style={{ textDecoration: 'underline' }}>/privacidade</a> (um parágrafo por linha).</p>
      <form onSubmit={onSalvar} className="ad-form">
        <label>Termos de uso
          <textarea name="termos_uso" defaultValue={config.termosUso ?? ''} rows={8} />
        </label>
        <label>Política de privacidade
          <textarea name="politica_privacidade" defaultValue={config.politicaPrivacidade ?? ''} rows={8} />
        </label>
        <label>Texto do rodapé
          <input name="texto_rodape" defaultValue={config.textoRodape ?? ''} placeholder="© Peritos Academy. Todos os direitos reservados." />
        </label>
        <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar'}</button>
      </form>
    </section>
  )
}

// ============================================================
// SEO
// ============================================================
function SEOAba({ config, onErro, onSucesso }: { config: ConfigPlataforma; onErro: (e: string) => void; onSucesso: (m: string) => void }) {
  const router = useRouter()
  const [pendente, startTransition] = useTransition()
  const [ogImageUrl, setOgImageUrl] = useState(config.ogImageUrl)
  const [metaTitulo, setMetaTitulo] = useState(config.metaTitulo ?? config.nomePlataforma)
  const [metaDescricao, setMetaDescricao] = useState(config.metaDescricao ?? '')

  function onSalvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await atualizarSEO(fd)
      if (!r.ok) onErro(r.erro)
      else { onSucesso('SEO salvo com sucesso'); router.refresh() }
    })
  }

  function onUploadOg(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    const fd = new FormData()
    fd.set('arquivo', arquivo)
    startTransition(async () => {
      const r = await uploadOgImage(fd)
      if (!r.ok) onErro(r.erro)
      else { setOgImageUrl(r.url ?? null); onSucesso('Imagem de compartilhamento atualizada com sucesso'); router.refresh() }
    })
  }

  return (
    <section className="ad-card">
      <h2>SEO e compartilhamento</h2>
      <form onSubmit={onSalvar} className="ad-form">
        <label>Meta título
          <input name="meta_titulo" value={metaTitulo} onChange={e => setMetaTitulo(e.target.value)} />
        </label>
        <label>Meta descrição
          <textarea name="meta_descricao" value={metaDescricao} onChange={e => setMetaDescricao(e.target.value)} rows={2} />
        </label>

        <div>
          <span style={{ fontSize: 13.5, fontWeight: 650, display: 'block', marginBottom: 8 }}>Imagem de compartilhamento (og:image)</span>
          <label className="ad-btn-secundario ad-upload-btn">
            {ogImageUrl ? 'Trocar imagem' : 'Enviar imagem'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadOg} hidden />
          </label>
        </div>

        <div className="ad-og-preview">
          {ogImageUrl
            ? <img src={ogImageUrl} alt="Preview og:image" />
            : <div style={{ height: 180, display: 'grid', placeItems: 'center', color: 'var(--cinza)', fontSize: 12.5 }}>Sem imagem</div>}
          <div className="ad-og-preview-corpo">
            <div className="ad-og-preview-dominio">peritos-academy.vercel.app</div>
            <div className="ad-og-preview-titulo">{metaTitulo || config.nomePlataforma}</div>
            <div className="ad-og-preview-desc">{metaDescricao || 'Descrição aparece aqui quando o link for compartilhado.'}</div>
          </div>
        </div>

        <button type="submit" className="ad-btn-primario" disabled={pendente}>{pendente ? 'Salvando...' : 'Salvar'}</button>
      </form>
    </section>
  )
}

// ============================================================
// Integrações
// ============================================================
function IntegracoesAba({ integracoes }: { integracoes: IntegracaoStatus[] }) {
  return (
    <>
      <section className="ad-card">
        <h2>Status das integrações</h2>
        <p>Somente leitura — chaves e tokens nunca são exibidos aqui, só se estão presentes ou não.</p>
        {integracoes.map(i => (
          <div key={i.chave} className="ad-integracao-linha">
            <div>
              <div className="ad-integracao-nome">{i.nome}</div>
              <div className="ad-integracao-onde">{i.info ?? i.onde}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`ad-status-pill ${i.configurada ? 'ativa' : 'cancelada'}`}>
                {i.configurada ? <><IconeCheck size={12} /> Configurada</> : <><IconeAlertTriangle size={12} /> Ausente</>}
              </span>
              <a href={i.docUrl} target="_blank" rel="noreferrer" className="ad-btn-secundario" title="Ver documentação">
                <IconeLink size={13} />
              </a>
            </div>
          </div>
        ))}
      </section>

      <section className="ad-card">
        <h2>Pendência conhecida</h2>
        <p>
          <code>config_gamificacao.moeda_icone</code> é editável no{' '}
          <a href="/admin/gamificacao" style={{ textDecoration: 'underline' }}>módulo Gamificação</a>, mas nenhum uso do emblema de Moeda no app lê esse campo hoje — os usos são todos o emblema fixo do Nível 2 (<code>components/Emblemas.tsx</code>).
        </p>
      </section>
    </>
  )
}
