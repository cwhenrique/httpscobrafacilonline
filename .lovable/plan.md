

# Deixar o Ícone de Lápis Sempre Visível

## Problema

O ícone de lápis (Pencil) no card "Inicial" está configurado para aparecer apenas no hover:

```tsx
<Pencil className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
```

A classe `opacity-0` esconde o ícone por padrão.

## Solução

Remover a classe `opacity-0` para que o lápis fique sempre visível:

```tsx
<Pencil className="w-4 h-4 text-blue-500" />
```

## Alteração

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/components/reports/CashFlowCard.tsx` | 83 | Remover `opacity-0 group-hover:opacity-100 transition-opacity` do Pencil |

## Código Final

```tsx
// Antes (linha 83)
<Pencil className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

// Depois
<Pencil className="w-4 h-4 text-blue-500" />
```

## Resultado

O ícone de lápis ficará sempre visível ao lado do texto "Inicial", indicando claramente que o saldo pode ser editado.

