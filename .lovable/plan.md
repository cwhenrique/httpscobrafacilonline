

# Plano: Manter Cores Verde e Amarelo no Card Roxo

## Problema

Quando o card tem pagamento parcial de juros, ele fica com estilo roxo (`hasSpecialStyle = true`). Isso faz com que o texto de "Juros já pago" e "Juros pendente" fiquem brancos, perdendo a diferenciação visual verde/amarelo.

## Solução

Alterar a lógica de cores para **sempre** usar verde para "Juros já pago" e amarelo para "Juros pendente", mesmo quando o card tem estilo especial.

### Alteração no arquivo src/pages/Loans.tsx

Linhas 8024-8037 - Remover a condição `hasSpecialStyle` para manter as cores fixas:

**Antes:**
```tsx
<span className={hasSpecialStyle ? 'text-white/80' : 'text-green-300'}>
  💵 Juros já pago:
</span>
<span className={`font-bold ${hasSpecialStyle ? 'text-white' : 'text-green-400'}`}>
  {formatCurrency(paidForCurrent)}
</span>

<span className={hasSpecialStyle ? 'text-white/80' : 'text-amber-300'}>
  Juros pendente:
</span>
<span className={`font-bold ${hasSpecialStyle ? 'text-white' : 'text-amber-400'}`}>
  {formatCurrency(remainingInterest)}
</span>
```

**Depois:**
```tsx
<span className="text-green-300">
  💵 Juros já pago:
</span>
<span className="font-bold text-green-400">
  {formatCurrency(paidForCurrent)}
</span>

<span className="text-amber-300">
  Juros pendente:
</span>
<span className="font-bold text-amber-400">
  {formatCurrency(remainingInterest)}
</span>
```

## Resultado Esperado

No card roxo (com pagamento parcial de juros):

| Item | Cor |
|------|-----|
| 💵 Juros já pago: R$ 70,00 | **Verde** |
| Juros pendente: R$ 130,00 | **Amarelo** |

Independente do estilo do card, as cores serão mantidas para fácil identificação visual.

