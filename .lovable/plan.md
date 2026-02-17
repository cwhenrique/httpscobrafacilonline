
## Corrigir crash na pagina de Emprestimos (usuario badboyinternacional@gmail.com)

### Diagnostico

O ErrorBoundary que implementamos esta funcionando corretamente - ele capturou o erro e mostrou a tela "Algo deu errado" em vez de uma tela preta. Agora precisamos corrigir a **causa raiz** do erro.

**Erro exato:** `RangeError: Invalid time value` na funcao `format()` do date-fns.

**Causa raiz:** O emprestimo `3238df41` possui um **elemento vazio** (`""`) no array `installment_dates`. Quando o codigo tenta converter essa string vazia em data (`new Date("T12:00:00")`), gera uma data invalida, e a funcao `format()` do date-fns lanca o erro.

### Plano de correcao

#### 1. Corrigir os dados no banco de dados

Remover o elemento vazio do array `installment_dates` do emprestimo afetado. Tambem fazer uma varredura geral para corrigir quaisquer outros registros com o mesmo problema.

#### 2. Adicionar filtro defensivo na leitura de datas

Em `src/pages/Loans.tsx`, criar uma funcao utilitaria para sanitizar o array de datas, filtrando valores vazios ou invalidos:

```text
const safeDates = (dates: string[]) => dates.filter(d => d && d.trim().length >= 10);
```

Aplicar esse filtro nos pontos criticos onde `installment_dates` e lido do banco, especialmente na funcao `getLoanStatus` (linha ~2630) e nas funcoes de renderizacao que fazem `.map()` sobre as datas. Existem ~180 pontos onde `(loan.installment_dates as string[]) || []` e usado, mas o ponto mais seguro e criar um wrapper que ja limpa os dados.

### Detalhes tecnicos

- O erro acontece em multiplos `.map()` dentro de Loans.tsx onde `format(new Date(date + 'T12:00:00'), ...)` e chamado
- O arquivo tem 15.078 linhas e 180+ pontos que leem `installment_dates`
- A solucao mais robusta e criar uma funcao `getSafeDates(loan)` e usar nos pontos criticos de renderizacao
- A correcao no banco e imediata e resolve o problema do usuario agora
- A correcao no codigo previne que isso aconteca novamente com novos dados
