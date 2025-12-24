import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { User, Building, Loader2, Phone, CheckCircle, AlertCircle, MessageCircle, Wifi, WifiOff, QrCode, RefreshCw, Unplug, Mic, MicOff, Timer, Smartphone, Link, Camera, Hash } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface WhatsAppStatus {
  connected: boolean;
  status: string;
  instanceName?: string;
  phoneNumber?: string;
  connectedAt?: string;
  needsNewQR?: boolean;
  waitingForScan?: boolean;
  message?: string;
}

// Emails com acesso privilegiado ao assistente de voz (independente do plano)
const VOICE_PRIVILEGED_EMAILS = [
  'clau_pogian@hotmail.com',
  'maicon.francoso1@gmail.com',
];

export default function Settings() {
  const { user } = useAuth();
  const { profile, isProfileComplete, updateProfile } = useProfile();

  // Check if user can access voice assistant (only recurring plans or privileged emails)
  const canAccessVoiceAssistant = (): boolean => {
    const email = profile?.email?.toLowerCase() || '';
    
    // Privileged emails always have access
    if (VOICE_PRIVILEGED_EMAILS.includes(email)) return true;
    
    // Only monthly and annual plans have access
    const plan = profile?.subscription_plan;
    return plan === 'monthly' || plan === 'annual';
  };
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    company_name: '',
  });
  const [errors, setErrors] = useState<{ full_name?: string; phone?: string }>({});
  
  // WhatsApp QR Code states
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [sendToClientsEnabled, setSendToClientsEnabled] = useState(false);
  const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useState(false);
  const [togglingVoice, setTogglingVoice] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [qrTimeRemaining, setQrTimeRemaining] = useState(90);
  const [qrExpired, setQrExpired] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [resettingInstance, setResettingInstance] = useState(false);
  
  // Pairing code states (for mobile connection)
  const [showPairingCodeOption, setShowPairingCodeOption] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [generatingPairingCode, setGeneratingPairingCode] = useState(false);
  const [pairingPhoneNumber, setPairingPhoneNumber] = useState('');

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || user?.email || '',
        phone: formatPhone(profile.phone || ''),
        company_name: profile.company_name || '',
      });
      setSendToClientsEnabled(profile.whatsapp_to_clients_enabled || false);
      setVoiceAssistantEnabled(profile.voice_assistant_enabled || false);
    }
  }, [profile, user]);

  // Check WhatsApp status on mount
  useEffect(() => {
    if (user?.id) {
      checkWhatsAppStatus();
    }
  }, [user?.id]);

  // Poll for connection status when QR modal is open
  useEffect(() => {
    if (!showQrModal || !qrCode) return;
    
    const interval = setInterval(() => {
      checkWhatsAppStatus().then(status => {
        if (status?.connected) {
          setShowQrModal(false);
          setQrCode(null);
          // Auto-enable send to clients when connected
          setSendToClientsEnabled(true);
          toast.success('WhatsApp conectado com sucesso!');
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [showQrModal, qrCode]);

  // QR Code expiration timer - 90 seconds (more time for users to scan)
  useEffect(() => {
    if (!qrCode || generatingQr) return;
    
    setQrTimeRemaining(90);
    setQrExpired(false);
    
    const timer = setInterval(() => {
      setQrTimeRemaining(prev => {
        if (prev <= 1) {
          setQrExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [qrCode, generatingQr]);

  const checkWhatsAppStatus = useCallback(async (attemptReconnect = false): Promise<WhatsAppStatus | null> => {
    if (!user?.id) return null;
    
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-check-status', {
        body: { userId: user.id, attemptReconnect }
      });

      if (error) {
        console.error('Error checking WhatsApp status:', error);
        return null;
      }

      setWhatsappStatus(data);
      
      // Notify user if connection was restored
      if (attemptReconnect && data?.reconnected) {
        toast.success('Conexão restaurada automaticamente!');
      }
      
      return data;
    } catch (error) {
      console.error('Error checking status:', error);
      return null;
    } finally {
      setCheckingStatus(false);
    }
  }, [user?.id]);

  const handleReconnectWhatsApp = async () => {
    if (!user?.id) return;
    
    setReconnecting(true);
    toast.info('Tentando reconectar...');
    
    try {
      const status = await checkWhatsAppStatus(true);
      
      if (status?.connected) {
        toast.success('WhatsApp reconectado com sucesso!');
      } else {
        // If reconnect failed, offer to scan QR code again
        toast.error('Não foi possível reconectar automaticamente. Tente escanear o QR Code novamente.');
      }
    } catch (error) {
      console.error('Error reconnecting:', error);
      toast.error('Erro ao tentar reconectar');
    } finally {
      setReconnecting(false);
    }
  };

  const handleConnectWhatsApp = async () => {
    if (!user?.id) return;
    
    setGeneratingQr(true);
    setShowQrModal(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-create-instance', {
        body: { userId: user.id }
      });

      if (error) {
        toast.error('Erro ao gerar QR Code');
        setShowQrModal(false);
        return;
      }

      if (data.alreadyConnected) {
        toast.success('WhatsApp já está conectado!');
        setShowQrModal(false);
        await checkWhatsAppStatus();
        return;
      }

      if (data.qrCode) {
        setQrCode(data.qrCode);
      } else {
        toast.error('Não foi possível gerar o QR Code');
        setShowQrModal(false);
      }
    } catch (error) {
      console.error('Error connecting WhatsApp:', error);
      toast.error('Erro ao conectar WhatsApp');
      setShowQrModal(false);
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleRefreshQrCode = async (forceReset = false) => {
    if (!user?.id) return;
    
    setGeneratingQr(true);
    setQrExpired(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-get-qrcode', {
        body: { userId: user.id, forceReset }
      });

      if (error) {
        toast.error('Erro ao atualizar QR Code');
        return;
      }

      if (data.alreadyConnected) {
        toast.success('WhatsApp já está conectado!');
        setShowQrModal(false);
        await checkWhatsAppStatus();
        return;
      }

      if (data.qrCode) {
        setQrCode(data.qrCode);
        setQrTimeRemaining(90);
      } else {
        toast.error(data.error || 'Não foi possível gerar o QR Code');
      }
    } catch (error) {
      console.error('Error refreshing QR:', error);
      toast.error('Erro ao atualizar QR Code');
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleResetInstance = async () => {
    if (!user?.id) return;
    
    setResettingInstance(true);
    toast.info('Reiniciando instância...');
    
    try {
      // Force a reset by doing logout + new QR
      await handleRefreshQrCode(true);
      toast.success('Instância reiniciada! Escaneie o novo QR Code.');
    } catch (error) {
      console.error('Error resetting instance:', error);
      toast.error('Erro ao reiniciar instância');
    } finally {
      setResettingInstance(false);
    }
  };

  // Handle pairing code request (for mobile users)
  const handleRequestPairingCode = async () => {
    if (!user?.id) return;
    
    // Validate phone number
    const cleanPhone = pairingPhoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Digite o número completo com DDD (ex: 5511999999999)');
      return;
    }

    setGeneratingPairingCode(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-get-pairing-code', {
        body: { userId: user.id, phoneNumber: cleanPhone }
      });

      if (error) {
        console.error('Error getting pairing code:', error);
        toast.error('Erro ao gerar código de pareamento');
        return;
      }

      if (data.alreadyConnected) {
        toast.success('WhatsApp já está conectado!');
        setShowQrModal(false);
        setShowPairingCodeOption(false);
        setPairingCode(null);
        await checkWhatsAppStatus();
        return;
      }

      if (data.pairingCode) {
        setPairingCode(data.pairingCode);
        toast.success('Código gerado! Digite no WhatsApp.');
      } else {
        toast.error(data.error || 'Não foi possível gerar o código');
      }
    } catch (error) {
      console.error('Error requesting pairing code:', error);
      toast.error('Erro ao gerar código de pareamento');
    } finally {
      setGeneratingPairingCode(false);
    }
  };

  // Reset pairing code state when modal closes
  const handleCloseQrModal = (open: boolean) => {
    setShowQrModal(open);
    if (!open) {
      setShowPairingCodeOption(false);
      setPairingCode(null);
      setPairingPhoneNumber('');
    }
  };

  const handleDisconnectWhatsApp = async () => {
    if (!user?.id) return;
    
    setDisconnecting(true);
    
    try {
      const { error } = await supabase.functions.invoke('whatsapp-disconnect', {
        body: { userId: user.id }
      });

      if (error) {
        toast.error('Erro ao desconectar WhatsApp');
        return;
      }

      toast.success('WhatsApp desconectado');
      setWhatsappStatus(null);
      setSendToClientsEnabled(false);
      await checkWhatsAppStatus();
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleSendToClients = async (enabled: boolean) => {
    setSendToClientsEnabled(enabled);
    
    const { error } = await updateProfile({
      whatsapp_to_clients_enabled: enabled,
    });

    if (error) {
      toast.error('Erro ao salvar configuração');
      setSendToClientsEnabled(!enabled);
    }
  };

  const handleToggleVoiceAssistant = async (enabled: boolean) => {
    if (!user?.id) return;

    setTogglingVoice(true);
    setVoiceAssistantEnabled(enabled);

    try {
      // Ensure phone is saved (voice assistant identifies the user by their WhatsApp number)
      const currentDigits = (profile?.phone || '').replace(/\D/g, '');
      const formDigits = (formData.phone || '').replace(/\D/g, '');
      const phoneToSave = currentDigits || formDigits;

      if (enabled) {
        if (!phoneToSave || phoneToSave.length < 10) {
          toast.error('Informe seu WhatsApp e salve o perfil para usar o assistente de voz');
          setVoiceAssistantEnabled(false);
          return;
        }

        // Save preference in profile - no webhook configuration needed anymore
        // The central CobraFácil number already has the webhook configured
        const { error: profileError } = await updateProfile({
          voice_assistant_enabled: true,
          ...(currentDigits ? {} : { phone: phoneToSave }),
        });

        if (profileError) {
          toast.error('Erro ao salvar configuração');
          setVoiceAssistantEnabled(false);
        } else {
          toast.success('Assistente de voz ativado!');
        }
      } else {
        const { error: profileError } = await updateProfile({
          voice_assistant_enabled: false,
        });

        if (profileError) {
          toast.error('Erro ao salvar configuração');
          setVoiceAssistantEnabled(true);
        } else {
          toast.success('Assistente de voz desativado');
        }
      }
    } catch (error) {
      console.error('Error toggling voice assistant:', error);
      toast.error('Erro ao configurar assistente de voz');
      setVoiceAssistantEnabled(!enabled);
    } finally {
      setTogglingVoice(false);
    }
  };

  const handleTestVoiceAssistant = async () => {
    if (!profile?.phone) {
      toast.error('Configure seu número de WhatsApp primeiro');
      return;
    }

    setTestingVoice(true);
    try {
      const phoneDigits = profile.phone.replace(/\D/g, '');
      const formattedPhone = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;

      const message = `🎤 *Assistente de Voz CobraFácil Ativado!*

Olá ${profile.full_name || 'usuário'}! Seu assistente de voz está funcionando.

📱 *Como usar:*
Envie um áudio para este mesmo número com sua pergunta.

🎤 *Comandos disponíveis:*
• "Quanto o [nome] me deve?"
• "Qual o contrato do [nome]?"
• "O que vence hoje/amanhã/esta semana?"
• "Quem está atrasado?"
• "Me dá um resumo"

A resposta virá em texto neste mesmo chat. Experimente agora! 🚀`;

      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: { 
          phone: formattedPhone, 
          message 
        }
      });

      if (error) throw error;
      toast.success('Mensagem de teste enviada para seu WhatsApp!');
    } catch (error) {
      console.error('Error testing voice assistant:', error);
      toast.error('Erro ao enviar mensagem de teste');
    } finally {
      setTestingVoice(false);
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const formatPhoneDisplay = (phone: string) => {
    if (!phone) return '';
    const numbers = phone.replace(/\D/g, '');
    // Remove country code for display if present
    const localNumber = numbers.startsWith('55') ? numbers.slice(2) : numbers;
    if (localNumber.length === 11) {
      return `(${localNumber.slice(0, 2)}) ${localNumber.slice(2, 7)}-${localNumber.slice(7)}`;
    }
    return phone;
  };

  const getConnectedDays = (connectedAt: string | undefined) => {
    if (!connectedAt) return null;
    const connected = new Date(connectedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - connected.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const validateForm = () => {
    const newErrors: { full_name?: string; phone?: string } = {};
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Nome é obrigatório';
    }
    
    const phoneNumbers = formData.phone.replace(/\D/g, '');
    if (!phoneNumbers) {
      newErrors.phone = 'Telefone é obrigatório para receber notificações';
    } else if (phoneNumbers.length < 10 || phoneNumbers.length > 11) {
      newErrors.phone = 'Telefone inválido (10 ou 11 dígitos)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Corrija os campos obrigatórios');
      return;
    }

    setLoading(true);

    const { error } = await updateProfile({
      full_name: formData.full_name.trim(),
      phone: formData.phone.replace(/\D/g, ''),
      company_name: formData.company_name.trim() || null,
    });

    if (error) {
      toast.error('Erro ao salvar perfil');
    } else {
      toast.success('Perfil atualizado com sucesso!');
    }
    setLoading(false);
  };

  const isConnected = whatsappStatus?.connected === true;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Configurações</h1>
            <p className="text-muted-foreground">Gerencie seu perfil e preferências</p>
          </div>
          {isProfileComplete ? (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              Perfil Completo
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
              <AlertCircle className="w-3 h-3 mr-1" />
              Perfil Incompleto
            </Badge>
          )}
        </div>

        {!isProfileComplete && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">Complete seu perfil</p>
                  <p className="text-sm text-muted-foreground">
                    Preencha os campos obrigatórios abaixo para receber notificações que irão te auxiliar na gestão com seus clientes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <Card className="shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Perfil</CardTitle>
                  <CardDescription>Informações pessoais da sua conta</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Nome Completo <span className="text-destructive">*</span>
                </Label>
                <Input 
                  value={formData.full_name} 
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Seu nome completo"
                  className={errors.full_name ? 'border-destructive' : ''}
                />
                {errors.full_name && (
                  <p className="text-sm text-destructive">{errors.full_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={formData.email} disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  WhatsApp <span className="text-destructive">*</span>
                </Label>
                <Input 
                  value={formData.phone} 
                  onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                  className={errors.phone ? 'border-destructive' : ''}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Você receberá notificações para te auxiliar na gestão com seus clientes
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Building className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Empresa</CardTitle>
                  <CardDescription>Informações da sua empresa (opcional)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input 
                  value={formData.company_name} 
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Minha Empresa Ltda"
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </form>

        {/* WhatsApp para Clientes - New Simplified UI */}
        <Card className="shadow-soft border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <MessageCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <CardTitle>WhatsApp para Clientes</CardTitle>
                  <CardDescription>
                    Envie mensagens diretamente aos seus clientes pelo seu WhatsApp
                  </CardDescription>
                </div>
              </div>
              {checkingStatus ? (
                <Badge variant="outline" className="bg-muted">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Verificando...
                </Badge>
              ) : isConnected ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                  <Wifi className="w-3 h-3 mr-1" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Não Conectado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <>
                {/* Connected State */}
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium text-green-600">WhatsApp Conectado</p>
                      {whatsappStatus?.phoneNumber && (
                        <p className="text-sm text-muted-foreground">
                          Número: {formatPhoneDisplay(whatsappStatus.phoneNumber)}
                        </p>
                      )}
                    </div>
                  </div>
                  {whatsappStatus?.connectedAt && (
                    <p className="text-xs text-muted-foreground">
                      Conectado há {getConnectedDays(whatsappStatus.connectedAt)} dias
                    </p>
                  )}
                  <div className="mt-2 p-2 rounded bg-green-500/5 border border-green-500/10">
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Wifi className="w-3 h-3" />
                      Conexão persistente ativa - permanece conectado mesmo com navegador fechado
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">Enviar para clientes</p>
                    <p className="text-xs text-muted-foreground">Permite enviar cobranças e comprovantes</p>
                  </div>
                  <Switch
                    checked={sendToClientsEnabled}
                    onCheckedChange={handleToggleSendToClients}
                  />
                </div>

                <Button 
                  variant="outline" 
                  onClick={handleDisconnectWhatsApp}
                  disabled={disconnecting}
                  className="w-full text-destructive hover:text-destructive"
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Desconectando...
                    </>
                  ) : (
                    <>
                      <Unplug className="w-4 h-4 mr-2" />
                      Desconectar WhatsApp
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                {/* Disconnected State */}
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <QrCode className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="font-medium mb-1">Conecte seu WhatsApp</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Escaneie um QR Code para conectar seu WhatsApp e enviar mensagens diretamente aos seus clientes.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button onClick={handleConnectWhatsApp} className="bg-green-600 hover:bg-green-700">
                      <QrCode className="w-4 h-4 mr-2" />
                      Conectar WhatsApp
                    </Button>
                    {whatsappStatus?.status === 'close' || whatsappStatus?.status === 'disconnected' ? (
                      <Button 
                        variant="outline" 
                        onClick={handleReconnectWhatsApp}
                        disabled={reconnecting}
                      >
                        {reconnecting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Reconectando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Tentar Reconectar
                          </>
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {/* Status: connecting (waiting for QR scan) */}
                {whatsappStatus?.status === 'connecting' && (
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="flex items-start gap-2">
                      <Loader2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0 animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-blue-600">Aguardando leitura do QR Code...</p>
                        <p className="text-xs text-muted-foreground">
                          Escaneie o QR Code no WhatsApp do seu celular para conectar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status: close (connection lost) */}
                {whatsappStatus?.status === 'close' && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-600">Conexão perdida</p>
                        <p className="text-xs text-muted-foreground">
                          Sua conexão anterior foi desconectada. Tente reconectar ou escaneie o QR Code novamente.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Button to reset instance if having problems */}
                {(whatsappStatus?.needsNewQR || whatsappStatus?.status === 'connecting') && (
                  <div className="flex justify-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleResetInstance}
                      disabled={resettingInstance}
                      className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                    >
                      {resettingInstance ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Reiniciando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Reiniciar e Gerar Novo QR
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  Com o WhatsApp conectado, você poderá enviar notificações de cobrança e comprovantes diretamente para os telefones dos seus clientes.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Voice Assistant - Only for recurring plans or privileged emails */}
        {canAccessVoiceAssistant() && (
        <Card className="shadow-soft border-purple-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Mic className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle>Assistente de Voz</CardTitle>
                  <CardDescription>
                    Faça consultas por áudio no WhatsApp do CobraFácil
                  </CardDescription>
                </div>
              </div>
              {voiceAssistantEnabled ? (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                  <Mic className="w-3 h-3 mr-1" />
                  Ativo
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  <MicOff className="w-3 h-3 mr-1" />
                  Inativo
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium text-sm">Ativar Assistente de Voz</p>
                <p className="text-xs text-muted-foreground">Responde a comandos de voz no WhatsApp</p>
              </div>
              <Switch
                checked={voiceAssistantEnabled}
                onCheckedChange={handleToggleVoiceAssistant}
                disabled={togglingVoice}
              />
            </div>

            {voiceAssistantEnabled && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                  <p className="font-medium text-sm mb-2">📱 Como usar:</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Envie um áudio para o <strong>mesmo número do CobraFácil</strong> que você recebe as notificações diárias. A resposta virá em texto no mesmo chat.
                  </p>
                  <p className="font-medium text-sm mb-2">🎤 Comandos disponíveis:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• "Quanto o João me deve?"</li>
                    <li>• "Qual o contrato do Pedro?"</li>
                    <li>• "O que vence hoje/amanhã?"</li>
                    <li>• "Quem está atrasado?"</li>
                    <li>• "Me dá um resumo"</li>
                  </ul>
                </div>
                
                <Button
                  onClick={handleTestVoiceAssistant}
                  disabled={testingVoice}
                  variant="outline"
                  className="w-full border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
                >
                  {testingVoice ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Testar Assistente de Voz
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {/* QR Code Modal */}
      <Dialog open={showQrModal} onOpenChange={handleCloseQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {showPairingCodeOption ? (
                <>
                  <Hash className="w-5 h-5 text-green-500" />
                  Conectar com Código
                </>
              ) : (
                <>
                  <QrCode className="w-5 h-5 text-green-500" />
                  Escaneie o QR Code
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {showPairingCodeOption 
                ? 'Digite o código de 8 dígitos no seu WhatsApp' 
                : 'Conecte seu WhatsApp para enviar mensagens aos clientes'}
            </DialogDescription>
          </DialogHeader>

          {/* Mobile Connection Option - fixed at the TOP of the modal */}
          {!showPairingCodeOption && qrCode && !generatingQr && !qrExpired && (
            <div className="mt-2">
              <Button
                variant="outline"
                className="w-full border-green-500/30 text-green-600 hover:bg-green-500/10"
                onClick={() => {
                  setShowPairingCodeOption(true);
                  setPairingCode(null);
                }}
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Está no celular? Conecte com código
              </Button>
            </div>
          )}

          <div className="flex flex-col items-center py-4">
            {/* Toggle between QR and Pairing Code */}
            {!showPairingCodeOption ? (
              <>

                {/* Timer and Progress Bar */}
                {qrCode && !generatingQr && (
                  <div className="w-full mb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Timer className={`w-4 h-4 ${qrExpired ? 'text-destructive' : qrTimeRemaining <= 15 ? 'text-amber-500' : 'text-green-500'}`} />
                        <span className={`text-sm font-medium ${qrExpired ? 'text-destructive' : qrTimeRemaining <= 15 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {qrExpired ? 'QR Code expirado!' : `${qrTimeRemaining}s restantes`}
                        </span>
                      </div>
                      {!qrExpired && (
                        <span className="text-xs text-muted-foreground">Escaneie com calma</span>
                      )}
                    </div>
                    <Progress 
                      value={(qrTimeRemaining / 90) * 100} 
                      className={`h-2 ${qrExpired ? '[&>div]:bg-destructive' : qrTimeRemaining <= 15 ? '[&>div]:bg-amber-500' : '[&>div]:bg-green-500'}`}
                    />
                  </div>
                )}

                {/* QR Code Display */}
                {generatingQr ? (
                  <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Gerando QR Code...</span>
                    </div>
                  </div>
                ) : qrCode ? (
                  <div className="relative">
                    <div className={`p-4 bg-white rounded-lg transition-all ${qrExpired ? 'opacity-30 blur-sm' : ''}`}>
                      <img 
                        src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} 
                        alt="QR Code" 
                        className="w-56 h-56"
                      />
                    </div>
                    
                    {/* Expired Overlay */}
                    {qrExpired && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 rounded-lg">
                        <AlertCircle className="w-12 h-12 text-destructive mb-3" />
                        <p className="font-medium text-destructive text-center">QR Code expirado!</p>
                        <p className="text-sm text-muted-foreground text-center mt-1">Clique abaixo para gerar um novo</p>
                        <Button 
                          onClick={() => handleRefreshQrCode()}
                          disabled={generatingQr}
                          className="mt-4 bg-green-600 hover:bg-green-700"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Gerar Novo QR Code
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-lg">
                    <div className="flex flex-col items-center gap-3">
                      <AlertCircle className="w-8 h-8 text-destructive" />
                      <p className="text-muted-foreground text-center">Erro ao gerar QR Code</p>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefreshQrCode()}
                        disabled={generatingQr}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Tentar Novamente
                      </Button>
                    </div>
                  </div>
                )}

                {/* Instructions */}
                {!qrExpired && (
                  <div className="mt-6 w-full space-y-3">
                    {/* Warning about device conflicts */}
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-600">
                          <strong>Importante:</strong> Se você tiver outras sessões do WhatsApp Web ativas, feche-as primeiro para evitar desconexões.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-full bg-green-500/10">
                        <Smartphone className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">1. Abra o WhatsApp</p>
                        <p className="text-xs text-muted-foreground">No seu celular</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-full bg-green-500/10">
                        <Link className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">2. Aparelhos conectados</p>
                        <p className="text-xs text-muted-foreground">Menu ⋮ → Aparelhos conectados</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="p-2 rounded-full bg-green-500/10">
                        <Camera className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">3. Escaneie este QR Code</p>
                        <p className="text-xs text-muted-foreground">Toque em "Conectar um aparelho" e escaneie</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Connection Status */}
                {!qrExpired && qrCode && !generatingQr && (
                  <div className="flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-green-500/10 text-green-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Aguardando conexão...</span>
                  </div>
                )}

                {/* Refresh Button (when not expired) */}
                {!qrExpired && qrCode && !generatingQr && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRefreshQrCode()}
                    disabled={generatingQr}
                    className="mt-3 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar QR Code
                  </Button>
                )}

              </>
            ) : (
              /* Pairing Code View */
              <div className="w-full space-y-4">
                {!pairingCode ? (
                  <>
                    {/* Phone number input */}
                    <div className="space-y-2">
                      <Label htmlFor="pairing-phone">Número do WhatsApp</Label>
                      <Input
                        id="pairing-phone"
                        placeholder="5511999999999"
                        value={pairingPhoneNumber}
                        onChange={(e) => setPairingPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        maxLength={15}
                      />
                      <p className="text-xs text-muted-foreground">
                        Digite o número completo com código do país e DDD (ex: 5511999999999)
                      </p>
                    </div>

                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={handleRequestPairingCode}
                      disabled={generatingPairingCode || pairingPhoneNumber.length < 10}
                    >
                      {generatingPairingCode ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Gerando código...
                        </>
                      ) : (
                        <>
                          <Hash className="w-4 h-4 mr-2" />
                          Gerar Código de Pareamento
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Display Pairing Code */}
                    <div className="p-6 bg-green-500/10 border-2 border-green-500/30 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-2">Seu código de pareamento:</p>
                      <p className="text-4xl font-mono font-bold tracking-widest text-green-600">
                        {pairingCode}
                      </p>
                    </div>

                    {/* Instructions for pairing code */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="p-2 rounded-full bg-green-500/10">
                          <Smartphone className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">1. Abra o WhatsApp</p>
                          <p className="text-xs text-muted-foreground">No seu celular</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="p-2 rounded-full bg-green-500/10">
                          <Link className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">2. Aparelhos conectados</p>
                          <p className="text-xs text-muted-foreground">Menu ⋮ → Aparelhos conectados</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="p-2 rounded-full bg-green-500/10">
                          <Hash className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">3. Conectar com número</p>
                          <p className="text-xs text-muted-foreground">Toque em "Conectar com número de telefone" e digite o código</p>
                        </div>
                      </div>
                    </div>

                    {/* Waiting for connection */}
                    <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-green-500/10 text-green-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium">Aguardando conexão...</span>
                    </div>

                    {/* Generate new code button */}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setPairingCode(null);
                        setPairingPhoneNumber('');
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Gerar Novo Código
                    </Button>
                  </>
                )}

                {/* Back to QR option */}
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    setShowPairingCodeOption(false);
                    setPairingCode(null);
                    setPairingPhoneNumber('');
                  }}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Voltar para QR Code
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
