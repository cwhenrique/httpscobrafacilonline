import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, User, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Client } from '@/types/database';
import { useClients } from '@/hooks/useClients';

interface ClientSelectorProps {
  onSelect: (client: Client | null) => void;
  selectedClientId?: string | null;
  placeholder?: string;
  className?: string;
}

export function formatFullAddress(client: Client): string {
  const parts = [
    client.street,
    client.number,
    client.complement,
    client.neighborhood,
    client.city,
    client.state,
    client.cep,
  ].filter(Boolean);
  
  // If structured address exists, use it
  if (parts.length > 0) {
    return parts.join(', ');
  }
  
  // Fallback to legacy address field
  return client.address || '';
}

export function ClientSelector({
  onSelect,
  selectedClientId,
  placeholder = 'Selecionar cliente cadastrado...',
  className,
}: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const { clients, loading } = useClients();

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSelect = (clientId: string | null) => {
    if (clientId === null) {
      onSelect(null);
    } else {
      const client = clients.find((c) => c.id === clientId);
      onSelect(client || null);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
        >
          {selectedClient ? (
            <div className="flex items-center gap-2 truncate">
              <Avatar className="h-6 w-6">
                <AvatarImage src={selectedClient.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                  {getInitials(selectedClient.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{selectedClient.full_name}</span>
              {selectedClient.phone && (
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                  • {selectedClient.phone}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar cliente..." />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Carregando...' : 'Nenhum cliente encontrado.'}
            </CommandEmpty>
            <CommandGroup>
              {/* Option to type manually */}
              <CommandItem
                value="__manual__"
                onSelect={() => handleSelect(null)}
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Digitar manualmente</span>
                <Check
                  className={cn(
                    'ml-auto h-4 w-4',
                    selectedClientId === null ? 'opacity-100' : 'opacity-0'
                  )}
                />
              </CommandItem>
              
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={`${client.full_name} ${client.phone || ''} ${client.cpf || ''}`}
                  onSelect={() => handleSelect(client.id)}
                  className="flex items-center gap-2"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={client.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                      {getInitials(client.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate font-medium">{client.full_name}</span>
                    {client.phone && (
                      <span className="text-xs text-muted-foreground truncate">
                        {client.phone}
                      </span>
                    )}
                  </div>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      selectedClientId === client.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
