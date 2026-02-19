import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import {
  FileCheck,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  DollarSign,
  Package,
  FileText,
  Tv,
  Clock,
  Loader2,
  Shield,
} from 'lucide-react';

const CAKTO_CHECKOUT_URL = 'https://pay.cakto.com.br/DKbJ3gL';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, '0')}:00`,
}));

const CATEGORY_OPTIONS = [
  { value: 'loans', label: 'Empréstimos', icon: DollarSign },
  { value: 'products', label: 'Produtos', icon: Package },
  { value: 'contracts', label: 'Contratos', icon: FileText },
  { value: 'iptv', label: 'IPTV', icon: Tv },
];

export default function AutoReports() {
  const { profile, loading, updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);
  const [selectedHour, setSelectedHour] = useState<string>(
    String(profile?.auto_report_hour ?? 8)
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    profile?.auto_report_categories || ['loans']
  );

  const isActive = profile?.relatorio_ativo === true;

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateProfile({
      auto_report_hour: Number(selectedHour),
      auto_report_categories: selectedCategories,
    } as any);
    setSaving(false);

    if (error) {
      toast.error('Erro ao salvar configurações');
    } else {
      toast.success('Configurações salvas com sucesso!');
    }
  };

  const toggleCategory = (value: string) => {
    setSelectedCategories(prev =>
      prev.includes(value)
        ? prev.filter(c => c !== value)
        : [...prev, value]
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        <div>
          <h1 className="text-2xl font-display font-bold">Relatório Diário de Cobranças</h1>
          <p className="text-muted-foreground">
            Receba diariamente no seu WhatsApp quem cobrar e quem está em atraso
          </p>
        </div>

        {/* Status Card */}
        <Card className={isActive
          ? 'border-emerald-500/50 bg-gradient-to-r from-emerald-900/20 to-emerald-800/20'
          : 'border-destructive/30'
        }>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isActive ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                ) : (
                  <XCircle className="w-8 h-8 text-destructive" />
                )}
                <div>
                  <h3 className="font-semibold text-lg">
                    {isActive ? 'Assinatura Ativa' : 'Não Assinado'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isActive
                      ? 'Você recebe diariamente via API oficial do WhatsApp a lista de cobranças do dia'
                      : 'Assine para receber diariamente a lista de cobranças do dia via API oficial do WhatsApp'}
                  </p>
                </div>
              </div>
              {!isActive && (
                <Button
                  onClick={() => window.open(CAKTO_CHECKOUT_URL, '_blank')}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Assinar R$ 19,90/mês
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              )}
              {isActive && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                  Ativo
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CTA for non-subscribers */}
        {!isActive && (
          <Card className="shadow-soft bg-gradient-to-br from-emerald-900/30 to-green-900/30 border-emerald-500/30">
            <CardContent className="p-8 text-center">
              <FileCheck className="w-12 h-12 mx-auto mb-4 text-emerald-400" />
              <h2 className="text-xl font-bold mb-2">Relatório Diário de Cobranças via WhatsApp</h2>
              <p className="text-muted-foreground mb-4 max-w-lg mx-auto">
                Receba uma vez por dia, de um número nosso via API oficial do WhatsApp, a lista completa
                de quem você deve cobrar naquele dia e quem está em atraso. Você define o horário de
                recebimento. Serviço em parceria com WhatsApp.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mb-4">
                {CATEGORY_OPTIONS.map(cat => (
                  <div key={cat.value} className="flex items-center gap-2 bg-background/30 rounded-full px-4 py-2">
                    <cat.icon className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium">{cat.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 mb-6 text-xs text-muted-foreground">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Parceria oficial com WhatsApp — API verificada</span>
              </div>
              <Button
                size="lg"
                onClick={() => window.open(CAKTO_CHECKOUT_URL, '_blank')}
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Assinar Agora — R$ 19,90/mês
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Configuration - only for active subscribers */}
        {isActive && (
          <>
            {/* Delivery Time */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Horário de Recebimento</CardTitle>
                <CardDescription>Escolha em qual horário deseja receber a lista de cobranças do dia</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 max-w-xs">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  <Select value={selectedHour} onValueChange={setSelectedHour}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Categorias do Relatório</CardTitle>
                <CardDescription>Selecione quais informações deseja receber</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORY_OPTIONS.map(cat => (
                    <label
                      key={cat.value}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedCategories.includes(cat.value)
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-border hover:border-emerald-500/50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedCategories.includes(cat.value)}
                        onCheckedChange={() => toggleCategory(cat.value)}
                      />
                      <cat.icon className="w-5 h-5 text-emerald-400" />
                      <span className="font-medium text-sm">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleSave}
              disabled={saving || selectedCategories.length === 0}
              className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Salvar Configurações
            </Button>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
