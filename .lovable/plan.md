
# Atualizar Card de Relatorios no Menu Lateral

## Alteracoes

### 1. Renomear "Relatorios Auto" para "Relatorios Diario"
No arquivo `src/components/layout/DashboardLayout.tsx`, linha 200, trocar o texto de "Relatorios Auto" para "Relatorios Diario".

### 2. Mudar cor para chamar mais atencao
Trocar o esquema de cores do card de verde (emerald) para uma cor mais chamativa como amarelo/dourado (amber/yellow), que destaca melhor e chama mais atencao no menu lateral escuro.

Cores atuais (emerald/verde):
- `bg-emerald-500/20`, `text-emerald-400`, `border-emerald-500`

Novas cores (amber/dourado):
- `bg-amber-500/20`, `text-amber-400`, `border-amber-500`

## Detalhes Tecnicos

Arquivo: `src/components/layout/DashboardLayout.tsx` (linhas 189-201)

- Linha 192: `bg-emerald-500/20` -> `bg-amber-500/20`, `text-emerald-400` -> `text-amber-400`, `border-emerald-500` -> `border-amber-500`
- Linha 193: Mesma troca para estado inativo/hover
- Linha 196: `bg-emerald-500/20` -> `bg-amber-500/20`
- Linha 197: `text-emerald-400` -> `text-amber-400`
- Linha 200: "Relatorios Auto" -> "Relatorios Diario"
