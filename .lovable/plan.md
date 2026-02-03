

# Diagnóstico: Servidor WhatsApp (Evolution API) Offline

## Problema Identificado

O servidor Evolution API que gerencia as conexões WhatsApp está **fora do ar**. Os usuários não conseguem gerar QR Code porque a API retorna erro 502 (serviço inacessível).

**Evidência dos logs:**
```
Create instance response: 502
Service is not reachable
Make sure the service is running and healthy
```

## Solução Imediata (Ação do Usuário)

1. Acesse o painel **Easypanel** onde a Evolution API está hospedada
2. Localize o serviço `evolution-evolution-api`
3. Clique em **Restart** ou **Start** para reiniciar o container
4. Aguarde 1-2 minutos até o serviço ficar saudável
5. Teste novamente a geração de QR Code no sistema

**URL do Easypanel**: Acesse seu painel em `https://[seu-servidor].easypanel.host` ou pelo IP do servidor

## Melhorias de Código (Opcionais)

Para melhorar a experiência quando o servidor estiver offline novamente:

### 1. Detectar servidor offline e mostrar mensagem clara
**Arquivo:** `supabase/functions/whatsapp-create-instance/index.ts`

Alterar o tratamento de erro 502 para retornar mensagem específica:
```typescript
if (createResponse.status === 502 || createResponse.status === 503) {
  return new Response(JSON.stringify({ 
    error: 'Servidor WhatsApp temporariamente indisponível. Tente novamente em alguns minutos.',
    serverOffline: true 
  }), { ... });
}
```

### 2. Exibir alerta amigável no frontend
**Arquivo:** `src/pages/Profile.tsx`

Quando `serverOffline: true`, mostrar toast específico:
```typescript
if (data.serverOffline) {
  toast.error('Servidor WhatsApp está em manutenção. Tente novamente em 5 minutos.');
  return;
}
```

### 3. Health check antes de tentar criar instância
Adicionar verificação de disponibilidade da API antes de iniciar o fluxo de QR Code.

## Resumo

| Item | Status |
|------|--------|
| Causa raiz | Evolution API offline (erro 502) |
| Tipo de problema | Infraestrutura externa |
| Solução imediata | Reiniciar serviço no Easypanel |
| Melhoria de código | Detectar offline e mostrar mensagem clara |

**Ação necessária agora:** Reinicie o serviço `evolution-evolution-api` no Easypanel.

