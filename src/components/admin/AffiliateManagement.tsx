import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Pencil, Trash2, Link as LinkIcon, Users, Copy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Affiliate {
  id: string;
  email: string;
  name: string;
  link_mensal: string;
  link_trimestral: string;
  link_anual: string;
  is_active: boolean;
  created_at: string;
}

interface AffiliateFormData {
  email: string;
  name: string;
  link_mensal: string;
  link_trimestral: string;
  link_anual: string;
}

const emptyForm: AffiliateFormData = {
  email: '',
  name: '',
  link_mensal: '',
  link_trimestral: '',
  link_anual: '',
};

export function AffiliateManagement() {
  const { toast } = useToast();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [formData, setFormData] = useState<AffiliateFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchAffiliates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAffiliates(data || []);
    } catch (error) {
      console.error('Error fetching affiliates:', error);
      toast({
        title: 'Erro ao carregar afiliados',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAffiliates();
  }, []);

  const handleOpenCreate = () => {
    setEditingAffiliate(null);
    setFormData(emptyForm);
    setShowDialog(true);
  };

  const handleOpenEdit = (affiliate: Affiliate) => {
    setEditingAffiliate(affiliate);
    setFormData({
      email: affiliate.email,
      name: affiliate.name,
      link_mensal: affiliate.link_mensal,
      link_trimestral: affiliate.link_trimestral,
      link_anual: affiliate.link_anual,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.email || !formData.name || !formData.link_mensal || !formData.link_trimestral || !formData.link_anual) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Debug: verificar sessão atual
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('[AffiliateManagement] Current session:', sessionData?.session?.user?.id, sessionData?.session?.user?.email);
      
      if (!sessionData?.session?.user) {
        toast({
          title: 'Sessão expirada',
          description: 'Faça login novamente para continuar',
          variant: 'destructive',
        });
        return;
      }

      // Debug: verificar se é admin
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', sessionData.session.user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      console.log('[AffiliateManagement] Role check:', { roleData, roleError, userId: sessionData.session.user.id });
      
      if (!roleData) {
        toast({
          title: 'Sem permissão',
          description: 'Você precisa ser administrador para gerenciar afiliados',
          variant: 'destructive',
        });
        return;
      }

      if (editingAffiliate) {
        // Update
        const { error } = await supabase
          .from('affiliates')
          .update({
            email: formData.email,
            name: formData.name,
            link_mensal: formData.link_mensal,
            link_trimestral: formData.link_trimestral,
            link_anual: formData.link_anual,
          })
          .eq('id', editingAffiliate.id);

        if (error) {
          console.error('[AffiliateManagement] Update error:', error);
          throw error;
        }

        toast({
          title: 'Afiliado atualizado!',
          description: `${formData.name} foi atualizado com sucesso`,
        });
      } else {
        // Create
        const { error } = await supabase
          .from('affiliates')
          .insert({
            email: formData.email,
            name: formData.name,
            link_mensal: formData.link_mensal,
            link_trimestral: formData.link_trimestral,
            link_anual: formData.link_anual,
          });

        if (error) {
          console.error('[AffiliateManagement] Insert error:', error);
          throw error;
        }

        toast({
          title: 'Afiliado cadastrado!',
          description: `${formData.name} foi adicionado com sucesso`,
        });
      }

      setShowDialog(false);
      setFormData(emptyForm);
      setEditingAffiliate(null);
      fetchAffiliates();
    } catch (error: any) {
      console.error('Error saving affiliate:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (affiliate: Affiliate) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ is_active: !affiliate.is_active })
        .eq('id', affiliate.id);

      if (error) throw error;

      toast({
        title: affiliate.is_active ? 'Afiliado desativado' : 'Afiliado ativado',
        description: `${affiliate.name} foi ${affiliate.is_active ? 'desativado' : 'ativado'}`,
      });

      fetchAffiliates();
    } catch (error: any) {
      console.error('Error toggling affiliate:', error);
      toast({
        title: 'Erro ao alterar status',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Afiliado excluído!',
        description: 'O afiliado foi removido com sucesso',
      });

      setDeleteConfirm(null);
      fetchAffiliates();
    } catch (error: any) {
      console.error('Error deleting affiliate:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'Link copiado para a área de transferência',
    });
  };

  return (
    <Card className="border-primary">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-primary" />
            <CardTitle>Gestão de Afiliados</CardTitle>
          </div>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Novo Afiliado
          </Button>
        </div>
        <CardDescription>
          Cadastre os links de checkout personalizados para cada afiliado. Quando um usuário estiver vinculado a um afiliado, 
          os links de renovação/checkout serão automaticamente direcionados para os links cadastrados aqui.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : affiliates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum afiliado cadastrado</p>
            <p className="text-sm">Clique em "Novo Afiliado" para adicionar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliates.map((affiliate) => (
                  <TableRow key={affiliate.id}>
                    <TableCell className="font-medium">{affiliate.name}</TableCell>
                    <TableCell className="text-sm">{affiliate.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="bg-purple-500/20 text-purple-500 px-1.5 py-0.5 rounded">Mensal</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => copyToClipboard(affiliate.link_mensal)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="bg-cyan-500/20 text-cyan-500 px-1.5 py-0.5 rounded">Trimestral</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => copyToClipboard(affiliate.link_trimestral)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="bg-blue-500/20 text-blue-500 px-1.5 py-0.5 rounded">Anual</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => copyToClipboard(affiliate.link_anual)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(affiliate.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={affiliate.is_active}
                        onCheckedChange={() => handleToggleActive(affiliate)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handleOpenEdit(affiliate)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(affiliate.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAffiliate ? 'Editar Afiliado' : 'Novo Afiliado'}
            </DialogTitle>
            <DialogDescription>
              {editingAffiliate 
                ? 'Atualize as informações e links do afiliado'
                : 'Cadastre um novo afiliado com seus links de checkout personalizados'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aff_name">Nome do Afiliado</Label>
                <Input
                  id="aff_name"
                  placeholder="Ex: Diego Reis"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aff_email">Email do Afiliado</Label>
                <Input
                  id="aff_email"
                  type="email"
                  placeholder="email@afiliado.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="link_mensal">Link Checkout Mensal</Label>
              <Input
                id="link_mensal"
                placeholder="https://pay.cakto.com.br/..."
                value={formData.link_mensal}
                onChange={(e) => setFormData(prev => ({ ...prev, link_mensal: e.target.value }))}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link_trimestral">Link Checkout Trimestral</Label>
              <Input
                id="link_trimestral"
                placeholder="https://pay.cakto.com.br/..."
                value={formData.link_trimestral}
                onChange={(e) => setFormData(prev => ({ ...prev, link_trimestral: e.target.value }))}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="link_anual">Link Checkout Anual</Label>
              <Input
                id="link_anual"
                placeholder="https://pay.cakto.com.br/..."
                value={formData.link_anual}
                onChange={(e) => setFormData(prev => ({ ...prev, link_anual: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este afiliado? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
