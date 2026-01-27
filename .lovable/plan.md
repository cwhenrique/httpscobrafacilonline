

# Plano: Mover Botão de Cobrança para Fora do Menu de 3 Pontos

## Visao Geral
Tornar os botoes de cobranca WhatsApp ("Enviar Cobranca" e "Cobrar Parcela de Hoje") visiveis diretamente na coluna de acoes da tabela, sem precisar clicar no menu de 3 pontos.

## Situacao Atual vs. Nova

```text
ANTES (atual):
┌──────────────────────────────────────────────────────────────────┐
│ Cliente │ Status │ Restante │ Vencimento │ [...]                │
├──────────────────────────────────────────────────────────────────┤
│ Joao    │ Atraso │ R$ 500   │ 25/01      │    (menu 3 pontos)   │
│                                           │    └── Pagar Parcela │
│                                           │    └── Pagar Juros   │
│                                           │    └── Enviar Cobrança│ <-- escondido
└──────────────────────────────────────────────────────────────────┘

DEPOIS (proposto):
┌──────────────────────────────────────────────────────────────────┐
│ Cliente │ Status │ Restante │ Vencimento │ Acoes                 │
├──────────────────────────────────────────────────────────────────┤
│ Joao    │ Atraso │ R$ 500   │ 25/01      │ [Cobrar] [...]       │
│                                           │    ^         ^        │
│                                           │    botao    menu      │
│                                           │    visivel  3 pontos  │
└──────────────────────────────────────────────────────────────────┘
```

## Mudancas Propostas

### 1. Adicionar Botao de Cobranca Visivel na Coluna de Acoes

Para emprestimos em **atraso** ou que **vencem hoje**, exibir um botao compacto com icone do WhatsApp diretamente na celula de acoes, antes do menu de 3 pontos.

**Comportamento do botao:**
- Para emprestimos em **atraso**: botao vermelho "Cobrar" com icone MessageCircle
- Para emprestimos que **vencem hoje**: botao amarelo "Lembrar" com icone Bell
- Para emprestimos **diarios em atraso**: exibir ambos os botoes (cobranca + lembrete do dia)

### 2. Layout da Celula de Acoes

```text
Celula de Acoes (atraso):
┌─────────────────────────────────────┐
│  [Cobrar]  [...]                    │
│     ^        ^                      │
│   vermelho  menu dropdown           │
└─────────────────────────────────────┘

Celula de Acoes (vence hoje):
┌─────────────────────────────────────┐
│  [Lembrar]  [...]                   │
│     ^         ^                     │
│   amarelo   menu dropdown           │
└─────────────────────────────────────┘

Celula de Acoes (diario em atraso):
┌─────────────────────────────────────┐
│  [Cobrar] [Hoje] [...]              │
│     ^       ^      ^                │
│  vermelho amarelo menu              │
└─────────────────────────────────────┘
```

### 3. Versao Mobile Compacta

Em telas menores, os botoes mostrarao apenas o icone (sem texto) para economizar espaco.

---

## Detalhes Tecnicos

### Modificacao na Celula de Acoes

A celula `<TableCell className="text-right">` sera modificada para incluir:

1. **Botao de Cobranca (Atraso)**: Pequeno botao vermelho visivel para emprestimos em atraso
2. **Botao de Lembrete (Vence Hoje)**: Pequeno botao amarelo para emprestimos do dia
3. **Menu de 3 Pontos**: Mantem todas as outras opcoes (Pagar, Editar, etc.)

### Estilizacao dos Botoes

```typescript
// Botao de cobranca (atraso)
<Button 
  variant="ghost" 
  size="sm"
  className="h-7 px-2 text-red-600 hover:bg-red-500/10"
  onClick={() => setOverdueNotificationLoan(loan)}
>
  <MessageCircle className="w-4 h-4" />
  <span className="hidden sm:inline ml-1">Cobrar</span>
</Button>

// Botao de lembrete (vence hoje)  
<Button
  variant="ghost"
  size="sm"
  className="h-7 px-2 text-amber-600 hover:bg-amber-500/10"
  onClick={() => setDueTodayNotificationLoan(loan)}
>
  <Bell className="w-4 h-4" />
  <span className="hidden sm:inline ml-1">Lembrar</span>
</Button>
```

### Condicoes de Exibicao

Os botoes so aparecem quando:
- `canSendToThisClient` e true (WhatsApp habilitado + cliente tem telefone)
- O emprestimo esta em atraso (`isOverdue`) ou vence hoje (`isDueToday`)
- As funcoes de dados de notificacao estao disponiveis

---

## Arquivo a Ser Modificado

| Arquivo | Acao |
|---------|------|
| `src/components/LoansTableView.tsx` | Adicionar botoes de cobranca fora do dropdown, na celula de acoes |

---

## Beneficios

1. **Acesso Rapido**: Usuario pode enviar cobranca com 1 clique ao inves de 2
2. **Visibilidade**: Fica claro quais emprestimos precisam de acao imediata
3. **Produtividade**: Reduz tempo para gerenciar multiplos emprestimos em atraso
4. **UX Melhorada**: Acoes mais frequentes ficam mais acessiveis

