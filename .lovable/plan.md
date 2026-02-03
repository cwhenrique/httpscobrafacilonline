
# Plano: Funcionalidade "Desconto de Cheque"

## Visao Geral

Criar um modulo completo e independente para gerenciamento de desconto de cheques pre-datados, integrado ao sistema de clientes e cobrancas do CobraFacil.

## Arquitetura do Sistema

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DESCONTO DE CHEQUE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Menu Lateral: Desconto de Cheque (icone FileCheck)                         │
│  Permissao: manage_checks (nova permissao)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ Dashboard       │  │ Lista de Cheques │  │ Relatorio                │   │
│  │ - Em Carteira   │  │ - Cards/Tabela   │  │ - Totais                 │   │
│  │ - Compensados   │  │ - Filtros        │  │ - Por Cliente            │   │
│  │ - Devolvidos    │  │ - Busca          │  │ - Lucro                  │   │
│  │ - Alertas       │  │ - Acoes          │  │ - Ranking Devolucao      │   │
│  └─────────────────┘  └──────────────────┘  └──────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Integracao com:                                                      │   │
│  │ - Cadastro de Clientes (vinculacao)                                  │   │
│  │ - WhatsApp (cobrancas e lembretes)                                   │   │
│  │ - Score de Clientes (impacto em devolucoes)                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Estrutura de Arquivos a Criar

### 1. Banco de Dados (Migracao)

**Nova tabela: `check_discounts`**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Chave primaria |
| user_id | uuid | Dono do registro |
| client_id | uuid | Cliente vinculado (opcional) |
| bank_name | text | Nome do banco |
| check_number | text | Numero do cheque |
| issuer_document | text | CPF/CNPJ do emitente |
| issuer_name | text | Nome do emitente |
| nominal_value | numeric | Valor nominal do cheque |
| due_date | date | Data de vencimento |
| discount_date | date | Data do desconto |
| discount_type | text | 'percentage' ou 'proportional' |
| discount_rate | numeric | Taxa de desconto (% ao mes) |
| discount_amount | numeric | Valor do desconto (calculado) |
| net_value | numeric | Valor liquido pago |
| payment_method | text | 'cash', 'pix', 'transfer' |
| status | text | 'in_wallet', 'compensated', 'returned', 'in_collection' |
| return_date | date | Data da devolucao (se houver) |
| return_reason | text | Motivo da devolucao |
| penalty_amount | numeric | Multa aplicada |
| penalty_rate | numeric | Taxa de juros aplicada |
| notes | text | Observacoes |
| created_at | timestamptz | Data de criacao |
| updated_at | timestamptz | Data de atualizacao |

**Nova tabela: `check_discount_payments`** (para rastrear pagamentos de cheques devolvidos)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | Chave primaria |
| check_discount_id | uuid | Cheque vinculado |
| user_id | uuid | Dono do registro |
| amount | numeric | Valor pago |
| payment_date | date | Data do pagamento |
| installment_number | integer | Numero da parcela (se parcelado) |
| notes | text | Observacoes |
| created_at | timestamptz | Data de criacao |

### 2. Arquivos Frontend

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/CheckDiscounts.tsx` | Pagina principal |
| `src/hooks/useCheckDiscounts.ts` | Hook para CRUD |
| `src/types/checkDiscount.ts` | Tipos TypeScript |

### 3. Rotas e Menu

**App.tsx**: Adicionar rota `/check-discounts`

**DashboardLayout.tsx**: Adicionar item no menu lateral

### 4. Edge Functions (Lembretes)

**`supabase/functions/check-check-reminders/index.ts`**: Verifica vencimentos proximos

## Detalhamento da Interface

### Aba Principal: Lista de Cheques

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Desconto de Cheque                              [+ Novo Desconto]           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Estatisticas Rapidas:                                                       │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ │Em Carteira │ │ A Vencer   │ │Compensados │ │ Devolvidos │ │Lucro Prev. │ │
│ │  R$ 15.000 │ │     12     │ │  R$ 8.500  │ │  R$ 2.000  │ │  R$ 1.850  │ │
│ │  (8 cheq)  │ │ (7 dias)   │ │  (5 cheq)  │ │  (2 cheq)  │ │            │ │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ Filtros: [Em Carteira ▼] [Todos os Clientes ▼] [Buscar...]                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🟡 Cheque #12345 - Banco Bradesco                     Vence: 15/02/2026 │ │
│ │ Cliente: Joao Silva        Emitente: CPF 123.456.789-00                 │ │
│ │ Valor: R$ 2.500,00 → Liquido: R$ 2.375,00 (5% desc)                     │ │
│ │ [Compensar] [Devolver] [Editar] [WhatsApp]                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Formulario de Novo Desconto

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Novo Desconto de Cheque                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ DADOS DO CLIENTE                                                            │
│ ┌───────────────────────────────────────────────────────────────────────┐  │
│ │ [Selecionar Cliente ▼] ou [+ Cadastrar Novo]                          │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│ DADOS DO CHEQUE                                                             │
│ Banco: [________________]   Numero: [________________]                      │
│ CPF/CNPJ Emitente: [________________]   Nome Emitente: [________________]   │
│ Valor Nominal: R$ [________________]   Data Vencimento: [__/__/____]        │
├─────────────────────────────────────────────────────────────────────────────┤
│ CALCULO DO DESCONTO                                                         │
│ Data do Desconto: [__/__/____]        Dias ate vencimento: [45 dias]        │
│                                                                             │
│ Tipo de Desconto:                                                           │
│ ( ) Percentual Fixo: [___]% ao mes                                          │
│ (o) Proporcional por dias: [___]% ao mes                                    │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ RESUMO DO CALCULO                                                       │ │
│ │ Valor Nominal:            R$ 2.500,00                                   │ │
│ │ Dias ate vencimento:      45 dias                                       │ │
│ │ Taxa proporcional:        7,5% (5% × 45/30)                             │ │
│ │ Valor do Desconto:        R$ 187,50                                     │ │
│ │ ─────────────────────────────────────────                               │ │
│ │ VALOR LIQUIDO:            R$ 2.312,50                                   │ │
│ │ LUCRO ESPERADO:           R$ 187,50                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Forma de Pagamento: [Dinheiro ▼] [PIX] [Transferencia]                      │
│ Observacoes: [________________________________________________]             │
│                                                                             │
│                                    [Cancelar] [Cadastrar Desconto]          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fluxo de Devolucao

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Registrar Devolucao                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Cheque #12345 - Valor: R$ 2.500,00                                          │
│ Cliente: Joao Silva                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Motivo da Devolucao: [Sem Fundos ▼]                                         │
│ Data da Devolucao: [__/__/____]                                             │
│                                                                             │
│ MULTA E JUROS                                                               │
│ [x] Aplicar multa: [___]% → R$ ___,__                                       │
│ [x] Aplicar juros por atraso: [___]% ao mes                                 │
│                                                                             │
│ COBRANCA                                                                    │
│ ( ) Gerar cobranca unica: R$ 2.750,00                                       │
│ (o) Parcelar em: [3] parcelas de R$ 916,67                                  │
│                                                                             │
│ [x] Enviar notificacao WhatsApp ao cliente                                  │
│                                                                             │
│                              [Cancelar] [Registrar Devolucao]               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Aba de Relatorios

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Relatorio de Cheques                                     Periodo: [Jan/26] │
├─────────────────────────────────────────────────────────────────────────────┤
│ RESUMO FINANCEIRO                                                           │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ Total Desc.  │ │ Total Comp.  │ │ Lucro Realiz.│ │ Lucro Prev.  │         │
│ │ R$ 45.000,00 │ │ R$ 38.500,00 │ │ R$ 3.850,00  │ │ R$ 650,00    │         │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘         │
├─────────────────────────────────────────────────────────────────────────────┤
│ RANKING DE CLIENTES - MAIOR INDICE DE DEVOLUCAO                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 1. Maria Souza      - 3 devolucoes / 5 cheques (60%)     ⚠️ ALTO RISCO  │ │
│ │ 2. Carlos Pereira   - 1 devolucao / 4 cheques (25%)      ⚠️ ATENCAO     │ │
│ │ 3. Ana Costa        - 0 devolucoes / 8 cheques (0%)      ✅ CONFIAVEL   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ GRAFICO DE EVOLUCAO                                                         │
│ [Grafico de barras com compensados vs devolvidos por mes]                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Logica de Calculo do Desconto

### Percentual Fixo
```text
Valor Desconto = Valor Nominal × (Taxa ÷ 100)
Valor Liquido = Valor Nominal - Valor Desconto
```

### Proporcional por Dias
```text
Taxa Proporcional = (Taxa Mensal ÷ 30) × Dias ate Vencimento
Valor Desconto = Valor Nominal × (Taxa Proporcional ÷ 100)
Valor Liquido = Valor Nominal - Valor Desconto
```

## Integracao com Sistema Existente

### 1. Cliente (clients)
- Selector de cliente existente (ClientSelector)
- Opcao de cadastrar novo cliente inline
- Exibir historico de cheques do cliente
- Impactar score em caso de devolucao

### 2. WhatsApp
- Lembrete de vencimento proximo (configuravel)
- Notificacao de devolucao
- Cobranca de valores pendentes

### 3. Configuracoes (profiles)
- Taxa de desconto padrao
- Limite de valor para alerta
- Indice maximo de devolucao para bloqueio

## Regras de Negocio

### Alertas de Seguranca
1. **Alto risco de devolucao**: Cliente com indice > 30% (configuravel)
2. **Valor alto**: Cheque acima de R$ 5.000 (configuravel)
3. **Cliente novo**: Primeiro cheque do cliente

### Bloqueios
1. Impedir desconto para clientes com indice de devolucao > limite
2. Exigir confirmacao para valores acima do limite

## Arquivos a Criar/Modificar

### Novos Arquivos (7)
| Arquivo | Linhas Est. |
|---------|-------------|
| `src/pages/CheckDiscounts.tsx` | ~2500 |
| `src/hooks/useCheckDiscounts.ts` | ~400 |
| `src/types/checkDiscount.ts` | ~80 |
| `supabase/functions/check-check-reminders/index.ts` | ~200 |
| Migracao SQL (tabelas + RLS) | ~150 |

### Arquivos a Modificar (4)
| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Adicionar rota |
| `src/components/layout/DashboardLayout.tsx` | Adicionar menu |
| `src/hooks/useEmployeeContext.tsx` | Adicionar permissao manage_checks |
| `supabase/config.toml` | Adicionar edge function |

## Permissoes de Funcionarios

Nova permissao: `manage_checks`
- Permite acesso a pagina de Desconto de Cheque
- Permite criar, editar, compensar, devolver cheques
- Permite visualizar relatorios

## Resultado Esperado

1. Nova opcao "Desconto de Cheque" no menu lateral
2. Pagina completa com:
   - Dashboard com estatisticas
   - Lista de cheques com filtros
   - Formulario de novo desconto
   - Fluxo de devolucao com parcelamento
   - Relatorios e ranking de clientes
3. Integracoes funcionando:
   - Clientes vinculados
   - WhatsApp para cobrancas
   - Impacto no score
4. Controles de seguranca ativos
5. Edge function para lembretes automaticos
