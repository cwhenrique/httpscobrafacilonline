
## Correção: Multas e Juros Não Aparecem nos Templates Customizados

### Problema Identificado

O usuario `doug_lsp@hotmail.com` tem templates customizados ativos (`useCustomTemplates: true`). Quando o sistema usa o caminho de templates customizados (linha 148-176 do `SendOverdueNotification.tsx`), ele calcula a multa assim:

```
const appliedPenalty = hasManualPenalty ? data.manualPenaltyAmount! : 0;
```

Isso **ignora completamente** as multas dinamicas (`hasDynamicPenalty`, `totalPenaltyAmount`, `penaltyAmount`). So considera multas manuais.

Na logica original (sem template customizado), o sistema trata corretamente ambos os tipos de multa (dinamica e manual). Mas no caminho do template customizado, essa logica foi esquecida.

### Correçao Planejada

**Arquivo:** `src/components/SendOverdueNotification.tsx`

Alterar as linhas 152-156 para considerar tanto multas manuais quanto dinamicas:

```typescript
// ANTES (bugado):
const hasManualPenalty = data.manualPenaltyAmount && data.manualPenaltyAmount > 0;
const appliedPenalty = hasManualPenalty ? data.manualPenaltyAmount! : 0;
const overdueInterest = data.overdueInterestAmount || 0;
const totalExtras = appliedPenalty + overdueInterest;

// DEPOIS (corrigido):
const dynamicPenalty = data.hasDynamicPenalty ? (data.totalPenaltyAmount || 0) : 0;
const manualPenalty = data.manualPenaltyAmount || 0;
const appliedPenalty = data.hasDynamicPenalty ? dynamicPenalty : manualPenalty;
const overdueInterest = data.overdueInterestAmount || 0;
const totalExtras = appliedPenalty + overdueInterest;
```

Essa logica espelha exatamente o que ja e feito na logica original (checkboxes) do mesmo componente, garantindo que:

1. Se houver multa dinamica configurada, usa `totalPenaltyAmount`
2. Se nao, usa `manualPenaltyAmount` 
3. O `{JUROS}` (juros por atraso) ja funciona corretamente via `overdueInterestAmount`
4. O `{TOTAL}` sera calculado corretamente com todos os encargos

### Impacto

- Variavel `{MULTA}` passara a exibir o valor correto da multa (dinamica ou manual)
- Variavel `{JUROS}` ja funciona (nao precisa alteraçao)
- Variavel `{JUROS_MULTA}` (consolidado) tambem funcionara quando ambos existirem
- Variavel `{TOTAL}` exibira o valor total correto com encargos
- Templates "Apenas Juros" do usuario tambem se beneficiam da correçao
