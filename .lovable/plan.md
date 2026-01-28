

# Plano: Corrigir Cálculo do Saldo Inicial Automático do Fluxo de Caixa

## Problema Identificado

A fórmula atual está incorreta:
```typescript
Saldo Implícito = Total Recebido - Capital na Rua (ERRADO)
```

**Por que está errado:**
- "Capital na Rua" representa apenas o principal **ainda não pago** dos empréstimos ativos
- Não considera o dinheiro que o usuário tinha inicialmente antes de emprestar
- Se o usuário emprestou R$ 50.000, recebeu R$ 30.000 e tem R$ 40.000 na rua ainda, a fórmula dá negativo (R$ 30.000 - R$ 40.000 = -R$ 10.000)

## Lógica Correta

O saldo inicial implícito deve ser calculado com base no **Capital Total Emprestado ao longo do tempo**:

```text
Saldo Inicial Implícito = Total Principal Emprestado (todos os empréstimos) 
                        - Capital na Rua (principal pendente dos ativos)
                        - Total Recebido (já voltou para o caixa)
                        + Total Recebido (re-adicionar pois já está em caixa)
```

Simplificando:
```text
Saldo Inicial = Total Principal Emprestado - Total Principal Pendente 
              = Total Principal PAGO dos empréstimos encerrados 
              + Total Recebido dos empréstimos ativos 
              - O que foi reemprestado
```

**Fórmula mais simples e correta:**
```text
Capital de Giro Disponível = Total Recebido de Todos os Empréstimos
                           - Capital Atualmente Reemprestado (na rua)
                           + Capital Inicial do Negócio
```

Como não sabemos o capital inicial do negócio, usamos apenas:
```text
Saldo Implícito = Total Recebido (histórico) - Capital na Rua
```

**MAS** o problema está que `filteredStats.totalOnStreet` pode estar filtrado por período ou tipo!

---

## A Verdadeira Raiz do Problema

Olhando mais de perto:
- `filteredStats.totalOnStreet` usa `loansFilteredByType` que filtra por tipo de pagamento
- Mas `stats.allLoans.reduce(total_paid)` pega TODOS os empréstimos

**A inconsistência:** Estamos comparando maçãs com laranjas - recebido de TODOS vs. na rua de FILTRADOS.

## Solução

Usar `stats.totalOnStreet` (não filtrado) em vez de `filteredStats.totalOnStreet`:

```typescript
const calculatedInitialBalance = useMemo(() => {
  // Total recebido de TODOS os empréstimos (histórico completo)
  const totalReceivedAllTime = stats.allLoans.reduce((sum, loan) => 
    sum + Number(loan.total_paid || 0), 0);
  
  // Capital atualmente na rua (de TODOS os empréstimos, não filtrado)
  // Calcular o totalOnStreet de todos os empréstimos ativos
  const allActiveLoans = stats.allLoans.filter(loan => loan.status !== 'paid');
  const currentCapitalOnStreet = allActiveLoans.reduce((sum, loan) => {
    const principal = Number(loan.principal_amount);
    const payments = (loan as any).payments || [];
    const totalPrincipalPaid = payments.reduce((s: number, p: any) => 
      s + Number(p.principal_paid || 0), 0);
    return sum + (principal - totalPrincipalPaid);
  }, 0);
  
  // Saldo implícito = O que recebeu - O que está na rua (não reemprestou)
  return Math.max(0, totalReceivedAllTime - currentCapitalOnStreet);
}, [stats.allLoans]);
```

---

## Alterações Necessárias

### src/pages/ReportsLoans.tsx (linhas 693-705)

**De:**
```typescript
const calculatedInitialBalance = useMemo(() => {
  const totalReceivedAllTime = stats.allLoans.reduce((sum, loan) => 
    sum + Number(loan.total_paid || 0), 0);
  
  const currentCapitalOnStreet = filteredStats.totalOnStreet;
  
  return Math.max(0, totalReceivedAllTime - currentCapitalOnStreet);
}, [stats.allLoans, filteredStats.totalOnStreet]);
```

**Para:**
```typescript
const calculatedInitialBalance = useMemo(() => {
  // Total recebido de TODOS os empréstimos (histórico completo, sem filtro)
  const totalReceivedAllTime = stats.allLoans.reduce((sum, loan) => 
    sum + Number(loan.total_paid || 0), 0);
  
  // Capital atualmente na rua - calculado de TODOS os empréstimos ativos (sem filtro)
  const allActiveLoans = stats.allLoans.filter(loan => loan.status !== 'paid');
  const currentCapitalOnStreet = allActiveLoans.reduce((sum, loan) => {
    const principal = Number(loan.principal_amount);
    const payments = (loan as any).payments || [];
    const totalPrincipalPaid = payments.reduce((s: number, p: any) => 
      s + Number(p.principal_paid || 0), 0);
    return sum + Math.max(0, principal - totalPrincipalPaid);
  }, 0);
  
  // Saldo implícito = O que recebeu - O que ainda está emprestado
  // Representa o capital que voltou e não foi reemprestado
  return Math.max(0, totalReceivedAllTime - currentCapitalOnStreet);
}, [stats.allLoans]);
```

---

## Exemplo Prático

**Cenário:**
- Usuário começou com R$ 100.000 (capital inicial desconhecido pelo sistema)
- Emprestou R$ 100.000 ao longo do tempo
- Recebeu R$ 80.000 de volta
- Atualmente tem R$ 50.000 na rua (empréstimos ativos)

**Cálculo:**
- Total Recebido: R$ 80.000
- Capital na Rua: R$ 50.000
- Saldo Implícito: R$ 80.000 - R$ 50.000 = **R$ 30.000**

Isso representa o dinheiro que **voltou** para o caixa e **não foi reemprestado**.

**No seu caso específico:**
- Saídas: R$ 3.500 (emprestado no período)
- Entradas: R$ 1.900 (recebido no período)
- Se o saldo inicial calculado for R$ 0, significa que tudo que você recebeu historicamente foi reemprestado
- O saldo atual seria: R$ 0 - R$ 3.500 + R$ 1.900 = -R$ 1.600

Mas você disse que mostra R$ 1.600 positivo? Isso indica que o cálculo pode estar correto, mas as **Saídas e Entradas** podem estar com valores invertidos ou o período filtrado está afetando.

---

## Verificação Adicional

Também preciso verificar se `filteredStats.totalLent` e `filteredStats.totalReceived` estão sendo calculados corretamente para o período selecionado.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ReportsLoans.tsx` | Calcular `calculatedInitialBalance` usando capital na rua de TODOS os empréstimos (não filtrado), garantindo consistência entre numerador e denominador |

