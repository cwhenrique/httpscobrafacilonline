import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreateMonthlyFeeData } from '@/hooks/useMonthlyFees';
import { useIPTVPlans } from '@/hooks/useIPTVPlans';
import { Client } from '@/types/database';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Eye, EyeOff, RefreshCw, Copy, UserPlus, Users, ExternalLink, Server, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface IPTVSubscriptionFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onSubmit: (data: CreateMonthlyFeeData) => Promise<void>;
  isPending: boolean;
}

const REFERRAL_SOURCES = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'google', label: 'Google' },
  { value: 'outro', label: 'Outro' },
];

const generatePassword = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const generateUsernameFromName = (name: string) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10) + Math.floor(Math.random() * 100);
};

export default function IPTVSubscriptionForm({
  isOpen,
  onOpenChange,
  clients,
  onSubmit,
  isPending,
}: IPTVSubscriptionFormProps) {
  const { activePlans } = useIPTVPlans();
  const [showPassword, setShowPassword] = useState(false);
  const [creditExpiresCalendarOpen, setCreditExpiresCalendarOpen] = useState(false);
  const [demoExpiresCalendarOpen, setDemoExpiresCalendarOpen] = useState(false);
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  
  const [formData, setFormData] = useState<CreateMonthlyFeeData>({
    client_id: '',
    amount: 0,
    description: 'IPTV',
    due_day: 10,
    interest_rate: 0,
    generate_current_month: true,
    plan_type: 'basic',
    login_username: '',
    login_password: '',
    credit_expires_at: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
    max_devices: 1,
    referral_source: '',
    is_demo: false,
    demo_expires_at: '',
    // Per-subscription server info
    iptv_server_name: '',
    iptv_server_url: '',
    // Card color
    card_color: '',
    // New client fields
    create_new_client: false,
    new_client_name: '',
    new_client_phone: '',
    new_client_cpf: '',
    new_client_email: '',
  });

  // Auto-generate username when client is selected (existing mode)
  useEffect(() => {
    if (clientMode === 'existing' && formData.client_id && !formData.login_username) {
      const client = clients.find(c => c.id === formData.client_id);
      if (client) {
        setFormData(prev => ({
          ...prev,
          login_username: generateUsernameFromName(client.full_name),
          login_password: generatePassword(),
        }));
      }
    }
  }, [formData.client_id, clients, clientMode]);

  // Auto-generate username when new client name is typed
  useEffect(() => {
    if (clientMode === 'new' && formData.new_client_name && formData.new_client_name.length >= 2) {
      // Only auto-generate if username is empty or was auto-generated before
      if (!formData.login_username || formData.login_username.match(/^[a-z]+\d+$/)) {
        setFormData(prev => ({
          ...prev,
          login_username: generateUsernameFromName(formData.new_client_name || ''),
          login_password: prev.login_password || generatePassword(),
        }));
      }
    }
  }, [formData.new_client_name, clientMode]);

  // Apply plan settings when plan is selected
  const handlePlanSelect = (planId: string) => {
    const plan = activePlans.find(p => p.id === planId);
    if (plan) {
      setFormData(prev => ({
        ...prev,
        plan_type: plan.name.toLowerCase(),
        amount: plan.price,
        max_devices: plan.max_devices,
        description: plan.name,
      }));
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (clientMode === 'existing' && !formData.client_id) {
      toast.error('Selecione um cliente');
      return;
    }
    if (clientMode === 'new' && (!formData.new_client_name || formData.new_client_name.trim().length < 2)) {
      toast.error('Digite o nome do cliente (mínimo 2 caracteres)');
      return;
    }
    if (!formData.amount) {
      toast.error('Digite o valor mensal');
      return;
    }

    const submitData: CreateMonthlyFeeData = {
      ...formData,
      create_new_client: clientMode === 'new',
    };

    await onSubmit(submitData);
    
    // Reset form
    setClientMode('existing');
    setFormData({
      client_id: '',
      amount: 0,
      description: 'IPTV',
      due_day: 10,
      interest_rate: 0,
      generate_current_month: true,
      plan_type: 'basic',
      login_username: '',
      login_password: '',
      credit_expires_at: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
      max_devices: 1,
      referral_source: '',
      is_demo: false,
      demo_expires_at: '',
      iptv_server_name: '',
      iptv_server_url: '',
      card_color: '',
      create_new_client: false,
      new_client_name: '',
      new_client_phone: '',
      new_client_cpf: '',
      new_client_email: '',
    });
  };

  const copyCredentials = () => {
    const text = `Login: ${formData.login_username}\nSenha: ${formData.login_password}`;
    navigator.clipboard.writeText(text);
    toast.success('Credenciais copiadas!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Assinatura IPTV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Client Mode Selection */}
          <div className="space-y-3">
            <Label>Cliente *</Label>
            <RadioGroup 
              value={clientMode} 
              onValueChange={(value: 'existing' | 'new') => {
                setClientMode(value);
                // Clear client fields when switching modes
                setFormData(prev => ({
                  ...prev,
                  client_id: '',
                  new_client_name: '',
                  new_client_phone: '',
                  new_client_cpf: '',
                  new_client_email: '',
                  login_username: '',
                  login_password: '',
                }));
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing" />
                <Label htmlFor="existing" className="flex items-center gap-1 cursor-pointer">
                  <Users className="w-4 h-4" />
                  Cliente existente
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new" className="flex items-center gap-1 cursor-pointer">
                  <UserPlus className="w-4 h-4" />
                  Novo cliente
                </Label>
              </div>
            </RadioGroup>

            {/* Existing Client Dropdown */}
            {clientMode === 'existing' && (
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* New Client Form */}
            {clientMode === 'new' && (
              <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Nome do Cliente *</Label>
                  <Input
                    value={formData.new_client_name || ''}
                    onChange={(e) => setFormData({ ...formData, new_client_name: e.target.value })}
                    placeholder="Nome completo"
                    className="h-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone</Label>
                    <Input
                      value={formData.new_client_phone || ''}
                      onChange={(e) => setFormData({ ...formData, new_client_phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CPF</Label>
                    <Input
                      value={formData.new_client_cpf || ''}
                      onChange={(e) => setFormData({ ...formData, new_client_cpf: e.target.value })}
                      placeholder="000.000.000-00"
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={formData.new_client_email || ''}
                    onChange={(e) => setFormData({ ...formData, new_client_email: e.target.value })}
                    placeholder="email@exemplo.com"
                    className="h-9"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Plan Selection */}
          {activePlans.length > 0 && (
            <div className="space-y-2">
              <Label>Plano Pré-configurado</Label>
              <div className="flex flex-wrap gap-2">
                {activePlans.map((plan) => (
                  <Button
                    key={plan.id}
                    type="button"
                    variant={formData.plan_type === plan.name.toLowerCase() ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePlanSelect(plan.id)}
                    className="gap-1"
                  >
                    {plan.name}
                    <Badge variant="secondary" className="ml-1 text-xs">
                      R${plan.price}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Description and Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: IPTV Premium..."
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Mensal (R$) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="50,00"
              />
            </div>
          </div>

          {/* Due Day and Devices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dia Vencimento</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={formData.due_day}
                onChange={(e) => setFormData({ ...formData, due_day: parseInt(e.target.value) || 10 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Qtd. Dispositivos</Label>
              <Input
                type="number"
                min="1"
                value={formData.max_devices || 1}
                onChange={(e) => setFormData({ ...formData, max_devices: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>

          {/* Credentials */}
          <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">🔑 Credenciais de Acesso</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={copyCredentials}
                disabled={!formData.login_username}
              >
                <Copy className="w-3 h-3" />
                Copiar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Login</Label>
                <Input
                  value={formData.login_username}
                  onChange={(e) => setFormData({ ...formData, login_username: e.target.value })}
                  placeholder="usuario123"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.login_password}
                    onChange={(e) => setFormData({ ...formData, login_password: e.target.value })}
                    placeholder="********"
                    className="h-9 pr-16"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setFormData({ ...formData, login_password: generatePassword() })}
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Server Info */}
          <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Server className="w-4 h-4" />
              Servidor IPTV
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Servidor</Label>
                <Input
                  value={formData.iptv_server_name || ''}
                  onChange={(e) => setFormData({ ...formData, iptv_server_name: e.target.value })}
                  placeholder="Ex: MegaTV, IPTVBrasil..."
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link do Painel</Label>
                <div className="flex gap-1">
                  <Input
                    value={formData.iptv_server_url || ''}
                    onChange={(e) => setFormData({ ...formData, iptv_server_url: e.target.value })}
                    placeholder="https://painel.servidor.com"
                    className="h-9"
                  />
                  {formData.iptv_server_url && (
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" asChild>
                      <a href={formData.iptv_server_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </Button>
                  )}
              </div>
            </div>

            {/* Card Color */}
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Cor do Card
              </Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: '', label: 'Padrão' },
                  { value: '#ef4444', label: 'Vermelho' },
                  { value: '#f97316', label: 'Laranja' },
                  { value: '#eab308', label: 'Amarelo' },
                  { value: '#22c55e', label: 'Verde' },
                  { value: '#06b6d4', label: 'Ciano' },
                  { value: '#3b82f6', label: 'Azul' },
                  { value: '#8b5cf6', label: 'Roxo' },
                  { value: '#ec4899', label: 'Rosa' },
                ].map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    title={color.label}
                    onClick={() => setFormData({ ...formData, card_color: color.value })}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      formData.card_color === color.value
                        ? "border-foreground scale-110 ring-2 ring-foreground/20"
                        : "border-border hover:scale-105",
                      !color.value && "bg-muted"
                    )}
                    style={color.value ? { backgroundColor: color.value } : undefined}
                  >
                    {formData.card_color === color.value && (
                      <span className="flex items-center justify-center text-white text-xs font-bold drop-shadow">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>

          <div className="space-y-2">
            <Label>Data de Expiração do Crédito</Label>
            <Popover open={creditExpiresCalendarOpen} onOpenChange={setCreditExpiresCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {formData.credit_expires_at
                    ? format(new Date(formData.credit_expires_at), 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={formData.credit_expires_at ? new Date(formData.credit_expires_at) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setFormData({ ...formData, credit_expires_at: format(date, 'yyyy-MM-dd') });
                    }
                    setCreditExpiresCalendarOpen(false);
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Referral Source */}
          <div className="space-y-2">
            <Label>Origem/Indicação</Label>
            <Select
              value={formData.referral_source}
              onValueChange={(value) => setFormData({ ...formData, referral_source: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Como o cliente chegou?" />
              </SelectTrigger>
              <SelectContent>
                {REFERRAL_SOURCES.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Demo Mode */}
          <div className="p-3 rounded-lg border space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_demo"
                checked={formData.is_demo}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  is_demo: checked as boolean,
                  demo_expires_at: checked ? format(addMonths(new Date(), 0), 'yyyy-MM-dd') : '',
                })}
              />
              <Label htmlFor="is_demo" className="cursor-pointer">
                Modo de Teste (Demo)
              </Label>
            </div>
            {formData.is_demo && (
              <div className="space-y-2">
                <Label className="text-xs">Data de Expiração do Teste</Label>
                <Popover open={demoExpiresCalendarOpen} onOpenChange={setDemoExpiresCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {formData.demo_expires_at
                        ? format(new Date(formData.demo_expires_at), 'dd/MM/yyyy', { locale: ptBR })
                        : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.demo_expires_at ? new Date(formData.demo_expires_at) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setFormData({ ...formData, demo_expires_at: format(date, 'yyyy-MM-dd') });
                        }
                        setDemoExpiresCalendarOpen(false);
                      }}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Interest Rate */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Taxa de Multa por Atraso (%)
              {(formData.interest_rate || 0) === 0 && (
                <Badge variant="outline" className="text-xs font-normal">Sem multa</Badge>
              )}
            </Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.interest_rate || ''}
              onChange={(e) => setFormData({ ...formData, interest_rate: parseFloat(e.target.value) || 0 })}
              placeholder="0.0 = sem multa"
            />
          </div>

          {/* Generate Current Month */}
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
            <Checkbox
              id="generate_current_month"
              checked={formData.generate_current_month}
              onCheckedChange={(checked) => setFormData({ ...formData, generate_current_month: checked as boolean })}
            />
            <Label htmlFor="generate_current_month" className="cursor-pointer text-sm">
              Gerar cobrança para o mês atual
            </Label>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={
              isPending || 
              !formData.amount || 
              (clientMode === 'existing' && !formData.client_id) ||
              (clientMode === 'new' && (!formData.new_client_name || formData.new_client_name.trim().length < 2))
            }
            className="w-full"
          >
            {isPending ? 'Salvando...' : 'Cadastrar Assinatura'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
