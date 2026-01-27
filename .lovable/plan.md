

# Tornar o Saldo Inicial Editável e Visível

## Problema Atual

O botão de configurar saldo inicial:
- Está escondido no canto superior direito
- O texto "Configurar" desaparece no mobile (só mostra ícone)
- Não é intuitivo que é para editar o saldo inicial
- Usuário pode não perceber que pode alterar o saldo quando adquire mais capital

## Solução Proposta

Tornar o card **"Inicial"** clicável diretamente, com indicadores visuais de que é editável:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  💰 Fluxo de Caixa                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────┐    ┌───────────────┐    ┌───────────────┐           │
│  │   🐷 INICIAL      │    │    SAÍDAS     │    │   ENTRADAS    │           │
│  │                   │    │               │    │               │           │
│  │  R$ 20.000,00     │ → │ R$ 10.000,00  │ → │ R$ 2.000,00   │           │
│  │                   │    │               │    │               │           │
│  │  ✏️ Toque para    │    │               │    │               │           │
│  │     editar        │    │               │    │               │           │
│  └───────────────────┘    └───────────────┘    └───────────────┘           │
│       ↑ Clicável!                                                           │
│         (borda azul + hover effect + ícone de edição)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Mudanças de Design

| Elemento | Antes | Depois |
|----------|-------|--------|
| Card Inicial | Estático | Clicável com hover e cursor pointer |
| Indicador visual | Nenhum | Borda tracejada + ícone de lápis |
| Botão Configurar | Header do card | Removido (ação no próprio card) |
| Feedback hover | Nenhum | Escala + brilho + tooltip |
| Estado vazio | Mensagem de texto | Card com CTA visual forte |

## Alterações Técnicas

### Arquivo: `src/components/reports/CashFlowCard.tsx`

**1. Remover botão de configurar do header (linhas 49-57):**

O header fica mais limpo, apenas com título.

**2. Tornar card "Inicial" interativo (linhas 63-71):**

```tsx
{/* Caixa Inicial - CLICÁVEL */}
<button
  onClick={() => setConfigOpen(true)}
  className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl p-3 sm:p-4 
             text-center border-2 border-dashed border-blue-500/30 
             hover:border-blue-500/50 transition-all duration-200
             cursor-pointer group hover:scale-[1.02] active:scale-[0.98]"
>
  <div className="flex items-center justify-center gap-1.5 mb-2">
    <PiggyBank className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
    <span className="text-sm sm:text-base text-muted-foreground font-medium">
      Inicial
    </span>
    {/* Ícone de edição que aparece no hover */}
    <Pencil className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 
                       transition-opacity" />
  </div>
  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-500 tracking-tight">
    {formatCurrency(initialBalance)}
  </p>
  {/* Hint sutil */}
  <p className="text-xs text-blue-500/60 mt-1 opacity-0 group-hover:opacity-100 
                transition-opacity">
    Clique para editar
  </p>
</button>
```

**3. Estado vazio mais destacado (quando saldo = 0):**

```tsx
{initialBalance === 0 ? (
  <button
    onClick={() => setConfigOpen(true)}
    className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl p-3 sm:p-4 
               text-center border-2 border-dashed border-blue-500/50 
               animate-pulse cursor-pointer"
  >
    <div className="flex items-center justify-center gap-1.5 mb-2">
      <PiggyBank className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
      <span className="text-sm sm:text-base text-blue-500 font-medium">
        Definir Saldo Inicial
      </span>
    </div>
    <p className="text-lg sm:text-xl font-bold text-blue-500">
      + Adicionar
    </p>
  </button>
) : (
  // Card normal editável
)}
```

**4. Adicionar ícone Pencil nos imports (linha 5):**

```tsx
import { ..., Pencil } from 'lucide-react';
```

**5. Remover mensagem de dica antiga (linhas 161-165):**

Não precisa mais pois o CTA visual já é óbvio.

## Resultado Visual Esperado

### Estado Normal (com saldo configurado):
- Card "Inicial" com borda tracejada azul
- Efeito de escala no hover
- Ícone de lápis aparece no hover
- Texto "Clique para editar" aparece no hover

### Estado Vazio (sem saldo configurado):
- Card pulsando suavemente (chamando atenção)
- Borda tracejada mais visível
- Texto "Definir Saldo Inicial" + "+ Adicionar"
- Impossível não notar!

## Benefícios

- **Descobribilidade**: Usuário intuitivamente entende que pode clicar
- **Feedback visual**: Hover states claros
- **CTA forte**: Estado vazio com animação chama atenção
- **Mobile-friendly**: Área de toque grande (o card inteiro)
- **Menos clutter**: Remove botão do header, mais limpo

## Arquivo Modificado

| Arquivo | Alterações |
|---------|------------|
| `src/components/reports/CashFlowCard.tsx` | Card Inicial clicável, remover botão header, adicionar estados visuais |

