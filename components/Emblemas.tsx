// components/Emblemas.tsx
// NÍVEL 2 da identidade de ícones — gamificação e status (não navegação/ação;
// pra isso use components/Icones.tsx). Cores semânticas fixas: fogo=sequência,
// dourado=moeda/XP/conquista, verde=conquista de etapa, roxo=nível,
// vermelho=ao vivo. Cada emblema aceita variante="mono" (traço 1.5px
// currentColor, sem gradiente) pra contextos de navegação/lista — ex.: o
// mesmo desenho do Certificado aparece dourado no popup de conquista e mono
// no menu do avatar.
'use client'

import { useId } from 'react'

export type EmblemaProps = {
  size?: number
  variante?: 'cor' | 'mono'
  className?: string
}

const MONO_ATTRS = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function FogoStreak({ size = 20, variante = 'cor', className }: EmblemaProps) {
  const uid = useId()
  const gradId = `gam-fogo-${uid}`
  const caminho = 'M12 2c2.2 4-2.6 5.2-2.6 9a2.6 2.6 0 0 0 5.2 0c0-1-.8-1.8-.8-2.8 2 1.2 3.2 3.4 3.2 6.2a5 5 0 0 1-10 0c0-5.4 3.2-7.6 5-12.4z'
  if (variante === 'mono') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d={caminho} {...MONO_ATTRS} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="6" y1="2" x2="18" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd166" />
          <stop offset="0.5" stopColor="#ff8c42" />
          <stop offset="1" stopColor="#ef476f" />
        </linearGradient>
      </defs>
      <path d={caminho} fill={`url(#${gradId})`} />
      <path d="M12 13.2a2 2 0 0 0 2-2c0-.6-.3-1-.5-1.5.7.7 1.1 1.6 1.1 2.7a2.6 2.6 0 0 1-5.2 0c0-1.4.5-2.4 1.2-3.4-.3 1.6.4 4.2 1.4 4.2z" fill="#fff" opacity="0.55" />
    </svg>
  )
}

export function Moeda({ size = 18, variante = 'cor', className }: EmblemaProps) {
  const uid = useId()
  const gradId = `gam-moeda-${uid}`
  if (variante === 'mono') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="9" {...MONO_ATTRS} />
        <path d="M9.5 15c.5 1 1.4 1.5 2.5 1.5 1.7 0 2.7-1 2.7-2.2 0-3-5.2-1.4-5.2-4.4 0-1.2 1-2.2 2.5-2.2 1.1 0 2 .5 2.5 1.5M12 6.5v11" {...MONO_ATTRS} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0cf8a" />
          <stop offset="0.55" stopColor="#d4a94e" />
          <stop offset="1" stopColor="#a87e2f" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" fill={`url(#${gradId})`} />
      <circle cx="12" cy="12" r="6.4" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1" />
      <path d="M8.5 15c.4 1 1.5 1.6 2.6 1.6 1.8 0 2.9-1 2.9-2.3 0-3.1-5.4-1.4-5.4-4.6 0-1.3 1.1-2.3 2.7-2.3 1.1 0 2.1.5 2.6 1.6" fill="none" stroke="#5a4419" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 6.5v11" stroke="#5a4419" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8 8.5a7 7 0 0 1 4-2" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function XP({ size = 18, variante = 'cor', className }: EmblemaProps) {
  const uid = useId()
  const gradId = `gam-xp-${uid}`
  const hexagono = 'M12 2.5 20 7v10l-8 4.5L4 17V7z'
  const raio = 'M13 6.5 8.5 14H12l-1 5.5L16.5 11H13z'
  if (variante === 'mono') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d={hexagono} {...MONO_ATTRS} />
        <path d={raio} fill="currentColor" stroke="none" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="4" y1="2.5" x2="20" y2="21.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0cf8a" />
          <stop offset="0.55" stopColor="#d4a94e" />
          <stop offset="1" stopColor="#a87e2f" />
        </linearGradient>
      </defs>
      <path d={hexagono} fill={`url(#${gradId})`} stroke="#fff" strokeOpacity="0.25" strokeWidth="0.5" />
      <path d={raio} fill="#fff" />
    </svg>
  )
}

export function Certificado({ size = 18, variante = 'cor', className }: EmblemaProps) {
  const uid = useId()
  const gradId = `gam-cert-${uid}`
  const fitas = 'M9 14.5 7 22l5-2.6 5 2.6-2-7.5'
  if (variante === 'mono') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d={fitas} {...MONO_ATTRS} />
        <circle cx="12" cy="9" r="6.5" {...MONO_ATTRS} />
        <path d="M9 9l2 2 4-4" {...MONO_ATTRS} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="5.5" y1="2.5" x2="18.5" y2="15.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0cf8a" />
          <stop offset="0.55" stopColor="#d4a94e" />
          <stop offset="1" stopColor="#a87e2f" />
        </linearGradient>
      </defs>
      <path d={fitas} fill="#a87e2f" />
      <circle cx="12" cy="9" r="6.5" fill={`url(#${gradId})`} stroke="#fff" strokeOpacity="0.3" strokeWidth="0.6" />
      <path d="M9 9.2l1.8 1.8L15 7" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function InsigniaEtapa({ size = 18, variante = 'cor', className }: EmblemaProps) {
  const uid = useId()
  const gradId = `gam-etapa-${uid}`
  const escudo = 'M12 2.5l7 2.7v6c0 5-3 8-7 9.3-4-1.3-7-4.3-7-9.3v-6z'
  if (variante === 'mono') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d={escudo} {...MONO_ATTRS} />
        <path d="M8.7 12.2l2.3 2.3 4.3-4.6" {...MONO_ATTRS} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="5" y1="2.5" x2="19" y2="20.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5be3ae" />
          <stop offset="1" stopColor="#0f9d6e" />
        </linearGradient>
      </defs>
      <path d={escudo} fill={`url(#${gradId})`} stroke="#fff" strokeOpacity="0.25" strokeWidth="0.6" />
      <path d="M8.7 12.2l2.3 2.3 4.3-4.6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SeloNivel({ size = 18, variante = 'cor', className, nivel }: EmblemaProps & { nivel?: number }) {
  const uid = useId()
  const gradId = `gam-nivel-${uid}`
  const selo = 'M12 2l2.6 1.9 3.2-.3 1 3 2.6 1.9-1.1 3 1.1 3-2.6 1.9-1 3-3.2-.3L12 22l-2.6-1.9-3.2.3-1-3-2.6-1.9 1.1-3-1.1-3 2.6-1.9 1-3 3.2.3z'
  const mostrarNumero = typeof nivel === 'number' && nivel > 0
  if (variante === 'mono') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d={selo} {...MONO_ATTRS} />
        {mostrarNumero && (
          <text x="12" y="15.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">{nivel}</text>
        )}
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c9a8f5" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <path d={selo} fill={`url(#${gradId})`} stroke="#fff" strokeOpacity="0.25" strokeWidth="0.5" />
      {mostrarNumero && (
        <text x="12" y="15.2" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">{nivel}</text>
      )}
    </svg>
  )
}

export function Trofeu({ size = 18, variante = 'cor', className }: EmblemaProps) {
  const uid = useId()
  const gradId = `gam-trofeu-${uid}`
  const copo = 'M7 3h10v5a5 5 0 0 1-10 0z'
  const alcas = 'M7 4H4a1 1 0 0 0-1 1c0 2.5 1.8 4.3 4 4.7M17 4h3a1 1 0 0 1 1 1c0 2.5-1.8 4.3-4 4.7'
  const base = 'M10 13v2.5h4V13M8.5 20.5h7M9.5 17.5h5l.5 3h-6z'
  if (variante === 'mono') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path d={copo} {...MONO_ATTRS} />
        <path d={alcas} {...MONO_ATTRS} />
        <path d={base} {...MONO_ATTRS} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="7" y1="3" x2="17" y2="15.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0cf8a" />
          <stop offset="0.55" stopColor="#d4a94e" />
          <stop offset="1" stopColor="#a87e2f" />
        </linearGradient>
      </defs>
      <path d={alcas} fill="none" stroke={`url(#${gradId})`} strokeWidth="1.5" strokeLinecap="round" />
      <path d={copo} fill={`url(#${gradId})`} />
      <path d={base} fill="#a87e2f" />
    </svg>
  )
}

export function AoVivo({ size = 16, variante = 'cor', className }: EmblemaProps) {
  if (variante === 'mono') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="6" {...MONO_ATTRS} strokeWidth={1.3} opacity={0.6} />
        <circle cx="12" cy="12" r="10" {...MONO_ATTRS} strokeWidth={1.1} opacity={0.35} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#ef476f" opacity="0.14" />
      <circle cx="12" cy="12" r="6.4" fill="#ef476f" opacity="0.28" />
      <circle cx="12" cy="12" r="3" fill="#ef476f" />
    </svg>
  )
}
