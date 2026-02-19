
# Relatórios Diários via Um Clique Digital - Nova Funcionalidade

## Resumo

Criar um sistema de relatórios diários integrado à API Um Clique Digital, com um card promocional no Dashboard que alterna com o banner de funcionários, e uma área dedicada no menu lateral para gerenciamento. O serviço custa R$ 19,90/mês via checkout Cakto.

## O que será criado

### 1. Card Promocional no Dashboard (intercalando com Funcionários)

No `src/pages/Dashboard.tsx`, adicionar um card promocional para relatórios que alterna automaticamente com o card de funcionários a cada ~5 segundos (ou ao clicar). O card terá visual similar ao de funcionários mas com cores diferentes (verde/esmeralda), destacando:
- Relatórios automáticos via WhatsApp
- Frequências: diário, semanal, quinzenal, mensal
- Cobertura: empréstimos, produtos, contratos e IPTV
- Preço: R$ 19,90/mês
- Botão "Assinar Agora" redirecionando para checkout Cakto

Para usuários que já têm `relatorio_ativo = true`, o card mostrará "Ativo" com link para gerenciar.

### 2. Nova Página de Relatórios Automáticos

Criar `src/pages/AutoReports.tsx` com:
- Status da assinatura (ativo/inativo)
- Configuração de frequência preferida (diário, semanal, quinzenal, mensal)
- Seleção de tipos de relatório (empréstimos, produtos, contratos, IPTV)
- Histórico de relatórios enviados (dados da tabela `pending_messages`)
- Para quem não assinou: CTA com botão para checkout Cakto

### 3. Item no Menu Lateral

No `DashboardLayout.tsx`, adicionar "Relatórios Auto" no menu lateral com ícone `FileCheck`, visível para owners (não funcionários). Se não tiver `relatorio_ativo`, mostrar badge "Novo".

### 4. Novos Campos no Banco de Dados

Adicionar campos na tabela `profiles` via migration:
- `auto_report_frequency` (text, default 'daily') - frequência escolhida
- `auto_report_categories` (text[], default '{loans}') - categorias selecionadas

### 5. Lógica de Alternância no Dashboard

Usar `useState` com `useEffect` + `setInterval` para alternar entre o banner de funcionários e o banner de relatórios a cada 6 segundos. Ambos cards terão botão de fechar independente (persistido em sessionStorage).

## Detalhes técnicos

### Arquivo: `src/pages/Dashboard.tsx`
- Importar `useProfile` para verificar `relatorio_ativo`
- Adicionar estado `activeBanner` alternando entre 'employee' e 'reports'
- Adicionar estado `showReportsBanner` com sessionStorage
- Novo card com gradiente verde/esmeralda
- Timer useEffect para alternar banners

### Arquivo: `src/pages/AutoReports.tsx` (novo)
- Página com DashboardLayout
- Cards de configuração de frequência e categorias
- Salvamento via `updateProfile` do hook useProfile
- CTA para não-assinantes com link Cakto

### Arquivo: `src/components/layout/DashboardLayout.tsx`
- Novo item de menu "Relatórios Auto" com ícone FileCheck
- Visível apenas para owners

### Arquivo: `src/App.tsx`
- Nova rota `/auto-reports` com ProtectedRoute

### Arquivo: `src/hooks/useProfile.ts`
- Adicionar `auto_report_frequency` e `auto_report_categories` à interface Profile

### Migration SQL
```text
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS auto_report_frequency text DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS auto_report_categories text[] DEFAULT '{loans}';
```

### Link Cakto
O botão "Assinar" redirecionará para o checkout externo da Cakto. A ativação (`relatorio_ativo = true`) já é feita automaticamente pelo webhook Cakto existente quando identifica compra de "relatorio".
