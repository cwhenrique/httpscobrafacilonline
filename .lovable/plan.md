

# Primeiro Cadastro de PIX/Link Sem Verificação 2FA

## Problema

Atualmente, qualquer alteração nos campos `pix_key` ou `payment_link` exige verificação via WhatsApp. Isso cria um problema para **novos usuários**:

1. Usuário novo não tem WhatsApp conectado
2. Usuário tenta cadastrar sua chave PIX pela primeira vez
3. Sistema exige código de verificação via WhatsApp
4. Usuário não consegue receber o código (não conectou ainda)
5. **Bloqueio**: Não consegue cadastrar PIX sem WhatsApp, mas precisa cadastrar PIX antes de se preocupar com WhatsApp

## Solução

Exigir verificação 2FA **apenas para alterações**, não para o primeiro cadastro:

| Situação | PIX Atual | Ação | Verificação |
|----------|-----------|------|-------------|
| Primeiro cadastro | `null` ou vazio | Cadastrar | ❌ Não exige |
| Alteração | Já tem valor | Mudar | ✅ Exige código |
| Limpeza | Já tem valor | Remover | ✅ Exige código |

## Alterações Técnicas

### Arquivo: `src/pages/Profile.tsx`

**1. Modificar `handleSavePix` (linhas ~287-306)**

Lógica atual:
```typescript
const handleSavePix = async () => {
  const updates = { ... };
  const pixChanged = updates.pix_key !== (profile?.pix_key || null);
  
  if (pixChanged || typeChanged) {
    // Sempre exige verificação
    setPendingVerificationUpdates(updates);
    setVerificationDialogOpen(true);
  }
};
```

Lógica nova:
```typescript
const handleSavePix = async () => {
  const updates = { ... };
  
  // Verificar se é primeiro cadastro (não tinha PIX antes)
  const isFirstTimeSetup = !profile?.pix_key || profile.pix_key.trim() === '';
  const pixChanged = updates.pix_key !== (profile?.pix_key || null);
  
  if (pixChanged) {
    if (isFirstTimeSetup && updates.pix_key) {
      // Primeiro cadastro: salvar direto sem verificação
      setSavingPix(true);
      const { error } = await updateProfile(updates);
      if (error) {
        toast.error('Erro ao salvar chave PIX');
      } else {
        toast.success('Chave PIX cadastrada com sucesso!');
        setIsEditingPix(false);
        refetch();
      }
      setSavingPix(false);
    } else {
      // Alteração ou remoção: exige verificação
      setPendingVerificationUpdates(updates);
      setVerificationFieldName('Chave PIX');
      setVerificationDialogOpen(true);
    }
  } else {
    setIsEditingPix(false);
  }
};
```

**2. Modificar `handleSavePaymentLink` (linhas ~345-362)**

Mesma lógica:
```typescript
const handleSavePaymentLink = async () => {
  const updates = { payment_link: formData.payment_link.trim() || null };
  
  // Verificar se é primeiro cadastro
  const isFirstTimeSetup = !profile?.payment_link || profile.payment_link.trim() === '';
  const linkChanged = updates.payment_link !== (profile?.payment_link || null);
  
  if (linkChanged) {
    if (isFirstTimeSetup && updates.payment_link) {
      // Primeiro cadastro: salvar direto sem verificação
      setSavingPaymentLink(true);
      const { error } = await updateProfile(updates);
      if (error) {
        toast.error('Erro ao salvar link');
      } else {
        toast.success('Link de pagamento cadastrado!');
        setIsEditingPaymentLink(false);
        refetch();
      }
      setSavingPaymentLink(false);
    } else {
      // Alteração ou remoção: exige verificação
      setPendingVerificationUpdates(updates);
      setVerificationFieldName('Link de Pagamento');
      setVerificationDialogOpen(true);
    }
  } else {
    setIsEditingPaymentLink(false);
  }
};
```

## Arquivo Modificado

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Profile.tsx` | Ajustar `handleSavePix` e `handleSavePaymentLink` para permitir primeiro cadastro sem verificação |

## Fluxo do Usuário

### Usuário Novo
1. Acessa perfil
2. Clica em editar Chave PIX
3. Preenche a chave
4. Clica em salvar
5. **Salva direto** sem pedir código ✅

### Usuário Existente (Alteração)
1. Já tem PIX cadastrado
2. Clica em editar
3. Muda o valor
4. Clica em salvar
5. **Exige código** via WhatsApp ✅

## Segurança

A verificação 2FA continua protegendo contra:
- Alterações maliciosas de dados financeiros existentes
- Remoção de chaves PIX por atacantes
- Fraudes em contas comprometidas

O primeiro cadastro não precisa dessa proteção porque:
- Não há dado sensível sendo substituído
- É operação natural de onboarding
- Usuário pode não ter WhatsApp conectado ainda

