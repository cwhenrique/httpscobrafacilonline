
# Plano: Espelhar Todas as Funcionalidades de Empréstimos para Terceiros

## Status: ✅ CONCLUÍDO - Fase 1

A página de **Empréstimos de Terceiros** agora usa o mesmo componente `Loans.tsx` com a prop `isThirdParty={true}`.

## O que foi implementado:

### 1. Hook useThirdPartyLoans.ts - Expandido
- ✅ `createLoan` com todos os campos
- ✅ `registerPayment` com tracking
- ✅ `updatePaymentDate`
- ✅ `addExtraInstallments`
- ✅ `updateLoan` completo
- ✅ `deletePayment` com reversão de saldo
- ✅ `renegotiateLoan`
- ✅ `invalidateLoans`

### 2. Loans.tsx - Parametrizado
- ✅ Aceita prop `isThirdParty?: boolean`
- ✅ Usa `useThirdPartyLoans` quando `isThirdParty={true}`
- ✅ Usa `useLoans` quando `isThirdParty={false}` (padrão)
- ✅ Estado `thirdPartyName` para campo do terceiro
- ✅ Todas as chamadas `createLoan` passam `third_party_name` quando em modo terceiro

### 3. ThirdPartyLoans.tsx - Simplificado
- ✅ Agora é apenas um wrapper: `<Loans isThirdParty={true} />`

### 4. Funcionalidades Disponíveis em Ambos:
- ✅ Todas as 4 abas (Regular, Diário, Tabela Price, Histórico)
- ✅ Todos os formulários de criação
- ✅ Todos os tipos de pagamento (parcial, só juros, etc)
- ✅ Todas as ações (renegociar, editar, excluir, etc)
- ✅ Visualização em cards E tabela
- ✅ Todos os filtros
- ✅ Geração de recibos PDF
- ✅ Notificações WhatsApp

## Próximos passos (se necessário):

### Visual Diferenciado (Opcional)
Para adicionar visual teal diferenciado quando `isThirdParty={true}`:
- Usar classes condicionais baseadas em `isThirdParty`
- Adicionar Badge com `Building2` icon mostrando nome do terceiro
- Trocar cores de `primary` para `teal-500`

### Campo "Nome do Terceiro" no Formulário
- Adicionar input obrigatório quando `isThirdParty={true}`
- Mostrar Badge nos cards com nome do terceiro

## Arquivos Modificados:

1. `src/pages/Loans.tsx` - Props e hooks condicionais
2. `src/pages/ThirdPartyLoans.tsx` - Wrapper simplificado
3. `src/hooks/useThirdPartyLoans.ts` - Funções expandidas

## Resultado:

A página de Terceiros agora herda TODAS as funcionalidades de Empréstimos automaticamente, mantendo os dados isolados (is_third_party = true no banco).
