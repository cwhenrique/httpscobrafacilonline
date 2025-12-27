-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create tutorial_videos table
CREATE TABLE public.tutorial_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'Início',
    youtube_video_id TEXT,
    duration TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on tutorial_videos
ALTER TABLE public.tutorial_videos ENABLE ROW LEVEL SECURITY;

-- Everyone can read tutorials
CREATE POLICY "Anyone can view tutorials" ON public.tutorial_videos
FOR SELECT USING (true);

-- Only admins can insert/update/delete tutorials
CREATE POLICY "Admins can manage tutorials" ON public.tutorial_videos
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_tutorial_videos_updated_at
BEFORE UPDATE ON public.tutorial_videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the 18 initial tutorials
INSERT INTO public.tutorial_videos (order_number, title, description, category) VALUES
(1, 'Meu Perfil', 'Aprenda a configurar seu perfil e dados da empresa', 'Início'),
(2, 'Meus Clientes', 'Como cadastrar e gerenciar seus clientes', 'Clientes'),
(3, 'Score de Clientes', 'Entenda como funciona o score de pagamento', 'Clientes'),
(4, 'Como Criar um Empréstimo Padrão', 'Criando empréstimos parcelados mensais', 'Empréstimos'),
(5, 'Como Criar um Empréstimo Diário', 'Criando empréstimos com parcelas diárias', 'Empréstimos'),
(6, 'Como Criar Tabela Price', 'Sistema de amortização francesa', 'Empréstimos'),
(7, 'Como Pagar um Empréstimo', 'Registrando pagamentos de parcelas', 'Pagamentos'),
(8, 'Como Pagar Somente o Juros', 'Pagamento parcial apenas dos juros', 'Pagamentos'),
(9, 'Como Aplicar Multa', 'Aplicando multas em parcelas atrasadas', 'Cobranças'),
(10, 'Como Enviar Cobrança', 'Enviando notificações de cobrança via WhatsApp', 'Cobranças'),
(11, 'Como Pagar Empréstimo Diário', 'Registrando pagamentos diários', 'Pagamentos'),
(12, 'Como Aplicar Multa na Diária', 'Multas em empréstimos diários', 'Cobranças'),
(13, 'Como Renegociar um Contrato', 'Renegociando empréstimos atrasados', 'Empréstimos'),
(14, 'Como Criar um Contrato Antigo', 'Cadastrando empréstimos já em andamento', 'Empréstimos'),
(15, 'Relatórios e Calendário', 'Visualizando relatórios e calendário', 'Relatórios'),
(16, 'Como Vender Produto e Veículos', 'Gerenciando vendas de produtos', 'Vendas'),
(17, 'Como Simular Empréstimo', 'Usando o simulador de empréstimos', 'Empréstimos'),
(18, 'Minhas Contas a Pagar', 'Gerenciando suas contas a pagar', 'Contas');