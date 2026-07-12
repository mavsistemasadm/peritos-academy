// app/desafios/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { criarClienteServidor } from '@/lib/supabase/server'

// ---------- ACEITAR A NOMEAÇÃO ----------
export async function aceitarDesafio(desafioId: string) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const, erro: 'Faça login para aceitar.' }

  const { error } = await supabase.from('desafio_entregas').upsert({
    desafio_id: desafioId,
    usuario_id: auth.user.id,
    aceito_em: new Date().toISOString(),
  }, { onConflict: 'desafio_id,usuario_id', ignoreDuplicates: true })

  if (error) return { ok: false as const, erro: error.message }
  revalidatePath('/desafios')
  return { ok: true as const }
}

// ---------- SALVAR RESPOSTAS (rascunho) ----------
export async function salvarRespostas(desafioId: string, respostas: { quesito_ordem: number; resposta: string }[]) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const }

  const { error } = await supabase.from('desafio_entregas')
    .update({ respostas })
    .eq('desafio_id', desafioId)
    .eq('usuario_id', auth.user.id)
  if (error) return { ok: false as const, erro: error.message }
  return { ok: true as const }
}

// ---------- PROTOCOLAR LAUDO (correção por IA) ----------
export async function protocolarLaudo(desafioId: string, respostas: { quesito_ordem: number; resposta: string }[]) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const, erro: 'Faça login para protocolar.' }

  const { data: entrega } = await supabase.from('desafio_entregas')
    .select('id, aceito_em, entregue_em')
    .eq('desafio_id', desafioId).eq('usuario_id', auth.user.id).single()
  if (!entrega?.aceito_em) return { ok: false as const, erro: 'Aceite o desafio antes de protocolar.' }
  if (entrega.entregue_em) return { ok: false as const, erro: 'Você já protocolou este desafio.' }

  const { data: desafio } = await supabase.from('desafios')
    .select('quesitos, xp, moedas').eq('id', desafioId).single()
  if (!desafio) return { ok: false as const, erro: 'Desafio não encontrado.' }

  const quesitosBanco = desafio.quesitos as any[]
  const tempoSeg = Math.floor((Date.now() - +new Date(entrega.aceito_em)) / 1000)

  let feedbacks: { quesito_ordem: number; nota: number; feedback: string; sugerir_refazer: boolean }[] = []
  let notaTotal = 0

  try {
    const prompt = quesitosBanco.map((q: any) => {
      const respostaAluno = respostas.find(r => r.quesito_ordem === q.ordem)?.resposta ?? '(não respondido)'
      return `QUESITO ${q.ordem}: ${q.enunciado}
TIPO: ${q.tipo}
RESPOSTA MODELO (gabarito): ${q.resposta_modelo}${q.tolerancia ? ` (tolerância: ±${q.tolerancia})` : ''}
RESPOSTA DO ALUNO: ${respostaAluno}`
    }).join('\n\n---\n\n')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: `Você é um perito contábil judicial experiente corrigindo o trabalho de um aluno. Para cada quesito, compare a resposta do aluno com a resposta modelo (gabarito).

Responda APENAS com um array JSON válido (sem markdown, sem backticks), onde cada elemento tem:
- "quesito_ordem": number
- "nota": number de 0 a 10 (para quesitos de valor, 10 se estiver dentro da tolerância, 0 se errado; para texto, avalie a precisão técnica e completude)
- "feedback": string com feedback construtivo e técnico em português, mencionando o que acertou e o que faltou (máx 200 caracteres)
- "sugerir_refazer": boolean (true se nota < 6)

Seja justo mas exigente — um laudo pericial precisa de precisão.`,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const texto = data.content?.map((c: any) => c.text || '').join('') ?? ''
    const limpo = texto.replace(/```json|```/g, '').trim()
    feedbacks = JSON.parse(limpo)
    notaTotal = feedbacks.length > 0
      ? Math.round((feedbacks.reduce((s, f) => s + f.nota, 0) / feedbacks.length) * 10) / 10
      : 0
  } catch (e) {
    console.error('[desafio] erro na correção por IA:', e)
    feedbacks = quesitosBanco.map((q: any) => {
      const respostaAluno = respostas.find(r => r.quesito_ordem === q.ordem)?.resposta ?? ''
      let nota = 0
      if (q.tipo === 'valor') {
        const valorAluno = parseFloat(respostaAluno.replace(/\s/g, '').replace(',', '.'))
        const valorModelo = parseFloat(String(q.resposta_modelo))
        const tol = q.tolerancia ?? 0
        if (!isNaN(valorAluno) && !isNaN(valorModelo) && Math.abs(valorAluno - valorModelo) <= tol) {
          nota = 10
        }
      }
      return {
        quesito_ordem: q.ordem,
        nota,
        feedback: nota === 10 ? 'Valor correto.' : 'Verifique o cálculo e tente novamente.',
        sugerir_refazer: nota < 6,
      }
    })
    notaTotal = feedbacks.length > 0
      ? Math.round((feedbacks.reduce((s, f) => s + f.nota, 0) / feedbacks.length) * 10) / 10
      : 0
  }

  const { error } = await supabase.from('desafio_entregas')
    .update({
      respostas,
      feedbacks,
      nota: notaTotal,
      tempo_seg: tempoSeg,
      entregue_em: new Date().toISOString(),
    })
    .eq('id', entrega.id)
  if (error) return { ok: false as const, erro: error.message }

  if (notaTotal >= 6) {
    const { data: perfil } = await supabase.from('perfis')
      .select('xp, moedas').eq('id', auth.user.id).single()
    if (perfil) {
      await supabase.from('perfis').update({
        xp: (perfil.xp ?? 0) + desafio.xp,
        moedas: (perfil.moedas ?? 0) + desafio.moedas,
      }).eq('id', auth.user.id)
    }
  }

  revalidatePath('/desafios')
  return {
    ok: true as const,
    nota: notaTotal,
    feedbacks,
    xp: notaTotal >= 6 ? desafio.xp : 0,
    moedas: notaTotal >= 6 ? desafio.moedas : 0,
  }
}

// ---------- BAIXAR DOCUMENTO DO PROCESSO ----------
export async function baixarDocumento(path: string) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const, erro: 'Faça login para baixar.' }

  const { data, error } = await supabase.storage
    .from('planilhas')
    .createSignedUrl(path, 120, { download: true })
  if (error || !data?.signedUrl) return { ok: false as const, erro: 'Erro ao gerar link.' }

  return { ok: true as const, url: data.signedUrl }
}

// ---------- BAIXAR GABARITO (só após entregar) ----------
export async function baixarGabarito(desafioId: string) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const, erro: 'Faça login.' }

  const { data: entrega } = await supabase.from('desafio_entregas')
    .select('entregue_em').eq('desafio_id', desafioId).eq('usuario_id', auth.user.id).maybeSingle()
  if (!entrega?.entregue_em) return { ok: false as const, erro: 'Protocole seu laudo antes de ver o gabarito.' }

  const { data: desafio } = await supabase.from('desafios')
    .select('gabarito_path').eq('id', desafioId).single()
  if (!desafio?.gabarito_path) return { ok: false as const, erro: 'Gabarito não disponível.' }

  const { data, error } = await supabase.storage
    .from('planilhas')
    .createSignedUrl(desafio.gabarito_path, 120, { download: true })
  if (error || !data?.signedUrl) return { ok: false as const, erro: 'Erro ao gerar link.' }

  return { ok: true as const, url: data.signedUrl }
}

// ---------- CURTIR ENTREGA (toggle) ----------
export async function curtirEntrega(entregaId: string) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const }

  const { data: existente } = await supabase.from('desafio_curtidas')
    .select('id').eq('entrega_id', entregaId).eq('usuario_id', auth.user.id).maybeSingle()

  if (existente) {
    await supabase.from('desafio_curtidas').delete().eq('id', existente.id)
  } else {
    await supabase.from('desafio_curtidas').insert({
      entrega_id: entregaId, usuario_id: auth.user.id,
    })
  }

  revalidatePath('/desafios')
  return { ok: true as const, curtiu: !existente }
}

// ---------- EXPLICAÇÃO APROFUNDADA (IA) ----------
export async function explicarQuesito(
  desafioId: string,
  quesitoOrdem: number,
  respostaAluno: string
) {
  const supabase = await criarClienteServidor()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return { ok: false as const, erro: 'Faça login.' }

const { data: desafio } = await supabase.from('desafios')
    .select('quesitos, titulo, intimacao_texto, instrucoes').eq('id', desafioId).single()
  if (!desafio) return { ok: false as const, erro: 'Desafio não encontrado.' }

  const quesito = (desafio.quesitos as any[]).find((q: any) => q.ordem === quesitoOrdem)
  if (!quesito) return { ok: false as const, erro: 'Quesito não encontrado.' }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
system: `Você é um perito contábil judicial experiente e professor paciente. O aluno está fazendo o desafio "${desafio.titulo}".

CONTEXTO DO CASO:
${desafio.intimacao_texto}

INSTRUÇÕES DO DESAFIO:
${(desafio.instrucoes as string[]).join('\n')}

O aluno errou uma pergunta. Explique de forma clara e didática:
1. Por que a resposta dele está errada, considerando o contexto específico deste processo
2. Como chegar na resposta correta, passo a passo, mostrando de onde tirar os dados na sentença
3. Uma dica prática pra não errar isso num laudo real

Seja direto, técnico mas acessível. Use português brasileiro. Máximo 4 parágrafos curtos.`,
        messages: [{
          role: 'user',
          content: `PERGUNTA: ${quesito.enunciado}
RESPOSTA CORRETA (gabarito): ${quesito.resposta_modelo}
RESPOSTA DO ALUNO: ${respostaAluno}
${quesito.tipo === 'valor' && quesito.tolerancia ? `TOLERÂNCIA: ±${quesito.tolerancia}` : ''}

Explique por que a resposta está errada e como chegar no valor correto.`
        }],
      }),
    })

    const data = await response.json()
    const texto = data.content?.map((c: any) => c.text || '').join('') ?? ''
    return { ok: true as const, explicacao: texto }
  } catch (e) {
    console.error('[desafio] erro na explicação:', e)
    return { ok: false as const, erro: 'Não foi possível gerar a explicação.' }
  }
}