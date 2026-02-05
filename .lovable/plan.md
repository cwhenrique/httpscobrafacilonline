
# Plano: Botão de Histórico Visível no Card de Assinatura

## Problema
O botão "Histórico" para ver os pagamentos de uma assinatura está escondido dentro da área expandível (Collapsible) do card. O usuário precisa clicar para expandir antes de ter acesso ao histórico.

## Solução
Adicionar um botão de "Histórico de Pagamentos" na área de ações do card que está sempre visível, permitindo acesso rápido ao histórico sem precisar expandir o card.

## Localização

O botão será adicionado na seção de ações inferior do card (linhas 2914-2971), junto aos outros botões como WhatsApp, Cobrar, etc.

## Arquivo: `src/pages/ProductSales.tsx`

### Alteração

Na seção "Actions" (linha ~2914), adicionar o botão de histórico ao lado esquerdo junto com WhatsApp e Cobrar:

```tsx
{/* Actions */}
<div className="flex items-center justify-between pt-2 border-t">
  <div className="flex items-center gap-2">
    {/* NOVO: Botão Histórico */}
    <Button 
      variant="ghost" 
      size="sm" 
      className="h-8 text-xs gap-1"
      onClick={() => setHistoryDialogFee(fee)}
    >
      <History className="w-3 h-3" />
      Histórico
    </Button>
    
    {fee.client?.phone && (
      <>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" asChild>
          <a href={...}>
            <MessageCircle className="w-3 h-3" />
            WhatsApp
          </a>
        </Button>
        <Button variant="outline" size="sm" ...>
          Cobrar
        </Button>
      </>
    )}
  </div>
  {/* ... resto do código */}
</div>
```

## Resultado

| Antes | Depois |
|-------|--------|
| Botão de histórico oculto, visível apenas ao expandir o card | Botão de histórico sempre visível no rodapé do card |

O dialog de histórico de pagamentos já existe e funciona corretamente, mostrando todos os pagamentos da assinatura organizados por data.
