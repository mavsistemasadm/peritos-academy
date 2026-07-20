// lib/rota/caminhoCurvo.ts
// Gera o "d" de um path SVG em curva suave (bezier quadrática) entre duas
// âncoras da Rota do Perito, em vez de reta — como um barbante de quadro de
// investigação, nunca uma diagonal dura cruzando o mapa. O ponto de controle
// é deslocado perpendicularmente ao segmento, alternando de lado a cada
// índice (serpenteia em vez de sempre arquear pro mesmo lado) e escalando
// com a distância: segmentos curtos quase não desviam, os longos contornam
// mais em vez de atravessar reto por cima de outros envelopes.
export function caminhoCurvo(x1: number, y1: number, x2: number, y2: number, indice: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const lado = indice % 2 === 0 ? 1 : -1;
  const arco = Math.min(dist * 0.22, 18) * lado;
  const mx = (x1 + x2) / 2 + perpX * arco;
  const my = (y1 + y2) / 2 + perpY * arco;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}
