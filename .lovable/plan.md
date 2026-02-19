

# Botao de Teste de Relatorio na Pagina de Relatorios Automaticos

## Resumo

Adicionar um botao "Enviar Teste" na pagina de Relatorios Automaticos (`/auto-reports`) que, ao ser clicado, chama a edge function `daily-summary` passando o telefone do usuario como `testPhone`. Isso fara com que o relatorio seja gerado e enviado apenas para o usuario logado, permitindo testar a assinatura.

## Alteracoes

### Arquivo: `src/pages/AutoReports.tsx`

Dentro da secao de configuracoes (visivel apenas para assinantes ativos), adicionar um card ou botao "Enviar Relatório de Teste" logo apos o botao "Salvar Configuracoes". Ao clicar:

1. Busca o telefone do usuario no `profile.phone`
2. Chama `supabase.functions.invoke('daily-summary', { body: { testPhone: profile.phone } })`
3. Mostra toast de sucesso ou erro

O botao tera icone de `Send` e estado de loading enquanto processa.

### Detalhes tecnicos

- Importar `supabase` de `@/integrations/supabase/client`
- Importar icone `Send` do lucide-react
- Adicionar estado `sendingTest` (boolean)
- Criar funcao `handleSendTest` que:
  - Valida se `profile.phone` existe
  - Chama `supabase.functions.invoke('daily-summary', { body: { testPhone: profile.phone } })`
  - Exibe toast com resultado
- Posicionar o botao ao lado do "Salvar Configuracoes", com visual diferenciado (outline ou secondary)

