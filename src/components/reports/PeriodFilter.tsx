import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Download, RefreshCw, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

export type PeriodType = 'custom';

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
  startDate,
  endDate,
  onPeriodChange,
  onExport,
  onRefresh,
  lastUpdated,
}: PeriodFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>({ from: startDate, to: endDate });

  // Sync tempRange when props change
  useEffect(() => {
    setTempRange({ from: startDate, to: endDate });
  }, [startDate, endDate]);

  const handleRangeSelect = (range: DateRange | undefined) => {
    setTempRange(range);
  };

  const handleConfirm = () => {
    if (tempRange?.from && tempRange?.to) {
      onPeriodChange('custom', tempRange.from, tempRange.to);
    } else if (tempRange?.from) {
      onPeriodChange('custom', tempRange.from, tempRange.from);
    }
    setCalendarOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    setCalendarOpen(open);
    if (open) {
      // Reset para começar seleção do zero: primeiro clique = início, segundo = fim
      setTempRange(undefined);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 bg-card rounded-lg border shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarIcon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Período:</span>

        {/* Date Range Picker */}
        <Popover open={calendarOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline"
              size="sm" 
              className="text-xs h-8 gap-2 min-w-[180px] justify-start"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>
                {format(startDate, 'dd/MM/yyyy', { locale: ptBR })} - {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 border-b">
              <p className="text-sm text-muted-foreground">
                {!tempRange?.from ? 'Selecione a data inicial' : !tempRange?.to ? 'Selecione a data final' : 'Período selecionado'}
              </p>
              {tempRange?.from && (
                <p className="text-sm font-medium text-primary mt-1">
                  {format(tempRange.from, 'dd/MM/yyyy', { locale: ptBR })}
                  {tempRange?.to && ` - ${format(tempRange.to, 'dd/MM/yyyy', { locale: ptBR })}`}
                </p>
              )}
            </div>
            <Calendar
              mode="range"
              selected={tempRange}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              initialFocus
              className="pointer-events-auto"
              modifiersClassNames={{
                selected: 'bg-primary text-primary-foreground',
                range_start: 'bg-primary text-primary-foreground rounded-l-md',
                range_end: 'bg-primary text-primary-foreground rounded-r-md',
                range_middle: 'bg-primary/20 text-foreground',
              }}
            />
            <div className="p-3 border-t flex justify-end">
              <Button 
                size="sm" 
                onClick={handleConfirm}
                disabled={!tempRange?.from}
                className="gap-2"
              >
                <Check className="w-4 h-4" />
                Confirmar
              </Button>
            </div>
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
