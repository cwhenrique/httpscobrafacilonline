import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useClients } from '@/hooks/useClients';
import { Client, ClientType } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getClientTypeLabel, formatDate } from '@/lib/calculations';
import { Plus, Search, Pencil, Trash2, Users, FileText, MapPin, Loader2, Camera } from 'lucide-react';
import { ClientScoreBadge } from '@/components/ClientScoreBadge';
import { ClientDocuments } from '@/components/ClientDocuments';
import { toast } from 'sonner';

interface AddressData {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface FormData {
  full_name: string;
  phone: string;
  notes: string;
  client_type: ClientType;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export default function Clients() {
  const { clients, loading, createClient, updateClient, deleteClient, uploadAvatar } = useClients();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dados');
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [createdClientName, setCreatedClientName] = useState<string>('');
  const [searchingCep, setSearchingCep] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    phone: '',
    notes: '',
    client_type: 'loan' as ClientType,
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(search.toLowerCase()) ||
    client.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 8);
    if (numbers.length > 5) {
      return `${numbers.slice(0, 5)}-${numbers.slice(5)}`;
    }
    return numbers;
  };

  const searchCep = async () => {
    const cleanCep = formData.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast.error('CEP deve ter 8 dígitos');
      return;
    }

    setSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: AddressData = await response.json();

      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      setFormData(prev => ({
        ...prev,
        street: data.logradouro || '',
        neighborhood: data.bairro || '',
        city: data.localidade || '',
        state: data.uf || '',
      }));
      toast.success('Endereço encontrado!');
    } catch (error) {
      console.error('Error fetching CEP:', error);
      toast.error('Erro ao buscar CEP');
    } finally {
      setSearchingCep(false);
    }
  };

  const buildFullAddress = () => {
    const parts = [
      formData.street,
      formData.number && `nº ${formData.number}`,
      formData.complement,
      formData.neighborhood,
      formData.city && formData.state && `${formData.city}/${formData.state}`,
      formData.cep && `CEP: ${formData.cep}`,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const fullAddress = buildFullAddress();
    
    if (editingClient) {
      await updateClient(editingClient.id, {
        ...formData,
        address: fullAddress,
      });
      if (avatarFile) {
        await uploadAvatar(editingClient.id, avatarFile);
      }
      setIsDialogOpen(false);
      resetForm();
    } else {
      const result = await createClient({
        ...formData,
        address: fullAddress,
      });
      
      if (result.data) {
        // Upload avatar if selected
        if (avatarFile) {
          await uploadAvatar(result.data.id, avatarFile);
        }
        // Store created client info for documents tab
        setCreatedClientId(result.data.id);
        setCreatedClientName(result.data.full_name);
        setActiveTab('documentos');
      }
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      full_name: client.full_name,
      phone: client.phone || '',
      notes: client.notes || '',
      client_type: client.client_type,
      cep: client.cep || '',
      street: client.street || '',
      number: client.number || '',
      complement: client.complement || '',
      neighborhood: client.neighborhood || '',
      city: client.city || '',
      state: client.state || '',
    });
    setAvatarPreview(client.avatar_url || null);
    setActiveTab('dados');
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteClient(deleteId);
      setDeleteId(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setIsDialogOpen(open);
  };

  const resetForm = () => {
    setEditingClient(null);
    setCreatedClientId(null);
    setCreatedClientName('');
    setActiveTab('dados');
    setAvatarFile(null);
    setAvatarPreview(null);
    setFormData({
      full_name: '',
      phone: '',
      notes: '',
      client_type: 'loan',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
    });
  };

  const getClientTypeBadgeColor = (type: ClientType) => {
    switch (type) {
      case 'loan':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'monthly':
        return 'bg-chart-5/10 text-chart-5 border-chart-5/20';
      case 'both':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const initials = formData.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CL';

  const currentClientForDocs = editingClient || (createdClientId ? { id: createdClientId, full_name: createdClientName } : null);
  const isNewClientWithDocs = !editingClient && createdClientId;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold">Clientes</h1>
            <p className="text-muted-foreground">Gerencie seus clientes</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? 'Editar Cliente' : (createdClientId ? 'Cliente Criado - Adicionar Documentos' : 'Novo Cliente')}
                </DialogTitle>
              </DialogHeader>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="dados" disabled={!!isNewClientWithDocs}>Dados</TabsTrigger>
                  <TabsTrigger value="documentos" className="gap-2" disabled={!editingClient && !createdClientId}>
                    <FileText className="w-4 h-4" />
                    Documentos
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="dados" className="mt-4">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center gap-3 pb-4">
                      <div className="relative">
                        <Avatar className="w-24 h-24 border-2 border-primary/20">
                          <AvatarImage src={avatarPreview || editingClient?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarSelect}
                          className="hidden"
                        />
                        <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                          <span>
                            <Camera className="w-4 h-4" />
                            {avatarPreview || editingClient?.avatar_url ? 'Trocar foto' : 'Adicionar foto'}
                          </span>
                        </Button>
                      </label>
                    </div>

                    <Separator />

                    {/* Basic Info */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Nome Completo *</Label>
                        <Input
                          id="full_name"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefone</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client_type">Tipo de Cliente *</Label>
                          <Select
                            value={formData.client_type}
                            onValueChange={(value: ClientType) => setFormData({ ...formData, client_type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="loan">Empréstimo</SelectItem>
                              <SelectItem value="monthly">Mensalidade</SelectItem>
                              <SelectItem value="both">Ambos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Address Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        ENDEREÇO
                      </div>
                      
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-2">
                          <Label htmlFor="cep">CEP</Label>
                          <Input
                            id="cep"
                            value={formData.cep}
                            onChange={(e) => setFormData({ ...formData, cep: formatCep(e.target.value) })}
                            placeholder="00000-000"
                            maxLength={9}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={searchCep}
                            disabled={searchingCep || formData.cep.replace(/\D/g, '').length !== 8}
                            className="gap-2"
                          >
                            {searchingCep ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Search className="w-4 h-4" />
                            )}
                            Buscar
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="street">Rua / Logradouro</Label>
                        <Input
                          id="street"
                          value={formData.street}
                          onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                          placeholder="Preenchido automaticamente pelo CEP"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="number">Número</Label>
                          <Input
                            id="number"
                            value={formData.number}
                            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                            placeholder="123"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="complement">Complemento</Label>
                          <Input
                            id="complement"
                            value={formData.complement}
                            onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                            placeholder="Apto 101"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="neighborhood">Bairro</Label>
                        <Input
                          id="neighborhood"
                          value={formData.neighborhood}
                          onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                          placeholder="Preenchido automaticamente pelo CEP"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">Cidade</Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            placeholder="Preenchido automaticamente"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">Estado (UF)</Label>
                          <Input
                            id="state"
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })}
                            placeholder="UF"
                            maxLength={2}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label htmlFor="notes">Observações</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {editingClient ? 'Salvar' : 'Criar e Continuar'}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
                
                <TabsContent value="documentos" className="mt-4">
                  {currentClientForDocs ? (
                    <div className="space-y-4">
                      <ClientDocuments 
                        clientId={currentClientForDocs.id} 
                        clientName={currentClientForDocs.full_name} 
                      />
                      <div className="flex justify-end">
                        <Button onClick={() => setIsDialogOpen(false)}>
                          Concluir
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Salve o cliente primeiro para adicionar documentos</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar clientes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Badge variant="secondary" className="gap-1 w-fit">
                <Users className="w-3 h-3" />
                {filteredClients.length} clientes
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Cadastrado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => {
                      const clientInitials = client.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';
                      return (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={client.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {clientInitials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{client.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{client.phone || '-'}</TableCell>
                          <TableCell>
                            <Badge className={getClientTypeBadgeColor(client.client_type)}>
                              {getClientTypeLabel(client.client_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <ClientScoreBadge 
                              score={client.score || 100}
                              totalLoans={client.total_loans || 0}
                              totalPaid={client.total_paid || 0}
                              onTimePayments={client.on_time_payments || 0}
                              latePayments={client.late_payments || 0}
                            />
                          </TableCell>
                          <TableCell>{formatDate(client.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(client)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(client.id)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
                Todos os empréstimos e mensalidades associados também serão excluídos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
