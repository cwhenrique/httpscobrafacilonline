import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Eye, Save, MessageSquareText, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  BillingMessageConfig, 
  DEFAULT_BILLING_MESSAGE_CONFIG,
  BILLING_MESSAGE_FIELD_LABELS 
} from '@/types/billingMessageConfig';
import { useProfile } from '@/hooks/useProfile';

export default function BillingMessageConfigCard() {
  const { profile, updateProfile, refetch } = useProfile();
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Parse config from profile or use defaults
  const getConfig = (): BillingMessageConfig => {
    if (profile?.billing_message_config && typeof profile.billing_message_config === 'object') {
      return { ...DEFAULT_BILLING_MESSAGE_CONFIG, ...profile.billing_message_config as BillingMessageConfig };
    }
    return DEFAULT_BILLING_MESSAGE_CONFIG;
  };
  
  const [config, setConfig] = useState<BillingMessageConfig>(getConfig);
  
  // Update config when profile loads
  useState(() => {
    if (profile) {
      setConfig(getConfig());
    }
  });

  const handleToggle = (field: keyof BillingMessageConfig) => {
    if (field === 'customClosingMessage') return;
    setConfig(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleClosingMessageChange = (value: string) => {
    setConfig(prev => ({
      ...prev,
      customClosingMessage: value,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Cast to any to satisfy the updateProfile type requirements
      const { error } = await updateProfile({
        billing_message_config: config,
      } as any);
      
      if (error) throw error;
      
      await refetch();
      toast.success('Preferências de mensagem salvas!');
    } catch (error) {
      console.error('Error saving billing message config:', error);
      toast.error('Erro ao salvar preferências');
    } finally {
      setSaving(false);
    }
  };

  const generatePreviewMessage = (): string => {
    let message = '';
    
    if (config.includeClientName) {
      message += `Olá *João Silva*!\n`;
      message += `━━━━━━━━━━━━━━━━\n\n`;
    }
    
    message += `⚠️ *PARCELA EM ATRASO*\n\n`;
    
    if (config.includeAmount) {
      message += `💵 *Valor:* R$ 500,00\n`;
    }
    
    if (config.includeInstallmentNumber) {
      message += `📊 *Parcela 3/12*\n`;
    }
    
    if (config.includeDueDate) {
      message += `📅 *Vencimento:* 15/01/2025\n`;
    }
    
    if (config.includeDaysOverdue) {
      message += `⏰ *Dias em Atraso:* 5\n`;
    }
    
    if (config.includePenalty) {
      message += `⚠️ *Multa Aplicada:* +R$ 25,00\n`;
      message += `💵 *TOTAL A PAGAR:* R$ 525,00\n`;
    }
    
    if (config.includeProgressBar) {
      message += `\n📈 *Progresso:* ▓▓░░░░░░░░ 20%\n`;
    }
    
    if (config.includeInstallmentsList) {
      message += `\n📊 *STATUS DAS PARCELAS:*\n`;
      message += `1️⃣ ✅ 15/11/2024 - Paga\n`;
      message += `2️⃣ ✅ 15/12/2024 - Paga\n`;
      message += `3️⃣ ❌ 15/01/2025 - Em Atraso (5d)\n`;
      message += `4️⃣ ⏳ 15/02/2025 - Em Aberto\n`;
    }
    
    if (config.includePaymentOptions) {
      message += `\n💡 *Opções de Pagamento:*\n`;
      message += `✅ Valor total: R$ 525,00\n`;
      message += `⚠️ Só juros + multa: R$ 75,00\n`;
    }
    
    if (config.includePixKey) {
      message += `\n━━━━━━━━━━━━━━━━\n`;
      message += `💳 *Chave PIX CPF:* 123.456.789-00\n`;
    }
    
    if (config.customClosingMessage) {
      message += `\n${config.customClosingMessage}\n`;
    }
    
    if (config.includeSignature) {
      message += `\n━━━━━━━━━━━━━━━━\n`;
      message += `_Empresa Exemplo_`;
    }
    
    return message || 'Nenhum campo selecionado.';
  };

  const checkboxFields = Object.keys(BILLING_MESSAGE_FIELD_LABELS) as (keyof Omit<BillingMessageConfig, 'customClosingMessage'>)[];

  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Mensagem de Cobrança
          </CardTitle>
          <CardDescription>
            Escolha quais informações aparecem nas mensagens enviadas aos clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Field toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {checkboxFields.map((field) => {
              const fieldInfo = BILLING_MESSAGE_FIELD_LABELS[field];
              return (
                <div 
                  key={field} 
                  className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleToggle(field)}
                >
                  <Checkbox
                    id={field}
                    checked={config[field] as boolean}
                    onCheckedChange={() => handleToggle(field)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <Label 
                      htmlFor={field} 
                      className="text-sm font-medium cursor-pointer"
                    >
                      {fieldInfo.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fieldInfo.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom closing message */}
          <div className="space-y-2">
            <Label htmlFor="customClosingMessage" className="flex items-center gap-2">
              <MessageSquareText className="w-4 h-4" />
              Mensagem de Fechamento (opcional)
            </Label>
            <Textarea
              id="customClosingMessage"
              placeholder="Ex: Qualquer dúvida, estou à disposição! 😊"
              value={config.customClosingMessage}
              onChange={(e) => handleClosingMessageChange(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              Esta mensagem aparecerá no final de todas as cobranças
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              className="flex-1 min-w-[140px]"
            >
              <Eye className="w-4 h-4 mr-2" />
              Visualizar Exemplo
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 min-w-[140px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Preferências
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exemplo de Mensagem</DialogTitle>
          </DialogHeader>
          <div className="bg-[#0b141a] rounded-lg p-4 text-white font-sans text-sm whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
            {generatePreviewMessage()}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Esta é uma prévia. Os dados reais serão usados ao enviar.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
