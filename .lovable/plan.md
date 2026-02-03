

# Plano: Empréstimos de Terceiros - Seção Separada

## Visao Geral

Criar uma nova seção completamente separada no sistema para gerenciar empréstimos de terceiros. Isso permite ao usuario administrar emprestimos de outras pessoas/empresas de forma isolada, sem misturar com seus proprios emprestimos pessoais.

## Estrutura Visual

```text
Menu Lateral:
+------------------------------------------+
|  Dashboard                               |
|  Clientes                                |
|  Score de Clientes                       |
|  ─────────────────────────────────────   |
|  Empréstimos                             |
|  Relatório de Empréstimos                |
|  Calendário de Cobranças                 |
|  ─────────────────────────────────────   |
|  🏢 Empréstimos de Terceiros  ← NOVO     |
|  📊 Rel. Terceiros            ← NOVO     |
|  ─────────────────────────────────────   |
|  Vendas de Produtos                      |
|  ...                                     |
+------------------------------------------+
```

## Arquitetura da Solucao

### 1. Modificacao no Banco de Dados

Adicionar coluna para identificar emprestimos de terceiros:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| is_third_party | boolean | Marca se e emprestimo de terceiro |
| third_party_name | text | Nome da pessoa/empresa dona |

```sql
ALTER TABLE loans ADD COLUMN is_third_party boolean DEFAULT false;
ALTER TABLE loans ADD COLUMN third_party_name text;
```

### 2. Novas Paginas

#### 2.1. ThirdPartyLoans.tsx
- Copia simplificada de Loans.tsx
- Filtra APENAS emprestimos onde `is_third_party = true`
- Formulario inclui campo obrigatorio para nome do terceiro
- Cards com visual diferenciado (cor teal/verde-agua)
- Funcionalidades identicas: criar, pagar, renegociar, excluir

#### 2.2. ReportsThirdParty.tsx
- Copia simplificada de ReportsLoans.tsx
- Mostra estatisticas APENAS de emprestimos de terceiros
- Relatorio PDF dedicado para terceiros
- Metricas separadas: Total emprestado, recebido, em atraso

### 3. Novos Hooks

#### 3.1. useThirdPartyLoans.ts
- Similar ao useLoans.ts
- Query filtra: `.eq('is_third_party', true)`
- Todas as operacoes (criar, pagar, etc) forcam `is_third_party: true`

#### 3.2. useThirdPartyStats.ts
- Similar ao useOperationalStats.ts
- Calcula estatisticas apenas para terceiros
- Usado no relatorio de terceiros

### 4. Modificacoes em Arquivos Existentes

#### 4.1. src/App.tsx
Adicionar 2 novas rotas:

```typescript
import ThirdPartyLoans from "./pages/ThirdPartyLoans";
import ReportsThirdParty from "./pages/ReportsThirdParty";

// Novas rotas
<Route path="/third-party-loans" element={
  <ProtectedRoute><ThirdPartyLoans /></ProtectedRoute>
} />
<Route path="/reports-third-party" element={
  <ProtectedRoute><ReportsThirdParty /></ProtectedRoute>
} />
```

#### 4.2. src/components/layout/DashboardLayout.tsx
Adicionar 2 novos itens no menu:

```typescript
import { Building2 } from 'lucide-react';

const navigation: NavigationItem[] = [
  // ... existentes ...
  { name: 'Calendário de Cobranças', href: '/calendar', ... },
  
  // NOVOS - Terceiros
  { name: 'Empréstimos de Terceiros', href: '/third-party-loans', icon: Building2, permission: 'view_loans' },
  { name: 'Rel. Terceiros', href: '/reports-third-party', icon: BarChart3, permission: 'view_reports' },
  
  // ... resto ...
  { name: 'Vendas de Produtos', href: '/product-sales', ... },
];
```

#### 4.3. src/types/database.ts
Atualizar interface Loan:

```typescript
export interface Loan {
  // ... existentes ...
  is_third_party: boolean;
  third_party_name: string | null;
}
```

#### 4.4. src/hooks/useLoans.ts (modificar)
- Adicionar filtro para EXCLUIR terceiros: `.eq('is_third_party', false)`
- Isso garante que a pagina normal de emprestimos so mostra os pessoais

## Fluxo de Funcionamento

```text
Pagina Empréstimos (/loans)
├── Lista APENAS empréstimos próprios (is_third_party = false)
├── Não mostra empréstimos de terceiros
└── Relatório (/reports) calcula apenas próprios

Página Empréstimos de Terceiros (/third-party-loans)
├── Lista APENAS empréstimos de terceiros (is_third_party = true)
├── Campo obrigatório: "Nome do terceiro"
├── Visual diferenciado (cor teal)
└── Rel. Terceiros (/reports-third-party) calcula apenas terceiros
```

## Visual Diferenciado

Os cards de emprestimos de terceiros terao:

| Estado | Cor de Fundo | Borda |
|--------|--------------|-------|
| Normal | bg-teal-500/20 | border-teal-400 |
| Vence Hoje | bg-amber-500/20 | border-amber-400 |
| Em Atraso | bg-red-500/20 | border-red-400 |

Badge no card mostrando:
```
🏢 Terceiro: [Nome do Terceiro]
```

## Arquivos a Criar

1. **src/pages/ThirdPartyLoans.tsx** - Pagina de emprestimos de terceiros
2. **src/pages/ReportsThirdParty.tsx** - Relatorio de terceiros
3. **src/hooks/useThirdPartyLoans.ts** - Hook para emprestimos de terceiros
4. **src/hooks/useThirdPartyStats.ts** - Hook para estatisticas de terceiros

## Arquivos a Modificar

1. **Migracao SQL** - Adicionar colunas is_third_party e third_party_name
2. **src/App.tsx** - Adicionar 2 novas rotas
3. **src/components/layout/DashboardLayout.tsx** - Adicionar 2 itens no menu
4. **src/types/database.ts** - Adicionar campos na interface Loan
5. **src/hooks/useLoans.ts** - Filtrar para excluir terceiros
6. **src/hooks/useOperationalStats.ts** - Filtrar para excluir terceiros

## Vantagens desta Abordagem

1. **Isolamento Total**: Dados de terceiros nunca misturam com pessoais
2. **Relatorios Separados**: Cada categoria tem seu proprio relatorio
3. **Simplicidade**: Usuario sabe exatamente onde esta cada coisa
4. **Flexibilidade**: Pode exportar PDF separadamente
5. **Escalabilidade**: Facil adicionar mais funcionalidades para terceiros no futuro

## Resultado Esperado

1. Nova opcao "Empréstimos de Terceiros" no menu lateral
2. Pagina dedicada para criar/gerenciar emprestimos de terceiros
3. Campo para informar nome do terceiro (obrigatorio)
4. Cards com visual diferenciado (cor teal)
5. Relatorio separado apenas com emprestimos de terceiros
6. Emprestimos normais NAO mostram terceiros
7. Dashboard e relatorios principais nao incluem terceiros

