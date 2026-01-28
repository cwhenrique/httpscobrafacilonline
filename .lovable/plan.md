

# Plano: Remover Verificação 2FA para Alteração de Chave PIX

## Problema Reportado

O sistema de verificação por código no celular (2FA via WhatsApp) para alteração de chave PIX está causando muitos problemas para os usuários.

## Solução

Remover completamente a necessidade de verificação por código ao alterar a chave PIX. A alteração será salva diretamente, assim como era antes da implementação do 2FA.

## Alterações Necessárias

### 1. src/pages/Profile.tsx - Função handleSavePix

**Código atual (linhas 642-677):**
```typescript
const handleSavePix = async () => {
  const updates = {
    pix_key: formData.pix_key.trim() || null,
    pix_key_type: formData.pix_key.trim() ? formData.pix_key_type : null,
    pix_pre_message: formData.pix_pre_message.trim() || null,
  };
  
  // Verificar se é primeiro cadastro
  const isFirstTimeSetup = !profile?.pix_key || profile.pix_key.trim() === '';
  const pixChanged = updates.pix_key !== (profile?.pix_key || null);
  const typeChanged = updates.pix_key_type !== (profile?.pix_key_type || null);
  
  if (pixChanged || typeChanged) {
    if (isFirstTimeSetup && updates.pix_key) {
      // Primeiro cadastro: salvar direto
      // ...
    } else {
      // Alteração ou remoção: exige verificação ← PROBLEMA
      setPendingVerificationUpdates(updates);
      setVerificationFieldName('Chave PIX');
      setVerificationDialogOpen(true);
    }
  }
  // ...
};
```

**Código simplificado (sem verificação):**
```typescript
const handleSavePix = async () => {
  const updates = {
    pix_key: formData.pix_key.trim() || null,
    pix_key_type: formData.pix_key.trim() ? formData.pix_key_type : null,
    pix_pre_message: formData.pix_pre_message.trim() || null,
  };
  
  const pixChanged = updates.pix_key !== (profile?.pix_key || null);
  const typeChanged = updates.pix_key_type !== (profile?.pix_key_type || null);
  const preMessageChanged = updates.pix_pre_message !== (profile?.pix_pre_message || null);
  
  if (pixChanged || typeChanged || preMessageChanged) {
    setSavingPix(true);
    const { error } = await updateProfile(updates);
    if (error) {
      toast.error('Erro ao salvar chave PIX');
    } else {
      toast.success('Chave PIX atualizada com sucesso!');
      setIsEditingPix(false);
      refetch();
    }
    setSavingPix(false);
  } else {
    // Sem mudanças, apenas fechar
    setIsEditingPix(false);
  }
};
```

### 2. Limpeza de código não utilizado (opcional)

Como o Link de Pagamento ainda usa a verificação, os seguintes elementos serão mantidos:
- `VerificationCodeDialog` component (usado pelo payment_link)
- Estados `verificationDialogOpen`, `pendingVerificationUpdates`, `verificationFieldName`
- Função `handlePixVerificationSuccess` (pode ser removida pois não será mais usada)

A função `handlePixVerificationSuccess` (linhas 679-682) pode ser removida:
```typescript
// REMOVER - não mais necessária
const handlePixVerificationSuccess = () => {
  setIsEditingPix(false);
  refetch();
};
```

## Impacto

| Item | Status |
|------|--------|
| Chave PIX | ✅ Salva diretamente (sem 2FA) |
| Link de Pagamento | Mantém 2FA |
| Primeiro cadastro | Continua funcionando igual |
| Auditoria | Mantida (via edge function update-profile-audited) |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Profile.tsx` | Simplificar `handleSavePix` para salvar direto, remover `handlePixVerificationSuccess` |

## Observações

- O sistema de auditoria (`profile_audit_log`) continua funcionando normalmente via `update-profile-audited`
- Apenas a exigência do código de verificação via WhatsApp é removida
- O Link de Pagamento continua exigindo verificação (se desejado, posso remover também)

