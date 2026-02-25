

# Remover Assistente de Voz da página de Configurações

## Situação Atual

A seção "Assistente de Voz" está na página **Configurações** (`src/pages/Settings.tsx`), linhas 387-468. Ela aparece para usuários com planos `monthly`/`annual` ou emails privilegiados (`clau_pogian@hotmail.com`, `maicon.francoso1@gmail.com`).

## Alterações

### `src/pages/Settings.tsx`

1. **Remover o bloco JSX** do card "Assistente de Voz" (linhas 387-468)
2. **Remover estados e funções relacionados**:
   - `voiceAssistantEnabled` / `setVoiceAssistantEnabled` (state)
   - `togglingVoice` / `setTogglingVoice` (state)
   - `testingVoice` / `setTestingVoice` (state)
   - `handleToggleVoiceAssistant` (função)
   - `handleTestVoiceAssistant` (função)
   - `canAccessVoiceAssistant` (função)
   - `VOICE_PRIVILEGED_EMAILS` (constante)
   - `useEffect` que seta `voiceAssistantEnabled`
3. **Remover imports não utilizados**: `Mic`, `MicOff`, `Switch` (se não usado em outro lugar), `Badge` (verificar uso)

