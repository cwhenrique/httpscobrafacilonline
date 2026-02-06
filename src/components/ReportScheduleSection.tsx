import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Calendar, Sun, Clock, Sunset } from 'lucide-react';
import { toast } from 'sonner';

interface ReportScheduleSectionProps {
  scheduleHours: number[];
  onUpdate: (hours: number[]) => Promise<{ error: Error | null }>;
}

const SCHEDULE_GROUPS = [
  {
    label: 'Manhã',
    icon: Sun,
    hours: [7, 8, 9],
  },
  {
    label: 'Tarde',
    icon: Clock,
    hours: [12, 13, 14],
  },
  {
    label: 'Fim do Dia',
    icon: Sunset,
    hours: [17, 18, 19],
  },
];

export default function ReportScheduleSection({ scheduleHours, onUpdate }: ReportScheduleSectionProps) {
  const [selectedHours, setSelectedHours] = useState<number[]>(scheduleHours || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedHours(scheduleHours || []);
  }, [scheduleHours]);

  const handleToggleHour = async (hour: number) => {
    const newHours = selectedHours.includes(hour)
      ? selectedHours.filter(h => h !== hour)
      : [...selectedHours, hour].sort((a, b) => a - b);

    setSelectedHours(newHours);
    setSaving(true);

    try {
      const { error } = await onUpdate(newHours);
      if (error) {
        toast.error('Erro ao salvar preferências');
        setSelectedHours(scheduleHours || []);
      } else {
        toast.success('Preferências salvas!');
      }
    } finally {
      setSaving(false);
    }
  };

  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}h`;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Receber Relatórios Diários</CardTitle>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <CardDescription>
          Escolha os horários para receber seu relatório de cobranças automaticamente no WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {SCHEDULE_GROUPS.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <group.icon className="w-4 h-4" />
              <span>{group.label}</span>
            </div>
            <div className="flex flex-wrap gap-4">
              {group.hours.map((hour) => (
                <div key={hour} className="flex items-center space-x-2">
                  <Checkbox
                    id={`hour-${hour}`}
                    checked={selectedHours.includes(hour)}
                    onCheckedChange={() => handleToggleHour(hour)}
                    disabled={saving}
                  />
                  <Label
                    htmlFor={`hour-${hour}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {formatHour(hour)}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {selectedHours.length > 0 && (
          <p className="text-xs text-muted-foreground pt-2 border-t">
            Horários selecionados: {selectedHours.map(formatHour).join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
