/**
 * ONDE ESTA PLATAFORMA MORA — a única linha que sabe o endereço.
 *
 * A Academy nasceu servida em `peritos-academy.vercel.app` e ganhou domínio
 * próprio em 14/08/2026: `evolua.peritosacademy.com.br`, apontado para o mesmo
 * deploy na Vercel. O endereço do produto é o domínio, não o host da
 * hospedagem — o `.vercel.app` é infraestrutura, e some no dia em que o deploy
 * sair de lá.
 *
 * ⚠️ **O endereço estava copiado em 38 lugares**, quase todos dentro do HTML
 * dos emails, e é por isso que ele existe aqui agora. Email não tem tela de
 * erro: um link para um host que deixou de responder não avisa ninguém — o
 * aluno clica, não abre, e desiste calado. E um endereço copiado em 38 lugares
 * não é trocado em 38 lugares no dia da mudança; é trocado em 30, e os outros 8
 * seguem apontando para o lugar velho sem nada acusando.
 *
 * Mudança de endereço é mudança **aqui, e só aqui**. Ninguém escreve o endereço
 * da plataforma à mão.
 *
 * Não lê env de propósito. `NEXT_PUBLIC_SITE_URL` era lida em
 * `app/admin/usuarios/actions.ts` com o `.vercel.app` de fallback, e nunca
 * esteve definida em produção (conferido na Vercel em 14/08/2026): o fallback
 * era o valor real, e a env só servia para o endereço do produto poder mudar
 * sem passar por revisão nenhuma.
 */
export const SITE_URL = 'https://evolua.peritosacademy.com.br'

/** O mesmo endereço sem o esquema, para onde a tela mostra o domínio ao usuário. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '')
