
# Plano: Respeitar Links de Afiliados em Todo o Sistema

## Visao Geral

Garantir que todos os links de pagamento/renovacao no sistema utilizem os links do afiliado vinculado ao usuario, quando aplicavel. Atualmente, apenas o banner de expiracao e a tela de login respeitam os links de afiliados.

## Estrutura da Solucao

```text
+------------------------------------------+
|  Hook Centralizado: useAffiliateLinks    |
+------------------------------------------+
|                                          |
|  - Busca affiliate_email do profile      |
|  - Busca links do afiliado na tabela     |
|  - Retorna links (afiliado ou padrao)    |
|                                          |
+------------------------------------------+
            |
            v
+------------------------------------------+
| Componentes que usam o hook:             |
|                                          |
| - Profile.tsx (renovacao, assinar)       |
| - SubscriptionExpiringBanner.tsx         |
| - PricingSection.tsx (quando logado)     |
| - Auth.tsx (plano expirado)              |
+------------------------------------------+
```

## Locais que Precisam de Correcao

### 1. Profile.tsx - Links Hardcoded

**Linha 26-30**: Constante `RENEWAL_LINKS` hardcoded
```typescript
// ANTES (errado):
const RENEWAL_LINKS = {
  monthly: "https://pay.cakto.com.br/35qwwgz?SCK=renew",
  quarterly: "https://pay.cakto.com.br/eb6ern9?SCK=renew",
  annual: "https://pay.cakto.com.br/fhwfptb?SCK=renew",
};
```

**Linha 1587**: Botao "Assinar Agora" com link fixo
```typescript
// ANTES (errado):
onClick={() => window.open('https://pay.cakto.com.br/35qwwgz', '_blank')}
```

### 2. PricingSection.tsx - Links Padrao

Quando o usuario esta logado, o componente deve buscar os links do afiliado vinculado.

### 3. Landing.tsx - Sem Suporte a Afiliados

Usa `PricingSection` sem passar links de afiliado.

## Etapas de Implementacao

### Etapa 1: Criar Hook useAffiliateLinks

Novo arquivo `src/hooks/useAffiliateLinks.ts`:
- Reutiliza a logica existente em `SubscriptionExpiringBanner.tsx`
- Busca `affiliate_email` do perfil do usuario
- Busca links do afiliado na tabela `affiliates`
- Retorna links formatados ou links padrao

```typescript
export function useAffiliateLinks() {
  const { profile } = useProfile();
  const [links, setLinks] = useState<AffiliateLinks>(DEFAULT_LINKS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Buscar links do afiliado se existir
    fetchAffiliateLinks(profile?.affiliate_email);
  }, [profile?.affiliate_email]);

  return { links, loading };
}
```

### Etapa 2: Atualizar Profile.tsx

1. Importar e usar o novo hook `useAffiliateLinks`
2. Remover constante `RENEWAL_LINKS` hardcoded
3. Usar `links` do hook em todos os botoes de renovacao/assinatura
4. Atualizar o botao "Assinar Agora" (linha 1587) para usar link do hook

### Etapa 3: Atualizar PricingSection.tsx

Adicionar logica para buscar links de afiliado quando usuario esta logado:
- Verificar se existe usuario autenticado
- Se sim, usar `useAffiliateLinks` para buscar links
- Se nao, usar links padrao (visitante anonimo)

### Etapa 4: Refatorar SubscriptionExpiringBanner.tsx

- Substituir logica duplicada pelo novo hook `useAffiliateLinks`
- Simplificar o componente

## Detalhes Tecnicos

### Interface do Hook

```typescript
interface AffiliateLinks {
  monthly: string;
  quarterly: string;
  annual: string;
}

interface UseAffiliateLinksResult {
  links: AffiliateLinks;
  loading: boolean;
  hasAffiliate: boolean; // indica se usuario tem afiliado vinculado
}
```

### Links Padrao (sem afiliado)

| Tipo | Link Padrao |
|------|-------------|
| Mensal | https://pay.cakto.com.br/35qwwgz |
| Trimestral | https://pay.cakto.com.br/eb6ern9 |
| Anual | https://pay.cakto.com.br/fhwfptb |

### Mapeamento de Campos

| Campo Afiliado | Campo Hook |
|----------------|------------|
| link_mensal | monthly |
| link_trimestral | quarterly |
| link_anual | annual |

## Arquivos a Criar

1. `src/hooks/useAffiliateLinks.ts` - Hook centralizado

## Arquivos a Modificar

1. `src/pages/Profile.tsx`
   - Remover RENEWAL_LINKS hardcoded
   - Usar hook useAffiliateLinks
   - Atualizar todos os botoes de assinatura/renovacao

2. `src/components/PricingSection.tsx`
   - Adicionar deteccao de usuario logado
   - Usar hook para buscar links quando logado

3. `src/components/SubscriptionExpiringBanner.tsx`
   - Substituir logica duplicada pelo hook

## Fluxo de Decisao

```text
Usuario clica em "Assinar/Renovar"
           |
           v
   Usuario logado?
       /         \
      Sim        Nao
       |          |
       v          v
  Tem afiliado?  Usar links
  vinculado?     padrao
    /      \
   Sim     Nao
    |       |
    v       v
  Usar    Usar links
  links   padrao
  afiliado
```

## Resultado Esperado

1. **Usuarios com afiliado**: Todos os links de pagamento direcionam para os checkouts do afiliado vinculado
2. **Usuarios sem afiliado**: Links direcionam para checkouts padrao (sem comissao)
3. **Visitantes anonimos**: Links direcionam para checkouts padrao
4. **Consistencia**: O mesmo hook e usado em todo o sistema, evitando duplicacao de logica

## Cenarios de Teste

| Cenario | Comportamento Esperado |
|---------|----------------------|
| Usuario logado com afiliado | Links do afiliado em Profile, Banner, PricingSection |
| Usuario logado sem afiliado | Links padrao em todos os locais |
| Usuario nao logado (Landing) | Links padrao na PricingSection |
| Banner de expiracao | Links do afiliado se vinculado |
| Profile - Assinar WhatsApp | Link do afiliado se vinculado |
