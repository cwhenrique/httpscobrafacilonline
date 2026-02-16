import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Save, Settings2, RotateCcw, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BillingMessageConfig, 
  DEFAULT_BILLING_MESSAGE_CONFIG,
  DEFAULT_TEMPLATE_OVERDUE,
  DEFAULT_TEMPLATE_DUE_TODAY,
  DEFAULT_TEMPLATE_EARLY,
  TEMPLATE_VARIABLES,
  PRESET_TEMPLATES_OVERDUE,
  PRESET_TEMPLATES_DUE_TODAY,
  PRESET_TEMPLATES_EARLY,
  PresetTemplate,
} from '@/types/billingMessageConfig';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfile } from '@/hooks/useProfile';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MessageType = 'overdue' | 'dueToday' | 'early';

const PRESETS_MAP: Record<MessageType, PresetTemplate[]> = {
  overdue: PRESET_TEMPLATES_OVERDUE,
  dueToday: PRESET_TEMPLATES_DUE_TODAY,
  early: PRESET_TEMPLATES_EARLY,
};

const TAB_CONFIG: Record<MessageType, { label: string; emoji: string; color: string; defaultTemplate: string; configKey: keyof BillingMessageConfig }> = {
  overdue: {
    label: 'Atraso',
    emoji: '🔴',
    color: 'text-red-400',
    defaultTemplate: DEFAULT_TEMPLATE_OVERDUE,
    configKey: 'customTemplateOverdue',
  },
  dueToday: {
    label: 'Vence Hoje',
    emoji: '🟡',
    color: 'text-yellow-400',
    defaultTemplate: DEFAULT_TEMPLATE_DUE_TODAY,
    configKey: 'customTemplateDueToday',
  },
  early: {
    label: 'Antecipada',
    emoji: '🟢',
    color: 'text-green-400',
    defaultTemplate: DEFAULT_TEMPLATE_EARLY,
    configKey: 'customTemplateEarly',
  },
};

export default function BillingMessageConfigCard() {
  const { profile, updateProfile, refetch } = useProfile();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<MessageType>('overdue');
  
  // Parse config from profile or use defaults
  const getConfig = (): BillingMessageConfig => {
    if (profile?.billing_message_config && typeof profile.billing_message_config === 'object') {
      return { ...DEFAULT_BILLING_MESSAGE_CONFIG, ...profile.billing_message_config as BillingMessageConfig };
    }
    return DEFAULT_BILLING_MESSAGE_CONFIG;
  };
  
  const [config, setConfig] = useState<BillingMessageConfig>(getConfig);
  
  // Templates state - initialized with defaults so user sees them immediately
  const [templates, setTemplates] = useState<Record<MessageType, string>>({
    overdue: DEFAULT_TEMPLATE_OVERDUE,
    dueToday: DEFAULT_TEMPLATE_DUE_TODAY,
    early: DEFAULT_TEMPLATE_EARLY,
  });

  // Update config and templates when profile loads
  useEffect(() => {
    if (profile) {
      const loadedConfig = getConfig();
      setConfig(loadedConfig);
      setTemplates({
        overdue: loadedConfig.customTemplateOverdue || DEFAULT_TEMPLATE_OVERDUE,
        dueToday: loadedConfig.customTemplateDueToday || DEFAULT_TEMPLATE_DUE_TODAY,
        early: loadedConfig.customTemplateEarly || DEFAULT_TEMPLATE_EARLY,
      });
    }
  }, [profile]);

  const handleTemplateChange = (type: MessageType, value: string) => {
    setTemplates(prev => ({
      ...prev,
      [type]: value,
    }));
  };

  const handleResetTemplate = (type: MessageType) => {
    const defaultTemplate = TAB_CONFIG[type].defaultTemplate;
    setTemplates(prev => ({
      ...prev,
      [type]: defaultTemplate,
    }));
    toast.success('Template restaurado para o padrão');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedConfig: BillingMessageConfig = {
        ...config,
        customTemplateOverdue: templates.overdue,
        customTemplateDueToday: templates.dueToday,
        customTemplateEarly: templates.early,
        useCustomTemplates: true,
      };

      const { error } = await updateProfile({
        billing_message_config: updatedConfig,
      } as any);
      
      if (error) throw error;
      
      await refetch();
      toast.success('Templates de mensagem salvos!');
    } catch (error) {
      console.error('Error saving billing message config:', error);
      toast.error('Erro ao salvar templates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" />
          Mensagem de Cobrança
        </CardTitle>
        <CardDescription>
          Edite os templates de mensagem para cada tipo de cobrança. Use as variáveis para inserir dados dinâmicos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MessageType)}>
          <TabsList className="grid w-full grid-cols-3">
            {(Object.entries(TAB_CONFIG) as [MessageType, typeof TAB_CONFIG[MessageType]][]).map(([key, { label, emoji, color }]) => (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <span className={color}>{emoji}</span>
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {(Object.entries(TAB_CONFIG) as [MessageType, typeof TAB_CONFIG[MessageType]][]).map(([type]) => (
            <TabsContent key={type} value={type} className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Escolher template pronto</label>
                <Select
                  onValueChange={(presetId) => {
                    const preset = PRESETS_MAP[type].find(p => p.id === presetId);
                    if (preset) {
                      handleTemplateChange(type, preset.template);
                      toast.success(`Template "${preset.name}" aplicado!`);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um template pronto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS_MAP[type].map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <div className="flex flex-col items-start">
                          <span>{preset.name}</span>
                          <span className="text-xs text-muted-foreground">{preset.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Textarea
                  value={templates[type]}
                  onChange={(e) => handleTemplateChange(type, e.target.value)}
                  className="min-h-[300px] font-mono text-sm bg-background/50"
                  placeholder="Digite seu template de mensagem..."
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResetTemplate(type)}
                  className="absolute top-2 right-2"
                  title="Restaurar template padrão"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Variables Reference */}
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Info className="w-4 h-4 text-primary" />
            Variáveis disponíveis
          </div>
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              {TEMPLATE_VARIABLES.map(({ variable, description }) => (
                <Tooltip key={variable}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(variable);
                        toast.success(`"${variable}" copiado!`);
                      }}
                      className="px-2 py-1 bg-primary/10 text-primary text-xs rounded font-mono hover:bg-primary/20 transition-colors"
                    >
                      {variable}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{description}</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique para copiar</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setTemplates({
                overdue: DEFAULT_TEMPLATE_OVERDUE,
                dueToday: DEFAULT_TEMPLATE_DUE_TODAY,
                early: DEFAULT_TEMPLATE_EARLY,
              });
              toast.success('Todos os templates restaurados para o padrão');
            }}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Resetar Todos
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Templates
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
