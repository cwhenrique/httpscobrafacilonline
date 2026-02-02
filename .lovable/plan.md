

# Plano: Inicializar Textareas com Templates Padrão

## Problema Identificado

Os textareas começam vazios porque o estado `templates` é inicializado com strings vazias:

```typescript
const [templates, setTemplates] = useState<Record<MessageType, string>>({
  overdue: '',
  dueToday: '',
  early: '',
});
```

Só depois que o `profile` carrega é que os templates são preenchidos (via `useEffect`). Isso causa um breve momento onde os campos aparecem vazios.

## Solução

Inicializar o estado `templates` diretamente com os templates padrão, para que o usuário já veja a mensagem padrão assim que abrir a tela, mesmo antes do profile carregar.

## Alteração Necessária

**Arquivo:** `src/components/BillingMessageConfigCard.tsx`

**Mudança (linhas 66-70):**

```typescript
// ANTES (campos vazios)
const [templates, setTemplates] = useState<Record<MessageType, string>>({
  overdue: '',
  dueToday: '',
  early: '',
});

// DEPOIS (já com templates padrão)
const [templates, setTemplates] = useState<Record<MessageType, string>>({
  overdue: DEFAULT_TEMPLATE_OVERDUE,
  dueToday: DEFAULT_TEMPLATE_DUE_TODAY,
  early: DEFAULT_TEMPLATE_EARLY,
});
```

O `useEffect` existente continuará funcionando normalmente - se o usuário tiver templates customizados salvos, eles serão carregados. Se não tiver, os padrões já estarão visíveis desde o início.

## Resultado Esperado

- Ao abrir Configurações > Mensagem de Cobrança, os textareas já mostram os templates padrão
- O usuário pode ver exatamente como a mensagem é estruturada
- Pode editar diretamente a partir do padrão
- Se já tiver customizações salvas, elas substituem o padrão quando o profile carrega

