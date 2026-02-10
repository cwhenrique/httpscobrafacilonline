import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useEmployeeContext } from '@/hooks/useEmployeeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { User, Building, Loader2, Phone, CheckCircle, AlertCircle, MessageCircle, Mic, MicOff, Info, ExternalLink, BellRing, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EmployeeManagement from '@/components/EmployeeManagement';
import EmployeeFeatureCard from '@/components/EmployeeFeatureCard';
import BillingMessageConfigCard from '@/components/BillingMessageConfigCard';

// Emails com acesso privilegiado ao assistente de voz (independente do plano)
const VOICE_PRIVILEGED_EMAILS = [
  'clau_pogian@hotmail.com',
  'maicon.francoso1@gmail.com',
];

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, isProfileComplete, updateProfile } = useProfile();
  const { isEmployee } = useEmployeeContext();

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
  
  // Voice assistant states
  const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useState(false);
  const [togglingVoice, setTogglingVoice] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);

  // Auto billing states
  const [autoBillingEnabled, setAutoBillingEnabled] = useState(false);
  const [autoBillingHour, setAutoBillingHour] = useState(8);
  const [autoBillingTypes, setAutoBillingTypes] = useState<string[]>(['due_today', 'overdue']);
  const [savingAutoBilling, setSavingAutoBilling] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || user?.email || '',
        phone: formatPhone(profile.phone || ''),
        company_name: profile.company_name || '',
      });
      setVoiceAssistantEnabled(profile.voice_assistant_enabled || false);
      setAutoBillingEnabled(profile.auto_client_reports_enabled || false);
      setAutoBillingHour(profile.auto_report_hour || 8);
      setAutoBillingTypes(profile.auto_report_types || ['due_today', 'overdue']);
    }
  }, [profile, user]);

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

  const handleSaveAutoBilling = async () => {
    setSavingAutoBilling(true);
    try {
      const { error } = await updateProfile({
        auto_client_reports_enabled: autoBillingEnabled,
        auto_report_hour: autoBillingHour,
        auto_report_types: autoBillingTypes,
      } as any);
      if (error) {
        toast.error('Erro ao salvar configuração');
      } else {
        toast.success('Cobrança automática configurada!');
      }
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSavingAutoBilling(false);
    }
  };

  const toggleBillingType = (type: string) => {
    setAutoBillingTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
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

        {/* WhatsApp para Clientes - Migração para Meu Perfil */}
        <Card className="shadow-soft border-blue-500/20">
          <CardHeader>
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
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-blue-600 mb-1">
                    Esta funcionalidade foi movida
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    A conexão e configuração do WhatsApp para enviar mensagens aos seus clientes agora está disponível na página <strong>Meu Perfil</strong>.
                  </p>
                  <Button 
                    onClick={() => navigate('/profile')}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ir para Meu Perfil
                  </Button>
                </div>
              </div>
            </div>
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

        {/* Auto Client Billing */}
        {profile?.whatsapp_instance_id && profile?.whatsapp_to_clients_enabled && (
        <Card className="shadow-soft border-orange-500/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <BellRing className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle>Cobrança Automática para Clientes</CardTitle>
                  <CardDescription>
                    Envie cobranças automaticamente via WhatsApp para seus clientes
                  </CardDescription>
                </div>
              </div>
              {autoBillingEnabled ? (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                  <BellRing className="w-3 h-3 mr-1" />
                  Ativo
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  Inativo
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium text-sm">Ativar Cobrança Automática</p>
                <p className="text-xs text-muted-foreground">Mensagens enviadas automaticamente nos horários configurados</p>
              </div>
              <Switch
                checked={autoBillingEnabled}
                onCheckedChange={setAutoBillingEnabled}
              />
            </div>

            {autoBillingEnabled && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      As mensagens serão enviadas pelo <strong>seu WhatsApp conectado</strong> diretamente para os clientes com número cadastrado. Máximo de 50 mensagens por dia, sem envio aos domingos.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Horário de Envio
                  </Label>
                  <Select
                    value={String(autoBillingHour)}
                    onValueChange={(val) => setAutoBillingHour(parseInt(val))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">07:00</SelectItem>
                      <SelectItem value="8">08:00</SelectItem>
                      <SelectItem value="9">09:00</SelectItem>
                      <SelectItem value="10">10:00</SelectItem>
                      <SelectItem value="12">12:00</SelectItem>
                      <SelectItem value="14">14:00</SelectItem>
                      <SelectItem value="16">16:00</SelectItem>
                      <SelectItem value="18">18:00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipos de Cobrança</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="type_due_today"
                        checked={autoBillingTypes.includes('due_today')}
                        onCheckedChange={() => toggleBillingType('due_today')}
                      />
                      <label htmlFor="type_due_today" className="text-sm">
                        📅 Vence Hoje — lembrete no dia do vencimento
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="type_overdue"
                        checked={autoBillingTypes.includes('overdue')}
                        onCheckedChange={() => toggleBillingType('overdue')}
                      />
                      <label htmlFor="type_overdue" className="text-sm">
                        🚨 Em Atraso — cobrança de parcelas vencidas
                      </label>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSaveAutoBilling}
                  disabled={savingAutoBilling || autoBillingTypes.length === 0}
                  className="w-full"
                >
                  {savingAutoBilling ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Configuração'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Billing Message Configuration - Advanced */}
        <BillingMessageConfigCard />

        {/* Employee Management Section */}
        {!isEmployee && (
          <EmployeeFeatureCard 
            isUnlocked={profile?.employees_feature_enabled || false}
            onUnlock={() => {
              toast.info('Entre em contato para liberar este recurso');
            }}
          >
            <EmployeeManagement />
          </EmployeeFeatureCard>
        )}
      </div>
    </DashboardLayout>
  );
}
