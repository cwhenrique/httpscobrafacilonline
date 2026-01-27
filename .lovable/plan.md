
# Plano: Adicionar Ações de Pagamento e Cobrança na Visualização em Lista

## Visão Geral
Adicionar as funcionalidades de "Pagar Parcela", "Pagar Juros" e "Enviar Cobranças WhatsApp" na visualização em tabela (lista) da página de empréstimos, replicando as mesmas opções disponíveis na visualização em cards.

## Situação Atual

A visualização em tabela (`LoansTableView.tsx`) já possui:
- Pagar Parcela (via dropdown menu)
- Pagar Juros (via dropdown menu)
- Histórico, Editar, Renegociar, Excluir

O que **falta**:
- Opção de "Enviar Cobrança" para empréstimos em atraso
- Opção de "Cobrar Parcela de Hoje" para empréstimos vencendo hoje

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                    LoansTableView.tsx                           │
│                                                                  │
│   TableRow (cada empréstimo)                                     │
│   ├── Status Badge (Atraso / Vence Hoje / Em Dia / Pago)        │
│   └── Coluna de Ações (DropdownMenu)                            │
│       ├── Pagar Parcela (já existe)                             │
│       ├── Pagar Juros (já existe)                               │
│       ├── ─────────────────────                                 │
│       ├── 📲 Enviar Cobrança (NOVO - se em atraso)              │
│       ├── 📅 Cobrar Parcela de Hoje (NOVO - se vence hoje)      │
│       ├── ─────────────────────                                 │
│       ├── Histórico                                             │
│       ├── Editar                                                │
│       ├── Renegociar                                            │
│       └── Excluir                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Etapas de Implementação

### 1. Atualizar Interface do LoansTableView

Adicionar novas props para as funcionalidades de cobrança:

| Nova Prop | Tipo | Descrição |
|-----------|------|-----------|
| `profile` | Profile | Perfil do usuário para verificar WhatsApp |
| `onSendOverdueNotification` | `(loan: Loan) => void` | Callback para abrir notificação de atraso |
| `onSendDueTodayNotification` | `(loan: Loan) => void` | Callback para abrir notificação do dia |
| `getInstallmentData` | `(loan: Loan) => InstallmentData` | Função para calcular dados da parcela |

### 2. Adicionar Componentes de Notificação no Dropdown

No dropdown de ações de cada linha da tabela:
- Para empréstimos em **Atraso**: mostrar "📲 Enviar Cobrança"
- Para empréstimos que **Vencem Hoje**: mostrar "📅 Cobrar Parcela de Hoje"
- Botões só aparecem se WhatsApp estiver habilitado e cliente tiver telefone

### 3. Integrar SendOverdueNotification e SendDueTodayNotification

Os componentes de notificação precisam ser renderizados condicionalmente:
- Usar estado local para controlar qual loan está sendo notificado
- Passar os mesmos dados que são passados na visualização de cards

### 4. Alternativa: Usar Dialog/Portal

Como os componentes de notificação são botões com dialogs internos, uma abordagem alternativa:
- Adicionar estado no LoansTableView para controlar notificações ativas
- Renderizar os dialogs fora da tabela usando Portal
- Manter referência ao empréstimo selecionado para notificação

---

## Detalhes Técnicos

### Props Adicionais Necessárias

O componente `LoansTableView` precisará receber informações adicionais para calcular os dados da notificação:

```typescript
interface LoansTableViewProps {
  // Props existentes
  loans: Loan[];
  onPayment: (loanId: string) => void;
  onPayInterest: (loanId: string) => void;
  // ... outras props existentes
  
  // NOVAS props para notificações
  profile: Profile | null;
  getOverdueNotificationData?: (loan: Loan) => OverdueData | null;
  getDueTodayNotificationData?: (loan: Loan) => DueTodayData | null;
}
```

### Lógica de Exibição das Opções

```typescript
// No dropdown menu de cada linha:
{isOverdue && profile?.whatsapp_to_clients_enabled && loan.client?.phone && (
  <DropdownMenuItem onClick={() => openOverdueNotification(loan)}>
    <MessageCircle className="w-4 h-4 mr-2" />
    Enviar Cobrança
  </DropdownMenuItem>
)}

{isDueToday && profile?.whatsapp_to_clients_enabled && loan.client?.phone && (
  <DropdownMenuItem onClick={() => openDueTodayNotification(loan)}>
    <Bell className="w-4 h-4 mr-2" />
    Cobrar Parcela de Hoje
  </DropdownMenuItem>
)}
```

### Estados Locais para Dialogs

```typescript
const [overdueNotificationLoan, setOverdueNotificationLoan] = useState<Loan | null>(null);
const [dueTodayNotificationLoan, setDueTodayNotificationLoan] = useState<Loan | null>(null);
```

---

## Arquivos a Serem Modificados

| Arquivo | Ação |
|---------|------|
| `src/components/LoansTableView.tsx` | Adicionar opções de cobrança no dropdown + dialogs de notificação |
| `src/pages/Loans.tsx` | Passar novas props necessárias para o LoansTableView |

---

## Considerações de UX

1. **Consistência**: As mesmas opções disponíveis nos cards estarão na tabela
2. **Feedback Visual**: Ícones específicos para cada ação (MessageCircle para cobrança, Bell para lembrete)
3. **Separação Clara**: Separadores no dropdown agrupam ações similares
4. **Cooldown Preservado**: O mesmo sistema de cooldown de 1 hora será respeitado

---

## Benefícios

1. **Produtividade**: Usuários podem gerenciar empréstimos mais rapidamente na visualização em lista
2. **Experiência Unificada**: Mesmas funcionalidades disponíveis em ambas as visualizações
3. **Menos Cliques**: Ações diretas no menu dropdown sem precisar voltar para cards
