// app/primeiro-acesso/page.tsx
// Porta de entrada do aluno migrado da Ensinio: ele já tem conta (criada pela
// importação em lote), mas nunca teve senha — a importação gera uma aleatória
// que ninguém conhece, de propósito.
//
// Por que uma página em vez de mandar um link pronto no email da migração:
// link de recuperação do Supabase expira, e uma campanha de email pra 400
// pessoas é lida ao longo de dias/semanas. Mandar link pronto geraria uma
// enxurrada de "meu link não funciona". Aqui o aluno pede o link na hora em
// que decidiu entrar, e ele nasce válido.
import type { Metadata } from 'next'
import PrimeiroAcessoContent from '@/components/PrimeiroAcessoContent'

export const metadata: Metadata = {
  title: 'Primeiro acesso · Peritos Academy',
}

export const dynamic = 'force-dynamic'

export default function PaginaPrimeiroAcesso() {
  return <PrimeiroAcessoContent />
}
