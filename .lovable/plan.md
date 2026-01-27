
# Plano: Adicionar Filtro de Periodo no Relatorio de Vendas

## Visao Geral
Adicionar um filtro de periodo (intervalo de datas) na pagina de Relatorio de Vendas (`ReportsSales.tsx`), igual ao que existe na pagina de Relatorio de Emprestimos, permitindo ao usuario analisar vendas de produtos e veiculos em periodos especificos.

## Situacao Atual vs. Nova

```text
ANTES (atual):
┌──────────────────────────────────────────────────────────────────┐
│  Relatório de Vendas                     [Última atualização]   │
│  Produtos e Veículos                     [Atualizar]            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ StatCards: Total Vendido, Recebido, Lucro, Em Atraso     │   │
│  │ (mostra TODOS os dados, sem filtro de período)           │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

DEPOIS (proposto):
┌──────────────────────────────────────────────────────────────────┐
│  Relatório de Vendas                                             │
│  Produtos e Veículos                                             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 📅 Período: [01/07/2025] - [27/01/2026] [✓]   [🔄] [📥]  │   │
│  │                                                           │   │
│  │    Atualizado: 14:30                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ StatCards FILTRADOS pelo período selecionado             │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Campos de Data para Filtragem

| Tipo | Campo de Data | Descricao |
|------|---------------|-----------|
| Produtos | `sale_date` | Data da venda do produto |
| Veiculos | `purchase_date` | Data da compra do veiculo |
| Pagamentos de Produtos | `paid_date` | Data do pagamento (para "Recebido no Periodo") |
| Pagamentos de Veiculos | `paid_date` | Data do pagamento (para "Recebido no Periodo") |

## Arquitetura das Metricas

Seguindo o mesmo padrao de ReportsLoans, as metricas serao divididas em:

### Metricas de Saldo (Estado Atual - NAO filtradas por periodo)
- **Capital na Rua**: Total pendente de receber (todos os contratos ativos)
- **Em Atraso**: Valor de parcelas vencidas nao pagas

### Metricas de Fluxo (FILTRADAS pelo periodo selecionado)
- **Vendido no Periodo**: Soma do valor total de vendas criadas no periodo
- **Recebido no Periodo**: Soma dos pagamentos realizados no periodo
- **Lucro no Periodo**: Vendido - Custo das vendas no periodo

## Etapas de Implementacao

### 1. Adicionar Estados de Filtro

Adicionar estados para controlar o periodo selecionado:

```typescript
const [dateRange, setDateRange] = useState<DateRange | undefined>({
  from: subMonths(new Date(), 6),
  to: new Date(),
});
```

### 2. Importar o Componente PeriodFilter

Reutilizar o componente `PeriodFilter` ja existente em `src/components/reports/PeriodFilter.tsx`.

### 3. Criar Logica de Filtragem

Filtrar vendas e veiculos pelo periodo selecionado:

```typescript
const filteredSales = useMemo(() => {
  if (!sales || !dateRange?.from || !dateRange?.to) return sales || [];
  
  return sales.filter(sale => {
    const saleDate = parseISO(sale.sale_date);
    return isWithinInterval(saleDate, { 
      start: startOfDay(dateRange.from!), 
      end: endOfDay(dateRange.to!) 
    });
  });
}, [sales, dateRange]);

const filteredVehicles = useMemo(() => {
  if (!vehicles || !dateRange?.from || !dateRange?.to) return vehicles || [];
  
  return vehicles.filter(vehicle => {
    const purchaseDate = parseISO(vehicle.purchase_date);
    return isWithinInterval(purchaseDate, { 
      start: startOfDay(dateRange.from!), 
      end: endOfDay(dateRange.to!) 
    });
  });
}, [vehicles, dateRange]);
```

### 4. Calcular Estatisticas Filtradas

Atualizar os `useMemo` de `productStats` e `vehicleStats` para usar os dados filtrados:

- **Vendido no Periodo**: Usar `filteredSales` e `filteredVehicles`
- **Recebido no Periodo**: Filtrar pagamentos pela `paid_date` dentro do periodo
- **Metricas de Saldo**: Manter usando todos os dados (como em ReportsLoans)

### 5. Atualizar a UI

- Substituir o header atual pelo componente `PeriodFilter`
- Manter a funcionalidade de refresh existente
- Adicionar opcao de exportar (futuro)

---

## Detalhes Tecnicos

### Imports Adicionais

```typescript
import { parseISO, startOfDay, endOfDay, isWithinInterval, subMonths } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { PeriodFilter } from '@/components/reports/PeriodFilter';
```

### Estrutura dos StatCards

```text
┌─────────────────────────────────────────────────────────────────┐
│ RESUMO GERAL (filtrado pelo período)                            │
│                                                                  │
│ [Vendido no Período]  [Recebido no Período]  [Lucro]  [Atraso] │
└─────────────────────────────────────────────────────────────────┘

Aba Produtos:
┌─────────────────────────────────────────────────────────────────┐
│ [Vendido]  [Custo]  [Lucro]  [Pendente]                        │
│  (filtrado pelo período selecionado)                            │
└─────────────────────────────────────────────────────────────────┘

Aba Veículos:
┌─────────────────────────────────────────────────────────────────┐
│ [Vendido]  [Custo]  [Lucro]  [Pendente]                        │
│  (filtrado pelo período selecionado)                            │
└─────────────────────────────────────────────────────────────────┘
```

### Calculo de Pagamentos no Periodo

Para calcular "Recebido no Periodo" corretamente:

```typescript
const paymentsInPeriod = useMemo(() => {
  let totalReceived = 0;
  
  // Product payments
  productPayments?.forEach(payment => {
    if (payment.status === 'paid' && payment.paid_date) {
      const paidDate = parseISO(payment.paid_date);
      if (dateRange?.from && dateRange?.to) {
        if (isWithinInterval(paidDate, { 
          start: startOfDay(dateRange.from), 
          end: endOfDay(dateRange.to) 
        })) {
          totalReceived += Number(payment.amount);
        }
      }
    }
  });
  
  // Vehicle payments
  vehiclePayments?.forEach(payment => {
    if (payment.status === 'paid' && payment.paid_date) {
      const paidDate = parseISO(payment.paid_date);
      if (dateRange?.from && dateRange?.to) {
        if (isWithinInterval(paidDate, { 
          start: startOfDay(dateRange.from), 
          end: endOfDay(dateRange.to) 
        })) {
          totalReceived += Number(payment.amount);
        }
      }
    }
  });
  
  return totalReceived;
}, [productPayments, vehiclePayments, dateRange]);
```

---

## Arquivo a Ser Modificado

| Arquivo | Acao |
|---------|------|
| `src/pages/ReportsSales.tsx` | Adicionar filtro de periodo, estados de data, logica de filtragem e atualizar calculos |

---

## Beneficios

1. **Consistencia**: Mesma experiencia de filtragem que existe em Emprestimos
2. **Analise Temporal**: Usuario pode analisar desempenho de vendas por periodo
3. **Comparacao**: Permite comparar periodos diferentes facilmente
4. **Visibilidade**: Entender melhor o fluxo de caixa em periodos especificos
