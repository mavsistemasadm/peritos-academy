// lib/queries/comunidade-metricas.ts
// Métricas agregadas e reais (nada de seed/fabricado), compartilhadas entre
// a página da Comunidade e a tela de login. Cross-usuário, então precisa
// bypassar RLS (RPC security definer estreita — nunca service role em código
// alcançável por sessão de usuário, ver lib/supabase/servico.ts). Cacheada
// 60s com um client sem cookie/sessão: os números são públicos e iguais pra
// qualquer visitante, então dá pra compartilhar o cache entre todo mundo.
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

export type MetricasComunidade = {
  totalPeritos: number
  postsSemana: number
  casosResolvidosSemana: number
}

export const carregarMetricasComunidade = unstable_cache(
  async (): Promise<MetricasComunidade> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase.rpc('comunidade_metricas').single()
    return {
      totalPeritos: (data as any)?.total_perfis ?? 0,
      postsSemana: (data as any)?.posts_semana ?? 0,
      casosResolvidosSemana: (data as any)?.casos_resolvidos_semana ?? 0,
    }
  },
  ['comunidade-metricas'],
  { revalidate: 60 }
)
