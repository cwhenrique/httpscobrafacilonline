

# Plano: Remover Funcionalidade de Empréstimos de Terceiros

## Resumo

Vou remover completamente tudo relacionado a "Empréstimos de Terceiros" do sistema, incluindo páginas, hooks, rotas, itens de menu e reverter modificações feitas em arquivos existentes.

## Itens a Remover

### 1. Arquivos a Deletar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/ThirdPartyLoans.tsx` | Página wrapper de terceiros |
| `src/pages/ReportsThirdParty.tsx` | Página de relatório de terceiros |
| `src/hooks/useThirdPartyLoans.ts` | Hook de empréstimos de terceiros |
| `src/hooks/useThirdPartyStats.ts` | Hook de estatísticas de terceiros |

### 2. Modificações em App.tsx

Remover:
- Import de `ThirdPartyLoans`
- Import de `ReportsThirdParty`
- Rota `/third-party-loans`
- Rota `/reports-third-party`

### 3. Modificações em DashboardLayout.tsx

Remover do array `navigation`:
- Item "Empréstimos de Terceiros" (`/third-party-loans`)
- Item "Rel. Terceiros" (`/reports-third-party`)
- Import do ícone `Building2`

### 4. Modificações em Loans.tsx

Remover:
- Import de `useThirdPartyLoans`
- Prop `isThirdParty` e toda lógica condicional associada
- Estado `thirdPartyName`
- Referências a `is_third_party` e `third_party_name` nos forms

### 5. Modificações em useOperationalStats.ts

Remover:
- Filtro `.eq('is_third_party', false)` (voltar a buscar todos os empréstimos)

### 6. Modificações em types/database.ts

Remover da interface `Loan`:
- `is_third_party: boolean`
- `third_party_name: string | null`

### 7. Colunas no Banco de Dados

As colunas `is_third_party` e `third_party_name` na tabela `loans` podem permanecer no banco (não causam problemas) ou podem ser removidas via migração separada se desejado. Por segurança, manteremos as colunas no banco para não perder dados existentes.

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/ThirdPartyLoans.tsx` | DELETAR |
| `src/pages/ReportsThirdParty.tsx` | DELETAR |
| `src/hooks/useThirdPartyLoans.ts` | DELETAR |
| `src/hooks/useThirdPartyStats.ts` | DELETAR |
| `src/App.tsx` | Remover imports e rotas |
| `src/components/layout/DashboardLayout.tsx` | Remover itens do menu e import |
| `src/pages/Loans.tsx` | Remover prop isThirdParty e lógica associada |
| `src/hooks/useOperationalStats.ts` | Remover filtro is_third_party |
| `src/types/database.ts` | Remover campos da interface |

## Resultado Esperado

Após a remoção:
- Menu lateral volta ao estado anterior (sem itens de terceiros)
- Página de empréstimos funciona normalmente sem prop isThirdParty
- Relatório de empréstimos mostra todos os empréstimos (incluindo os que foram marcados como terceiros, se houver)
- Sistema completamente limpo da funcionalidade de terceiros

