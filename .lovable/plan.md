

# Corrigir Lista de Parcelas em Todas as Mensagens de Cobranca

## Problema Identificado

Alguns usuarios tem templates customizados salvos (`useCustomTemplates: true`) que foram criados **antes** da variavel `{PARCELAS_STATUS}` existir. Como seus templates nao incluem essa variavel, a lista de parcelas nunca aparece na mensagem, mesmo com `includeInstallmentsList: true`.

Exemplo encontrado no banco: um usuario tem `customTemplateDueToday` que inclui `{PROGRESSO}` mas nao `{PARCELAS_STATUS}`.

Alem disso, a mensagem "Evite juros e multas pagando em dia!" aparece duplicada porque esta hardcoded no template E tambem pode vir do `{FECHAMENTO}`.

## Solucao

### Arquivo 1: `src/lib/messageUtils.ts`

Na funcao `replaceTemplateVariables`, **apos** fazer todas as substituicoes, verificar se o template resultante NAO contem a lista de parcelas E se ha dados de parcelas disponiveis. Se sim, inserir a lista automaticamente apos o `{PROGRESSO}` ou antes do `{PIX}`.

Logica:
- Se `installmentDates` tem dados E o template original nao continha `{PARCELAS_STATUS}`: anexar a lista de parcelas automaticamente apos a barra de progresso (ou antes da secao PIX se nao houver progresso)
- Isso garante retrocompatibilidade com templates antigos

### Arquivo 2: `src/components/SendDueTodayNotification.tsx`

Na funcao `generateDueTodayMessage` (mensagem completa, modo checkbox):
- Remover a duplicacao da mensagem "Evite juros e multas pagando em dia!" - ela ja esta hardcoded na linha 194, mas tambem pode vir do `customClosingMessage`

Na funcao `generateSimpleDueTodayMessage` (mensagem simples):
- Adicionar a lista de parcelas (`generateInstallmentStatusList`) quando `installmentDates.length <= 20`, mesmo no modo simples, pois o usuario quer ver as parcelas em todas as mensagens

### Arquivo 3: `src/components/SendOverdueNotification.tsx`

Na funcao `generateSimpleOverdueMessage`:
- Adicionar a lista de parcelas (`generateInstallmentStatusList`) quando `installmentDates.length <= 20`

### Arquivo 4: `src/components/SendEarlyNotification.tsx`

Na funcao `generateSimpleEarlyMessage`:
- Adicionar a lista de parcelas (`generateInstallmentStatusList`) quando `installmentDates.length <= 20`

## Detalhes Tecnicos

### messageUtils.ts - replaceTemplateVariables
Apos a linha `return template` com todas as substituicoes, adicionar logica:

```text
// Se o template original nao tinha {PARCELAS_STATUS} mas temos dados de parcelas,
// inserir automaticamente apos o progresso
const templateHadParcelas = template.includes('{PARCELAS_STATUS}');
let result = template.replace(...)...;

if (!templateHadParcelas && parcelasStatus) {
  // Inserir apos a barra de progresso ou antes do PIX
  const progressIndex = result.lastIndexOf('Progresso:');
  if (progressIndex !== -1) {
    const nextNewline = result.indexOf('\n', progressIndex);
    result = result.slice(0, nextNewline + 1) + '\n' + parcelasStatus + result.slice(nextNewline + 1);
  } else {
    // Inserir antes da secao PIX
    const pixIndex = result.indexOf('━━━━━━━━━━━━━━━━\n\n💳');
    if (pixIndex !== -1) {
      result = result.slice(0, pixIndex) + parcelasStatus + '\n' + result.slice(pixIndex);
    }
  }
}
```

### Mensagens Simples (3 componentes)
Em cada `generateSimple*Message`, adicionar apos a barra de progresso:

```text
if (data.installmentDates && data.installmentDates.length > 0 && data.installmentDates.length <= 20) {
  message += '\n';
  message += generateInstallmentStatusList({
    installmentDates: data.installmentDates,
    paidCount: paidCount,
    paidIndices: data.paidIndices,
  });
}
```

### Correcao da duplicacao "Evite juros..."
Em `SendDueTodayNotification.tsx`, ajustar para nao duplicar a mensagem de fechamento quando `customClosingMessage` esta vazio (linhas 194-198).

## Resumo
- 4 arquivos modificados
- Retrocompatibilidade com templates antigos (insercao automatica de parcelas)
- Mensagens simples agora tambem incluem lista de parcelas
- Correcao de mensagem duplicada
- Sem alteracoes de banco de dados
