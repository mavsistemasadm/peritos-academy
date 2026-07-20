// components/Icones.tsx
// NÍVEL 1 da identidade de ícones da plataforma — interface (navegação, ações,
// formulários, metadados). Traço 1.5px, cantos arredondados, sempre
// stroke="currentColor" e fill="none" (exceto os poucos preenchidos, marcados
// abaixo) — a cor vem do texto ao redor; estados ativos ficam dourados via CSS
// existente. Para gamificação/status (conquistas, XP, moedas, nível, ao vivo),
// use components/Emblemas.tsx (Nível 2) em vez destes.
import type { SVGProps } from 'react'

export type IconeProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 16, children, ...props }: IconeProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

// ---------- navegação ----------
export function IconeChevronDown(props: IconeProps) {
  return <Svg {...props}><path d="M6 9l6 6 6-6" /></Svg>
}
export function IconeChevronLeft(props: IconeProps) {
  return <Svg {...props}><path d="M15 18l-6-6 6-6" /></Svg>
}
export function IconeChevronRight(props: IconeProps) {
  return <Svg {...props}><path d="M9 6l6 6-6 6" /></Svg>
}
export function IconeClose(props: IconeProps) {
  return <Svg {...props}><path d="M6 6l12 12M18 6L6 18" /></Svg>
}
export function IconePlus(props: IconeProps) {
  return <Svg {...props}><path d="M12 5v14M5 12h14" /></Svg>
}
export function IconeArrowUp(props: IconeProps) {
  return <Svg {...props}><path d="M12 19V5M5 12l7-7 7 7" /></Svg>
}
export function IconeArrowDown(props: IconeProps) {
  return <Svg {...props}><path d="M12 5v14M19 12l-7 7-7-7" /></Svg>
}

// ---------- ações ----------
export function IconeSearch(props: IconeProps) {
  return <Svg {...props}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Svg>
}
export function IconeEye(props: IconeProps) {
  return <Svg {...props}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></Svg>
}
export function IconeLink(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M10.5 14.5a4 4 0 0 0 5.7 0l2-2a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M13.5 9.5a4 4 0 0 0-5.7 0l-2 2a4 4 0 0 0 5.7 5.7l1-1" />
    </Svg>
  )
}
export function IconePencil(props: IconeProps) {
  return <Svg {...props}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></Svg>
}
export function IconeCamera(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.3" />
    </Svg>
  )
}
export function IconeDownload(props: IconeProps) {
  return <Svg {...props}><path d="M12 4v11M8 11l4 4 4-4M5 19h14" /></Svg>
}
export function IconeUpload(props: IconeProps) {
  return <Svg {...props}><path d="M12 15V4M8 8l4-4 4 4M5 19h14" /></Svg>
}
export function IconeCheck(props: IconeProps) {
  return <Svg {...props}><path d="M5 13l4 4L19 7" /></Svg>
}
export function IconeSend(props: IconeProps) {
  return <Svg {...props}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
}
export function IconeSave(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M5 3h11l3 3v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M8 3v6h8V3M7 21v-8h10v8" />
    </Svg>
  )
}
export function IconeStar(props: IconeProps) {
  return <Svg {...props}><path d="M12 3l2.6 6 6.4.6-4.8 4.3 1.4 6.3L12 17l-5.6 3.2 1.4-6.3-4.8-4.3 6.4-.6z" /></Svg>
}
export function IconeTrash(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" />
    </Svg>
  )
}

// ---------- play / mídia (preenchido — pequenos triângulos leem melhor sólidos) ----------
export function IconePlay(props: IconeProps) {
  return (
    <Svg {...props} fill="currentColor" stroke="none">
      <polygon points="6 4 20 12 6 20" />
    </Svg>
  )
}

// ---------- conteúdo / metadados ----------
export function IconeUsers(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" />
      <circle cx="17.5" cy="9.5" r="2.3" />
      <path d="M17 12c2.3.4 4 2.3 4 4.8" />
    </Svg>
  )
}
export function IconeClipboard(props: IconeProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <rect x="9" y="2" width="6" height="3" rx="1" />
    </Svg>
  )
}
export function IconePaperclip(props: IconeProps) {
  return <Svg {...props}><path d="M21 11l-9 9a5 5 0 0 1-7-7l10-10a3.5 3.5 0 0 1 5 5l-9.5 9.5a1.5 1.5 0 0 1-2-2L16 8" /></Svg>
}
export function IconeBookOpen(props: IconeProps) {
  return <Svg {...props}><path d="M4 5c3 0 6 1 8 3 2-2 5-3 8-3v13c-3 0-6 1-8 3-2-2-5-3-8-3z" /><path d="M12 8v13" /></Svg>
}
export function IconeMap(props: IconeProps) {
  return <Svg {...props}><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2z" /><path d="M9 3v16M15 5v16" /></Svg>
}
export function IconeBarChart(props: IconeProps) {
  return <Svg {...props}><path d="M4 20V10M10 20V4M16 20v-7M4 20h16" /></Svg>
}
export function IconeFileText(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5z" />
      <path d="M14 3v5h5M8 13h8M8 17h8" />
    </Svg>
  )
}
export function IconeScale(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v18M6 21h12" />
      <path d="M4 7l4-2 4 2-4 10-4-10zM16 7l4-2 4 2-4 10-4-10z" />
      <path d="M4 7h8M16 7h4" />
    </Svg>
  )
}
export function IconeMapPin(props: IconeProps) {
  return <Svg {...props}><path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></Svg>
}
export function IconeMail(props: IconeProps) {
  return <Svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></Svg>
}
export function IconePhone(props: IconeProps) {
  return <Svg {...props}><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2 11 11 0 0 0 3.5.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1 11 11 0 0 0 .6 3.5 1 1 0 0 1-.2 1z" /></Svg>
}
export function IconeCalendar(props: IconeProps) {
  return <Svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>
}
export function IconeCalendarPlus(props: IconeProps) {
  return <Svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M12 13v6M9 16h6" /></Svg>
}

// ---------- suporte / estado ----------
export function IconeHeadset(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M4 14a8 8 0 0 1 16 0" />
      <path d="M4 14v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2z" />
      <path d="M20 14v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" />
    </Svg>
  )
}
export function IconeAlertTriangle(props: IconeProps) {
  return <Svg {...props}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v4M12 17h.01" /></Svg>
}
export function IconeLock(props: IconeProps) {
  return <Svg {...props}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Svg>
}
export function IconeBot(props: IconeProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="8" width="14" height="10" rx="2" />
      <path d="M12 8V5M9 5h6" />
      <circle cx="9" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <path d="M3 12h2M19 12h2" />
    </Svg>
  )
}
export function IconeClock(props: IconeProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></Svg>
}
export function IconeZap(props: IconeProps) {
  return <Svg {...props}><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></Svg>
}
export function IconeHourglass(props: IconeProps) {
  return <Svg {...props}><path d="M6 2h12M6 22h12" /><path d="M6 2c0 6 5 6 5 10s-5 4-5 10M18 2c0 6-5 6-5 10s5 4 5 10" /></Svg>
}

// ---------- notificações / menu do avatar ----------
export function IconeBell(props: IconeProps) {
  return <Svg {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Svg>
}
export function IconeUser(props: IconeProps) {
  return <Svg {...props}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></Svg>
}
export function IconeGlobe(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
    </Svg>
  )
}
export function IconeShield(props: IconeProps) {
  return <Svg {...props}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /></Svg>
}
export function IconeLogOut(props: IconeProps) {
  return <Svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></Svg>
}
export function IconeCompass(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5 13 13l-4.5 2.5L11 11z" />
    </Svg>
  )
}

// ---------- comunidade ----------
export function IconeHeart(props: IconeProps) {
  return <Svg {...props}><path d="M12 20.5s-7.5-4.6-9.9-9.3C.6 7.8 2 4.5 5.3 3.7c2-.5 3.9.3 5 2 .9-1.7 3-2.5 5-2 3.3.8 4.7 4.1 3.2 7.5-2.4 4.7-9.9 9.3-9.9 9.3z" /></Svg>
}
export function IconeThumbsUp(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3z" />
      <path d="M7 11l4-8a2 2 0 0 1 2 2v4h5.5a1.8 1.8 0 0 1 1.8 2.2l-1.4 6.5a1.8 1.8 0 0 1-1.8 1.3H10a3 3 0 0 1-3-3z" />
    </Svg>
  )
}
export function IconeMessageCircle(props: IconeProps) {
  return <Svg {...props}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-4-1L3 21l2-4.4A8.5 8.5 0 1 1 21 11.5z" /></Svg>
}
export function IconeBookmark(props: IconeProps) {
  return <Svg {...props}><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" /></Svg>
}
export function IconeSparkle(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </Svg>
  )
}
export function IconeMegaphone(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M3 11v2a2 2 0 0 0 2 2h1l2 5h2l-1.5-5H10l9 4V6l-9 4H5a2 2 0 0 0-2 1z" />
      <path d="M17 9v6" />
    </Svg>
  )
}
export function IconeVolume(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M4 10v4h4l5 4V6l-5 4H4z" />
      <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11" />
    </Svg>
  )
}
export function IconeVolumeMudo(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M4 10v4h4l5 4V6l-5 4H4z" />
      <path d="M16 9l5 6M21 9l-5 6" />
    </Svg>
  )
}
