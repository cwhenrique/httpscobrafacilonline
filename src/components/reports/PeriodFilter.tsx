import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

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
  const [calendarOpen, setCalendarOpen] = useState(false);

  const periods: { label: string; value: PeriodType }[] = [
    { label: 'Este Mês', value: 'thisMonth' },
    { label: '3 Meses', value: '3months' },
    { label: '6 Meses', value: '6months' },
    { label: 'Este Ano', value: 'thisYear' },
  ];

  const handlePeriodClick = (newPeriod: PeriodType) => {
    const now = new Date();
    let newStart: Date;
    let newEnd: Date;

    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const subMonths = (d: Date, months: number) => {
      const result = new Date(d);
      result.setMonth(result.getMonth() - months);
      return result;
    };
    const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
    const endOfYear = (d: Date) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

    switch (newPeriod) {
      case 'thisMonth':
        newStart = startOfMonth(now);
        newEnd = endOfMonth(now);
        break;
      case '3months':
        newStart = startOfMonth(subMonths(now, 2));
        newEnd = endOfMonth(now);
        break;
      case '6months':
        newStart = startOfMonth(subMonths(now, 5));
        newEnd = endOfMonth(now);
        break;
      case 'thisYear':
        newStart = startOfYear(now);
        newEnd = endOfYear(now);
        break;
      default:
        newStart = startOfMonth(now);
        newEnd = endOfMonth(now);
    }

    onPeriodChange(newPeriod, newStart, newEnd);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      const newStart = range.from;
      const newEnd = range.to || range.from;
      onPeriodChange('custom', newStart, newEnd);
      
      // Close calendar when both dates are selected
      if (range.from && range.to) {
        setCalendarOpen(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 bg-card rounded-lg border shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarIcon className="w-4 h-4 text-primary hidden sm:block" />
        <span className="text-sm font-medium hidden sm:block">Período:</span>
        
        <div className="flex flex-wrap gap-1.5">
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

        {/* Date Range Picker - Always visible */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button 
              variant={period === 'custom' ? 'default' : 'outline'} 
              size="sm" 
              className={cn(
                "text-xs h-7 gap-1",
                period === 'custom' && "shadow-glow-sm"
              )}
            >
              <CalendarIcon className="w-3 h-3" />
              <span className="hidden xs:inline">
                {format(startDate, 'dd/MM/yy', { locale: ptBR })}
              </span>
              <span>-</span>
              <span className="hidden xs:inline">
                {format(endDate, 'dd/MM/yy', { locale: ptBR })}
              </span>
              <span className="xs:hidden">
                {format(startDate, 'dd/MM', { locale: ptBR })} - {format(endDate, 'dd/MM', { locale: ptBR })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: startDate, to: endDate }}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

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
