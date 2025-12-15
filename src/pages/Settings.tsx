import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { User, Building, Loader2, Phone, CheckCircle, AlertCircle, MessageCircle, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  const { user } = useAuth();
  const { profile, isProfileComplete, updateProfile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    company_name: '',
  });
  const [whatsappConfig, setWhatsappConfig] = useState({
    evolution_api_url: '',
    evolution_api_key: '',
    evolution_instance_name: '',
    whatsapp_to_clients_enabled: false,
  });
  const [errors, setErrors] = useState<{ full_name?: string; phone?: string }>({});

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || user?.email || '',
        phone: formatPhone(profile.phone || ''),
        company_name: profile.company_name || '',
      });
      setWhatsappConfig({
        evolution_api_url: profile.evolution_api_url || '',
        evolution_api_key: profile.evolution_api_key || '',
        evolution_instance_name: profile.evolution_instance_name || '',
        whatsapp_to_clients_enabled: profile.whatsapp_to_clients_enabled || false,
      });
    }
  }, [profile, user]);

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

  const handleSaveWhatsappConfig = async () => {
    setLoading(true);
    
    const { error } = await updateProfile({
      evolution_api_url: whatsappConfig.evolution_api_url.trim() || null,
      evolution_api_key: whatsappConfig.evolution_api_key.trim() || null,
      evolution_instance_name: whatsappConfig.evolution_instance_name.trim() || null,
      whatsapp_to_clients_enabled: whatsappConfig.whatsapp_to_clients_enabled,
    });

    if (error) {
      toast.error('Erro ao salvar configuração do WhatsApp');
    } else {
      toast.success('Configuração do WhatsApp salva!');
    }
    setLoading(false);
  };

  const handleTestConnection = async () => {
    if (!whatsappConfig.evolution_api_url || !whatsappConfig.evolution_api_key || !whatsappConfig.evolution_instance_name) {
      toast.error('Preencha todos os campos da API antes de testar');
      return;
    }

    setTestingConnection(true);
    try {
      // Test by fetching instance status
      const apiUrl = `${whatsappConfig.evolution_api_url}/instance/connectionState/${whatsappConfig.evolution_instance_name}`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'apikey': whatsappConfig.evolution_api_key,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.instance?.state === 'open') {
          toast.success('Conexão OK! WhatsApp conectado.');
        } else {
          toast.warning(`Instância encontrada, mas status: ${data?.instance?.state || 'desconhecido'}`);
        }
      } else {
        toast.error('Erro ao conectar. Verifique as credenciais.');
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toast.error('Erro ao testar conexão. Verifique a URL da API.');
    } finally {
      setTestingConnection(false);
    }
  };

  const isWhatsappConfigured = whatsappConfig.evolution_api_url && whatsappConfig.evolution_api_key && whatsappConfig.evolution_instance_name;

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

        {/* WhatsApp para Clientes */}
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
                    Configure seu próprio WhatsApp para enviar mensagens diretamente aos seus clientes
                  </CardDescription>
                </div>
              </div>
              {isWhatsappConfigured ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                  <Wifi className="w-3 h-3 mr-1" />
                  Configurado
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  <WifiOff className="w-3 h-3 mr-1" />
                  Não Configurado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium text-sm">Ativar envio para clientes</p>
                <p className="text-xs text-muted-foreground">Permite enviar notificações e comprovantes para seus clientes</p>
              </div>
              <Switch
                checked={whatsappConfig.whatsapp_to_clients_enabled}
                onCheckedChange={(checked) => setWhatsappConfig({ ...whatsappConfig, whatsapp_to_clients_enabled: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>URL da API Evolution</Label>
              <Input 
                value={whatsappConfig.evolution_api_url} 
                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, evolution_api_url: e.target.value })}
                placeholder="https://sua-api.com"
              />
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <Input 
                type="password"
                value={whatsappConfig.evolution_api_key} 
                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, evolution_api_key: e.target.value })}
                placeholder="Sua chave de API"
              />
            </div>

            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input 
                value={whatsappConfig.evolution_instance_name} 
                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, evolution_instance_name: e.target.value })}
                placeholder="Nome da instância no Evolution"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleTestConnection}
                disabled={testingConnection || !isWhatsappConfigured}
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4 mr-2" />
                    Testar Conexão
                  </>
                )}
              </Button>
              <Button 
                type="button"
                onClick={handleSaveWhatsappConfig}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Configuração'
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Com o WhatsApp configurado, você poderá enviar notificações de cobrança e comprovantes diretamente para os telefones dos seus clientes.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
