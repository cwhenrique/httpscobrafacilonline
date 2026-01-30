import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Users, Search } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useClientAssignments } from '@/hooks/useClientAssignments';

interface ClientAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
}

export function ClientAssignmentDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
}: ClientAssignmentDialogProps) {
  const { clients, loading: loadingClients } = useClients();
  const { fetchAssignmentsForEmployee, updateAssignments, loading: saving } = useClientAssignments();
  
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (open && employeeId) {
      setInitialLoading(true);
      fetchAssignmentsForEmployee(employeeId).then((ids) => {
        setSelectedClientIds(ids);
        setInitialLoading(false);
      });
    }
  }, [open, employeeId, fetchAssignmentsForEmployee]);

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone?.includes(searchTerm)
  );

  const toggleClient = (clientId: string) => {
    setSelectedClientIds(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const selectAll = () => {
    setSelectedClientIds(filteredClients.map(c => c.id));
  };

  const deselectAll = () => {
    setSelectedClientIds([]);
  };

  const handleSave = async () => {
    const success = await updateAssignments(employeeId, selectedClientIds);
    if (success) {
      onOpenChange(false);
    }
  };

  const isLoading = loadingClients || initialLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Atribuir Clientes
          </DialogTitle>
          <DialogDescription>
            Selecione quais clientes o funcionário <strong>{employeeName}</strong> poderá visualizar.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Selecionar todos
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Limpar seleção
              </Button>
            </div>

            {/* Client list */}
            <ScrollArea className="h-[300px] border rounded-lg p-2">
              {filteredClients.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum cliente encontrado
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredClients.map(client => (
                    <div
                      key={client.id}
                      className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                      onClick={() => toggleClient(client.id)}
                    >
                      <Checkbox
                        checked={selectedClientIds.includes(client.id)}
                        onCheckedChange={() => toggleClient(client.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{client.full_name}</p>
                        {client.phone && (
                          <p className="text-xs text-muted-foreground">{client.phone}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <p className="text-xs text-muted-foreground text-center">
              {selectedClientIds.length} de {clients.length} clientes selecionados
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || isLoading}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Atribuições
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
