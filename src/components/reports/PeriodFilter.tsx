import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download, RefreshCw } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type PeriodType = 'thisMonth' | '3months' | '6months' | 'thisYear' | 'custom';

interface PeriodFilterProps {
  period: PeriodType;
  startDate: Date;
  endDate: Date;
  onPeriodChange: (period: PeriodType, startDate: Date, endDate: Date) => void;
  onExport?: () => void;
  onRefresh?: () => void;
  lastUpdated?: Date;
}

export function PeriodFilter({
  period,
  startDate,
  endDate,
  onPeriodChange,
  onExport,
  onRefresh,
  lastUpdated,
}: PeriodFilterProps) {
  const [customStartOpen, setCustomStartOpen] = useState(false);
  const [customEndOpen, setCustomEndOpen] = useState(false);

  const periods: { label: string; value: PeriodType }[] = [
    { label: 'Este Mês', value: 'thisMonth' },
    { label: '3 Meses', value: '3months' },
    { label: '6 Meses', value: '6months' },
    { label: 'Este Ano', value: 'thisYear' },
    { label: 'Personalizado', value: 'custom' },
  ];

  const handlePeriodClick = (newPeriod: PeriodType) => {
    const now = new Date();
    let newStart: Date;
    let newEnd: Date = endOfMonth(now);

    switch (newPeriod) {
      case 'thisMonth':
        newStart = startOfMonth(now);
        break;
      case '3months':
        newStart = startOfMonth(subMonths(now, 2));
        break;
      case '6months':
        newStart = startOfMonth(subMonths(now, 5));
        break;
      case 'thisYear':
        newStart = startOfYear(now);
        newEnd = endOfYear(now);
        break;
      case 'custom':
        return;
      default:
        newStart = startOfMonth(now);
    }

    onPeriodChange(newPeriod, newStart, newEnd);
  };

  const handleCustomDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    if (!date) return;
    
    if (type === 'start') {
      onPeriodChange('custom', date, endDate);
      setCustomStartOpen(false);
    } else {
      onPeriodChange('custom', startDate, date);
      setCustomEndOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 bg-card rounded-lg border shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarIcon className="w-4 h-4 text-primary hidden sm:block" />
        <span className="text-sm font-medium hidden sm:block">Período:</span>
        
        <div className="flex flex-wrap gap-1.5 flex-1">
          {periods.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePeriodClick(p.value)}
              className={cn(
                "text-xs h-7 px-2 sm:px-3",
                period === p.value && "shadow-glow-sm"
              )}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom Date Pickers */}
      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={customStartOpen} onOpenChange={setCustomStartOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8">
                <CalendarIcon className="w-3 h-3 mr-1" />
                {format(startDate, 'dd/MM/yyyy', { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => handleCustomDateChange('start', date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          <span className="text-muted-foreground text-xs">até</span>
          
          <Popover open={customEndOpen} onOpenChange={setCustomEndOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8">
                <CalendarIcon className="w-3 h-3 mr-1" />
                {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => handleCustomDateChange('end', date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Actions Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastUpdated && (
            <>
              <RefreshCw className="w-3 h-3" />
              <span>Atualizado: {format(lastUpdated, 'HH:mm', { locale: ptBR })}</span>
            </>
          )}
        </div>
        
        <div className="flex gap-2">
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} className="h-7 px-2">
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} className="h-7 px-2 gap-1">
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline text-xs">Exportar</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
