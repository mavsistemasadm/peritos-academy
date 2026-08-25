/**
 * PARA ONDE VOLTAR DEPOIS DO LOGIN.
 *
 * Existe por causa do link de evento colado no WhatsApp: quem recebe e ainda
 * não tem sessão clica, cai no login e, sem isto, chega na home — clicou num
 * convite para um evento específico e desembarcou num painel genérico, sem
 * nada dizendo o que aconteceu. Na prática, desistiu.
 *
 * ⚠️ Valida em vez de confiar. `?next=` vem da barra de endereço, ou seja, de
 * qualquer um: sem esta função, um link `/login?next=https://sitedele.com`
 * transformaria o login da Academy num trampolim de phishing — a pessoa
 * digita a senha no domínio certo e é despejada no domínio de outro, com a
 * confiança já concedida. Só sobrevive caminho interno.
 *
 * `//outro.com` e `/\outro.com` são recusados de propósito: o navegador lê os
 * dois como endereço absoluto, apesar da primeira barra.
 */
export function destinoSeguro(valor: string | null | undefined): string | null {
  if (!valor) return null
  const v = valor.trim()
  if (!v.startsWith('/')) return null
  if (v.startsWith('//') || v.startsWith('/\\')) return null
  return v
}
