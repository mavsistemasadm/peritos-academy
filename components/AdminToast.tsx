// components/AdminToast.tsx
// Feedback de salvar/criar/excluir pro admin: toast simples e reutilizável.
// Sucesso some sozinho (~3s); erro fica até o usuário fechar. Uso:
//   const toast = useAdminToast()
//   toast.sucesso('Etapa salva com sucesso')
//   toast.erro(r.erro)
//   <AdminToastContainer {...toast} /> em algum ponto fixo da árvore
'use client'

import { useCallback, useRef, useState } from 'react'
import { IconeCheck, IconeAlertTriangle, IconeClose } from '@/components/Icones'

type TipoToast = 'sucesso' | 'erro'
type ToastItem = { id: number; tipo: TipoToast; mensagem: string }

export function useAdminToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const remover = useCallback((id: number) => {
    setToasts(ts => ts.filter(t => t.id !== id))
  }, [])

  const mostrar = useCallback((tipo: TipoToast, mensagem: string) => {
    const id = ++idRef.current
    setToasts(ts => [...ts, { id, tipo, mensagem }])
    if (tipo === 'sucesso') {
      setTimeout(() => remover(id), 3000)
    }
  }, [remover])

  const sucesso = useCallback((mensagem: string) => mostrar('sucesso', mensagem), [mostrar])
  const erro = useCallback((mensagem: string) => mostrar('erro', mensagem), [mostrar])

  return { toasts, sucesso, erro, remover }
}

export function AdminToastContainer({ toasts, remover }: { toasts: ToastItem[]; remover: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div className="ad-toast-pilha">
      {toasts.map(t => (
        <div key={t.id} className={`ad-toast ad-toast-${t.tipo}`} role="status">
          <span className="ad-toast-ico" aria-hidden="true">
            {t.tipo === 'sucesso' ? <IconeCheck size={15} /> : <IconeAlertTriangle size={15} />}
          </span>
          <span className="ad-toast-msg">{t.mensagem}</span>
          <button type="button" className="ad-toast-fechar" onClick={() => remover(t.id)} aria-label="Fechar aviso">
            <IconeClose size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
