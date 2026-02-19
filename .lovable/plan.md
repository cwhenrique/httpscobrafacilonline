

# Reformular Relatorio Diario - Mais Detalhado e Informativo

## Objetivo

Transformar o relatorio atual (basico) em um relatorio executivo completo com:
- Resumo geral no topo (total a receber hoje + total em atraso)
- Secao "Vence Hoje" com detalhes de parcela (ex: "Parcela 3/10")
- Secao "Em Atraso" detalhada por cliente com dias de atraso e valor individual
- Secao "Resumo da Carteira" com metricas de saude (clientes em dia, ativos, etc.)

## Formato Proposto da Mensagem

```text
📊 *RELATÓRIO COBRAFÁCIL*
📅 19/02/2026 • Quarta-feira

━━━━━━━━━━━━━━━━━━━

💰 *RESUMO DO DIA*
▸ A cobrar hoje: R$ 1.773,60 (3 parcelas)
▸ Em atraso: R$ 4.520,00 (5 parcelas)
▸ Total pendente: R$ 6.293,60

━━━━━━━━━━━━━━━━━━━

⏰ *VENCE HOJE* — R$ 1.773,60

💵 Emprestimos (2)
• João Silva — R$ 1.560,00
  ↳ Mensal • Parcela 3/10
• Maria Souza — R$ 213,60
  ↳ Semanal • Parcela 5/8

🚗 Veiculos (1)
• Pedro Santos — R$ 800,00
  ↳ Fiat Uno 2020 • Parcela 2/12

📦 Produtos (1)
• Ana Lima — R$ 350,00
  ↳ Notebook Dell • Parcela 4/6

━━━━━━━━━━━━━━━━━━━

🚨 *EM ATRASO* — R$ 4.520,00

💵 Emprestimos (3)
• Carlos Dias — R$ 2.000,00
  ↳ 15 dias de atraso • Mensal • Parcela 2/6
• Roberto Gomes — R$ 1.200,00
  ↳ 7 dias de atraso • Diario
• Fernanda Cruz — R$ 320,00
  ↳ 3 dias de atraso • Quinzenal • Parcela 1/4

🚗 Veiculos (1)
• Lucas Pereira — R$ 1.000,00
  ↳ 10 dias de atraso • Honda Civic 2019 • Parcela 5/24

━━━━━━━━━━━━━━━━━━━

📈 *SUA CARTEIRA*
▸ Clientes ativos: 18
▸ Emprestimos ativos: 25
▸ Capital na rua: R$ 45.000,00

━━━━━━━━━━━━━━━━━━━
CobraFácil • 8h
```

## Alteracoes Tecnicas

### Arquivo: `supabase/functions/daily-summary/index.ts`

1. **Adicionar interface LoanInfo ampliada** com campos extras:
   - `installmentNumber` e `totalInstallments` (numero da parcela)
   - `paymentTypeLabel` (texto legivel: Mensal, Semanal, Diario, etc.)

2. **Preencher dados de parcela** ao categorizar emprestimos:
   - Calcular numero da parcela nao paga (`firstUnpaidIndex + 1`)
   - Gerar label do tipo de pagamento

3. **Adicionar query de resumo da carteira**:
   - Contar clientes ativos distintos (dos emprestimos ja carregados)
   - Contar emprestimos ativos
   - Somar capital na rua (principal pendente)

4. **Reescrever bloco de formatacao da mensagem** (linhas 547-620):
   - Cabecalho com dia da semana
   - Bloco "Resumo do Dia" com totais consolidados
   - Secao "Vence Hoje" com detalhes de parcela e tipo
   - Secao "Em Atraso" detalhada com dias de atraso por cliente
   - Secao "Sua Carteira" com metricas de saude
   - Ordenar atrasados do mais antigo para o mais recente

5. **Helpers novos**:
   - `getWeekdayName(date)` para nome do dia da semana em portugues
   - `getPaymentTypeLabel(type)` para converter tipo em texto legivel

