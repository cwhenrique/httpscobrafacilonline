

# Adicionar Ancoragem de Preco nos Planos Mensal, Trimestral e Anual

## O que sera feito

Adicionar preco riscado (ancoragem) nos 3 primeiros cards de plano, igual ja existe no Vitalicio:

| Plano | Preco riscado (De) | Preco real (Por) |
|---|---|---|
| Mensal | ~~R$ 69,90~~ | R$ 55,90 |
| Trimestral | ~~R$ 209,90~~ | R$ 149,00 |
| Anual | ~~R$ 699,90~~ | R$ 479,00 |
| Vitalicio | ~~R$ 1.499,00~~ (ja existe) | R$ 999,00 |

Cada card recebera uma linha com o preco antigo riscado logo acima do preco atual, e um badge mostrando a economia em reais:

- Mensal: Economize R$ 14
- Trimestral: Economize R$ 60,90
- Anual: Economize R$ 220,90

## Detalhes Tecnicos

### Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `src/pages/Plans.tsx` | Adicionar `line-through` com preco antigo e badge de economia nos cards Mensal, Trimestral e Anual |

### Mudancas especificas por card

**Card Mensal (linha ~183):** Adicionar antes do preco atual:
```
R$ 69,90 (riscado)
R$ 55,90 (preco real)
Badge: Economize R$ 14
```

**Card Trimestral (linha ~213):** Adicionar antes do preco atual:
```
R$ 209,90 (riscado)
R$ 149,00 (preco real)
Badge: Economize R$ 60,90 (substitui o badge atual "Economia de 11%")
```

**Card Anual (linha ~255):** Adicionar antes do preco atual:
```
R$ 699,90 (riscado)
R$ 479,00 (preco real)
Badge: Economize R$ 220,90 (adiciona ao lado do badge existente "ECONOMIZE R$ 191")
```

O estilo seguira o mesmo padrao visual ja usado no card do Vitalicio: `text-lg text-muted-foreground line-through` para o preco antigo.
