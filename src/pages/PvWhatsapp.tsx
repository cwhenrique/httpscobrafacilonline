import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Calculator,
  Bell,
  Calendar,
  Users,
  TrendingUp,
  Shield,
  Smartphone,
  Clock,
  FileText,
  CheckCircle2,
  ArrowRight,
  Star,
  Zap,
  BarChart3,
  MessageCircle,
  Percent,
  Check,
  Sparkles,
  Send,
  QrCode,
  CircleDollarSign,
  Receipt,
  AlertCircle,
  XCircle,
  Phone,
  Gift,
} from "lucide-react";
import { motion } from "framer-motion";
import heroPerson from "@/assets/hero-person.png";
import cobraFacilLogo from "@/assets/cobrafacil-logo.png";
import dashboardOverview from "@/assets/dashboard-overview.png";
import whatsappAlert01 from "@/assets/whatsapp-alert-01.png";
import whatsappAlert02 from "@/assets/whatsapp-alert-02.png";
import whatsappAlert03 from "@/assets/whatsapp-alert-03.png";
import scoreDeClientes from "@/assets/score-de-clientes.png";
import calendarPage from "@/assets/calendar-page.png";
import simulatorPage from "@/assets/simulator-page.png";
import simuladorEmprestimos from "@/assets/simulador-emprestimos.png";
import emprestimosMensais from "@/assets/emprestimos-mensais.png";
import emprestimosDiarios from "@/assets/emprestimos-diarios.png";
import calendarioCobrancas from "@/assets/calendario-cobrancas.png";
import scoreClientes from "@/assets/score-clientes.png";
import relatoriosEmprestimos from "@/assets/relatorios-emprestimos.png";
import vendasProdutos from "@/assets/vendas-produtos.png";
import vendasVeiculos from "@/assets/vendas-veiculos.png";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
};

const WHATSAPP_LINK = "https://wa.me/5511932935877?text=Ol%C3%A1%20gostaria%20de%20saber%20mais%20sobre%20o%20sistema%20CobraF%C3%A1cil%20LP";

const PvWhatsapp = () => {
  const [showBottomBar, setShowBottomBar] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBottomBar(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const painPoints = [
    { icon: XCircle, text: "Esquece de cobrar e perde dinheiro" },
    { icon: XCircle, text: "Não sabe quanto tem pra receber" },
    { icon: XCircle, text: "Calcula juros errado na mão" },
    { icon: XCircle, text: "Anota em caderno e perde informação" },
    { icon: XCircle, text: "Cliente atrasa e você nem lembra" },
  ];

  const benefits = [
    { icon: CheckCircle2, text: "Receba alertas e nunca esqueça de cobrar" },
    { icon: CheckCircle2, text: "Saiba exatamente quanto tem a receber" },
    { icon: CheckCircle2, text: "Cálculo automático de juros sem erros" },
    { icon: CheckCircle2, text: "Tudo organizado digitalmente, sem perder informação" },
    { icon: CheckCircle2, text: "Notificações automáticas quando cliente atrasa" },
  ];

  const newFeatures = [
    {
      icon: Send,
      title: "Cobranças Direto pro Cliente",
      description: "Envie cobranças e lembretes diretamente para o WhatsApp dos seus clientes com 1 clique",
      badge: "🆕 EXCLUSIVO",
    },
    {
      icon: QrCode,
      title: "Conexão via QR Code",
      description: "Conecte seu WhatsApp em segundos escaneando um QR Code. Simples assim!",
      badge: "🆕 NOVO",
    },
    {
      icon: Receipt,
      title: "Comprovantes Automáticos",
      description: "Ao registrar pagamento, envie comprovante pro seu WhatsApp e do cliente automaticamente",
      badge: "🆕 NOVO",
    },
    {
      icon: Bell,
      title: "Alertas Automáticos 3x/dia",
      description: "Receba resumos às 7h, relatório completo às 8h e lembrete às 12h no seu WhatsApp",
      badge: "🆕 NOVO",
    },
    {
      icon: Zap,
      title: "Cobrar Parcela do Dia",
      description: "Na tela de empréstimos, cobre a parcela do dia com apenas 1 clique no botão",
      badge: "🆕 NOVO",
    },
    {
      icon: FileText,
      title: "Recibos de Contratos",
      description: "Ao criar empréstimo, receba recibo completo no WhatsApp com todos os dados",
      badge: "🆕 NOVO",
    },
  ];

  const mainFeatures = [
    {
      icon: BarChart3,
      title: "Dashboard Inteligente",
      description: "Veja tudo que tem a receber em tempo real",
    },
    {
      icon: Calculator,
      title: "Cálculo Automático de Juros",
      description: "Juros simples ou por parcela, o sistema calcula tudo",
    },
    {
      icon: MessageCircle,
      title: "WhatsApp Integrado PRO",
      description: "Receba alertas E envie cobranças para clientes",
    },
    {
      icon: Calendar,
      title: "Calendário de Cobranças",
      description: "Visualize todos os vencimentos de forma organizada",
    },
    {
      icon: Users,
      title: "Score de Clientes",
      description: "Saiba quem paga em dia e quem atrasa",
    },
    {
      icon: CircleDollarSign,
      title: "Simulador de Empréstimos",
      description: "Calcule parcelas e juros antes de emprestar",
    },
  ];

  const steps = [
    {
      number: "1",
      title: "Fale Conosco",
      description: "Clique no botão e fale com nossa equipe no WhatsApp",
      emoji: "💬",
    },
    {
      number: "2",
      title: "Receba o Acesso",
      description: "Em minutos você terá acesso completo ao sistema",
      emoji: "🔑",
    },
    {
      number: "3",
      title: "Cadastre Tudo",
      description: "Adicione seus clientes e empréstimos facilmente",
      emoji: "📝",
    },
    {
      number: "4",
      title: "Nunca Mais Esqueça",
      description: "Receba alertas e cobre pelo WhatsApp automaticamente",
      emoji: "🚀",
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header Minimalista */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <img src={cobraFacilLogo} alt="CobraFácil" className="h-8 sm:h-10" />
          <Button 
            size="sm"
            className="bg-green-500 hover:bg-green-600 text-white font-bold shadow-lg shadow-green-500/30"
            onClick={() => window.open(WHATSAPP_LINK, '_blank')}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Falar no WhatsApp
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-4 relative min-h-[85vh] flex items-center">
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src={heroPerson} 
            alt="" 
            className="absolute right-0 top-0 h-full w-auto object-cover opacity-10 max-w-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
          <div className="absolute inset-0 grid-pattern opacity-50" />
        </div>
        
        <div className="container mx-auto text-center relative">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-6">
              <span className="animate-pulse">🔥</span>
              <span>CHEGA DE PERDER DINHEIRO!</span>
            </div>
          </motion.div>
          
          <motion.h1 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-foreground"
          >
            Você Empresta Dinheiro a Juros?
            <br />
            <span className="gradient-text-animated">
              Nunca Mais Perca uma Cobrança!
            </span>
          </motion.h1>

          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6 px-2"
          >
            {["📊 Controle Total", "💸 Cobranças Automáticas", "📅 Calendário de Pagamentos", "📈 Relatórios"].map((item, i) => (
              <div key={i} className="badge-premium rounded-full px-4 py-2 text-primary font-semibold text-xs sm:text-sm">
                {item}
              </div>
            ))}
          </motion.div>
          
          <motion.p 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto"
          >
              Sistema completo para quem empresta dinheiro. 
              <strong className="text-foreground"> Calcule juros automaticamente, receba alertas no WhatsApp</strong> e 
              <strong className="text-primary"> cobre seus clientes direto pelo WhatsApp!</strong>
              <span className="block mt-2">Use no seu celular e computador simultaneamente.</span>
          </motion.p>
          
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col items-center gap-4"
          >
            <Button 
              size="lg" 
              className="text-base sm:text-lg px-6 sm:px-10 h-14 sm:h-16 shadow-glow font-bold bg-green-500 hover:bg-green-600 transition-all duration-300 animate-bounce-subtle"
              onClick={() => window.open(WHATSAPP_LINK, '_blank')}
            >
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
              <span className="hidden sm:inline">QUERO FALAR COM UM ESPECIALISTA</span>
              <span className="sm:hidden">FALAR COM ESPECIALISTA</span>
            </Button>
            <p className="text-sm text-muted-foreground">
              ⚡ Resposta imediata • 💬 Tire todas suas dúvidas
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            transition={{ delay: 0.5 }}
            className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto"
          >
            {[
              { icon: Smartphone, text: "App disponível para iOS e Android" },
              { icon: MessageCircle, text: "Envie cobranças diretamente pros seus clientes" },
              { icon: Phone, text: "Suporte humanizado das 8 às 22h (nada de IA!)" },
              { icon: Sparkles, text: "Fácil usabilidade" },
            ].map((benefit, index) => (
              <motion.div 
                key={index} 
                variants={scaleIn}
                className="stat-card text-center p-4 rounded-xl flex flex-col items-center gap-2"
              >
                <benefit.icon className="w-6 h-6 text-primary" />
                <div className="text-xs sm:text-sm font-medium text-foreground leading-tight">
                  {benefit.text}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Solução - Dashboard Preview */}
      <section className="pt-6 pb-16 px-4 relative">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="container mx-auto relative">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-4">
              <Sparkles className="w-4 h-4" />
              <span>A Solução</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4 text-foreground">
              Conheça o <span className="gradient-text">CobraFácil</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              O sistema mais completo para quem empresta dinheiro a juros
            </p>
          </motion.div>

          {(() => {
            const carouselSlides = [
              {
                image: simuladorEmprestimos,
                title: "Simulador de Empréstimo",
                description: "Calcule parcelas, juros e total a receber antes de emprestar. Visualize o cronograma completo!",
              },
              {
                image: emprestimosMensais,
                title: "Empréstimos Mensais/Semanais",
                description: "Veja todos seus empréstimos em cards organizados com lucro previsto, valor pago e parcelas em atraso",
              },
              {
                image: emprestimosDiarios,
                title: "Empréstimos Diários",
                description: "Controle empréstimos com cobrança diária. Botão de cobrança direto no WhatsApp do cliente!",
              },
              {
                image: calendarioCobrancas,
                title: "Calendário de Cobranças",
                description: "Visualize todos os vencimentos do mês de forma organizada. Nunca mais esqueça uma cobrança!",
              },
              {
                image: scoreClientes,
                title: "Score de Clientes",
                description: "Ranking automático de confiabilidade. Saiba quem paga em dia e quem sempre atrasa!",
              },
              {
                image: relatoriosEmprestimos,
                title: "Relatório Operacional",
                description: "Acompanhe capital na rua, juros a receber, total recebido e evolução mensal em tempo real",
              },
              {
                image: vendasProdutos,
                title: "Vendas de Produtos",
                description: "Gerencie vendas parceladas de produtos com controle de lucro e parcelas pendentes",
              },
              {
                image: vendasVeiculos,
                title: "Vendas de Veículos",
                description: "Controle vendas de veículos parcelados com acompanhamento de pagamentos e lucro",
              },
            ];

            return (
              <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                className="max-w-5xl mx-auto mb-10"
              >
                <Carousel className="w-full" opts={{ loop: true }}>
                  <CarouselContent>
                    {carouselSlides.map((slide, index) => (
                      <CarouselItem key={index}>
                        <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 border border-border/50">
                          <img 
                            src={slide.image} 
                            alt={slide.title} 
                            className="w-full"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-left">
                            <div className="badge-premium rounded-full px-3 sm:px-4 py-1.5 sm:py-2 inline-flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                              <span className="font-bold text-primary text-sm sm:text-base">{slide.title}</span>
                            </div>
                            <p className="text-foreground/90 text-xs sm:text-base max-w-xl line-clamp-2 sm:line-clamp-none">
                              {slide.description}
                            </p>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-1 sm:left-2 md:-left-12 bg-background/90 backdrop-blur border-border hover:bg-primary hover:text-primary-foreground w-8 h-8 sm:w-10 sm:h-10" />
                  <CarouselNext className="right-1 sm:right-2 md:-right-12 bg-background/90 backdrop-blur border-border hover:bg-primary hover:text-primary-foreground w-8 h-8 sm:w-10 sm:h-10" />
                </Carousel>
                <div className="flex justify-center gap-2 mt-4">
                  <p className="text-sm text-muted-foreground">
                    ← Deslize para ver todas as funcionalidades →
                  </p>
                </div>
              </motion.div>
            );
          })()}

          {/* Seção de Planos/Benefícios - Estilo Nectar */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12 mt-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Escolha o <span className="gradient-text">Plano Ideal</span> para Você
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              ✨ Tudo que você precisa incluído em cada plano
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto"
          >
            {/* Card Mensal - Estilo Nectar */}
            <motion.div
              variants={fadeInUp}
              className="bg-card/80 backdrop-blur-sm p-6 rounded-2xl border border-border/50 relative"
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Mensal</h3>
                <p className="text-muted-foreground text-sm mt-1">Renovação mensal</p>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  "Clientes ilimitados",
                  "Empréstimos ilimitados",
                  "Cálculo automático de juros",
                  "Calendário de cobranças",
                  "Score de clientes",
                  "Suporte via WhatsApp"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
                {/* Bônus */}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-purple-500/40 bg-gradient-to-r from-purple-500/20 to-blue-500/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <span className="text-sm text-foreground font-medium">Alertas via WhatsApp</span>
                  </div>
                  <span className="text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full font-semibold">BÔNUS</span>
                </div>
              </div>
              <Button 
                className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 font-semibold"
                onClick={() => window.open(WHATSAPP_LINK, '_blank')}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Falar com Especialista
              </Button>
            </motion.div>

            {/* Card Vitalício - Destaque Estilo Nectar */}
            <motion.div
              variants={scaleIn}
              className="bg-card/80 backdrop-blur-sm p-6 rounded-2xl border-2 border-green-500 relative transform md:-translate-y-4 shadow-lg shadow-green-500/20"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                  ⭐ Mais Vendido
                </span>
              </div>
              <div className="text-center mb-6 pt-2">
                <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Vitalício</h3>
                <p className="text-green-400 text-sm mt-1 font-semibold">Pague uma vez, use para sempre</p>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  "Acesso vitalício garantido",
                  "Todas as funcionalidades",
                  "Atualizações gratuitas vitalícias",
                  "Sem mensalidades nunca mais",
                  "Clientes e empréstimos ilimitados",
                  "Suporte via WhatsApp"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
                {/* Bônus */}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-purple-500/40 bg-gradient-to-r from-purple-500/20 to-blue-500/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Gift className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <span className="text-sm text-foreground font-medium">Novas funcionalidades</span>
                  </div>
                  <span className="text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full font-semibold">BÔNUS</span>
                </div>
              </div>
              <Button 
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold"
                onClick={() => window.open(WHATSAPP_LINK, '_blank')}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Quero Acesso Vitalício
              </Button>
            </motion.div>

            {/* Card Anual - Estilo Nectar */}
            <motion.div
              variants={fadeInUp}
              className="bg-card/80 backdrop-blur-sm p-6 rounded-2xl border border-border/50 relative"
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-7 h-7 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Anual</h3>
                <p className="text-muted-foreground text-sm mt-1">Acesso por 12 meses</p>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  "Acesso por 12 meses",
                  "Todas as funcionalidades",
                  "Atualizações durante o período",
                  "Clientes ilimitados",
                  "Empréstimos ilimitados",
                  "Suporte via WhatsApp"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
                {/* Bônus */}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-purple-500/40 bg-gradient-to-r from-purple-500/20 to-blue-500/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <span className="text-sm text-foreground font-medium">Economia garantida</span>
                  </div>
                  <span className="text-xs bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full font-semibold">BÔNUS</span>
                </div>
              </div>
              <Button 
                className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 font-semibold"
                onClick={() => window.open(WHATSAPP_LINK, '_blank')}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Falar com Especialista
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Comparação Caderno vs CobraFácil */}
      <section className="py-16 px-4 bg-muted/30 relative">
        <div className="container mx-auto max-w-5xl">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-4xl font-bold mb-4 text-foreground">
              <span className="text-destructive">Caderno</span> vs <span className="gradient-text">CobraFácil</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Veja a diferença entre continuar anotando no papel ou usar o sistema:
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 gap-6"
          >
            {/* Coluna Caderno - Problemas */}
            <motion.div 
              variants={fadeInUp}
              className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6"
            >
              <h3 className="flex items-center gap-2 text-xl font-bold text-destructive mb-6">
                📓 Com Caderno
              </h3>
              <div className="space-y-3">
                {painPoints.map((pain, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 bg-background/60 backdrop-blur p-3 rounded-xl"
                  >
                    <pain.icon className="w-5 h-5 text-destructive flex-shrink-0" />
                    <span className="text-foreground/80 text-sm">{pain.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Coluna CobraFácil - Benefícios */}
            <motion.div 
              variants={fadeInUp}
              className="bg-primary/5 border border-primary/20 rounded-2xl p-6"
            >
              <h3 className="flex items-center gap-2 text-xl font-bold text-primary mb-6">
                📱 Com CobraFácil
              </h3>
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 bg-background/60 backdrop-blur p-3 rounded-xl"
                  >
                    <benefit.icon className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-foreground text-sm font-medium">{benefit.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ delay: 0.3 }}
            className="text-center mt-10"
          >
            <p className="text-xl font-bold text-foreground mb-4">
              🚀 Faça a escolha certa!
            </p>
            <Button 
              size="lg"
              className="bg-green-500 hover:bg-green-600 font-bold"
              onClick={() => window.open(WHATSAPP_LINK, '_blank')}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Quero o CobraFácil
            </Button>
          </motion.div>
        </div>
      </section>


      {/* Funcionalidades Novas - Destaque */}
      <section className="py-16 px-4 bg-primary/5 relative">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-4">
              <Zap className="w-4 h-4" />
              <span>🆕 FUNCIONALIDADES EXCLUSIVAS</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              O que <span className="gradient-text">Ninguém Mais Oferece</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Recursos únicos que você só encontra no CobraFácil
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
          >
            {newFeatures.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="card-premium p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform"
              >
                <div className="absolute top-4 right-4">
                  <span className="text-xs font-bold bg-primary/20 text-primary px-3 py-1 rounded-full">
                    {feature.badge}
                  </span>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold text-lg text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ delay: 0.3 }}
            className="text-center mt-10"
          >
            <Button 
              size="lg"
              className="bg-green-500 hover:bg-green-600 font-bold text-lg px-10"
              onClick={() => window.open(WHATSAPP_LINK, '_blank')}
            >
              <MessageCircle className="w-6 h-6 mr-3" />
              Quero Essas Funcionalidades
            </Button>
          </motion.div>
        </div>
      </section>

      {/* WhatsApp Screenshots */}
      <section className="py-16 px-4 relative">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Alertas <span className="gradient-text">Direto no WhatsApp</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Veja como você vai receber as notificações no seu celular
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="flex flex-wrap justify-center gap-6"
          >
            {[
              { img: whatsappAlert01, label: "Resumo às 7h" },
              { img: whatsappAlert02, label: "Cobranças às 8h" },
              { img: whatsappAlert03, label: "Lembrete às 12h" },
            ].map((item, index) => (
              <motion.div
                key={index}
                variants={scaleIn}
                className="relative"
              >
                <img 
                  src={item.img} 
                  alt={item.label} 
                  className="w-64 rounded-2xl shadow-xl shadow-black/20 border border-border/50"
                />
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 badge-premium rounded-full px-4 py-2 text-xs font-bold text-primary whitespace-nowrap">
                  {item.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Todas as Funcionalidades */}
      <section className="py-16 px-4 bg-muted/30 relative">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="container mx-auto relative">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Tudo em <span className="gradient-text">Um Só Lugar</span>
            </h2>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto"
          >
            {mainFeatures.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="stat-card p-5 rounded-xl text-center hover:scale-105 transition-transform"
              >
                <feature.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-bold text-sm text-foreground mb-1">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Garantia */}
      <section className="py-16 px-4 relative">
        <div className="container mx-auto max-w-3xl">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={scaleIn}
            className="card-premium p-8 sm:p-12 rounded-3xl text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
            <div className="relative">
              <div className="w-20 h-20 mx-auto bg-primary/20 rounded-full flex items-center justify-center mb-6">
                <Shield className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Garantia de <span className="gradient-text">7 Dias</span>
              </h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Compre o CobraFácil e utilize por 7 dias. Se não ficar satisfeito, devolvemos 100% do seu dinheiro. 
                Sem perguntas, sem burocracia.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Reembolso Total</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Sem Perguntas</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Risco Zero</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="py-16 px-4 bg-muted/30 relative">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Como <span className="gradient-text">Começar?</span>
            </h2>
            <p className="text-muted-foreground">
              4 passos simples para organizar suas cobranças
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto"
          >
            {steps.map((step, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="text-center"
              >
                <div className="w-16 h-16 mx-auto stat-card rounded-2xl flex items-center justify-center mb-4 text-3xl">
                  {step.emoji}
                </div>
                <div className="text-sm font-bold text-primary mb-1">Passo {step.number}</div>
                <h3 className="font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-primary/5" />
        <div className="container mx-auto max-w-3xl relative">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 badge-premium badge-glow rounded-full px-5 py-2.5 text-sm font-bold text-primary mb-6">
              <Zap className="w-4 h-4" />
              <span>ÚLTIMA CHANCE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Não Perca Mais <span className="gradient-text">Dinheiro!</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Fale agora com nossa equipe e descubra como o CobraFácil pode transformar 
              a forma como você gerencia seus empréstimos
            </p>
            
            <Button 
              size="lg"
              className="text-xl px-12 h-18 py-6 bg-green-500 hover:bg-green-600 font-bold shadow-2xl shadow-green-500/30 animate-bounce-subtle"
              onClick={() => window.open(WHATSAPP_LINK, '_blank')}
            >
              <MessageCircle className="w-7 h-7 mr-3" />
              FALAR COM ESPECIALISTA AGORA
            </Button>

            <p className="text-sm text-muted-foreground mt-4">
              ⚡ Atendimento imediato • 🔒 Sem compromisso • ✅ Tire todas as dúvidas
            </p>

            <div className="flex flex-wrap justify-center gap-6 mt-10">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-sm text-foreground">Garantia 7 dias</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <span className="text-sm text-foreground">Acesso vitalício</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="text-sm text-foreground">Suporte humanizado incluso</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer Simples */}
      <footer className="py-8 px-4 border-t border-border/50 bg-background/80">
        <div className="container mx-auto text-center">
          <img src={cobraFacilLogo} alt="CobraFácil" className="h-8 mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} CobraFácil. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* Barra Fixa WhatsApp */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: showBottomBar ? 0 : 100 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-lg border-t border-border/50"
      >
        <div className="container mx-auto flex items-center justify-between gap-4">
          <div className="hidden sm:block">
            <p className="font-bold text-foreground text-sm">Pronto para organizar suas cobranças?</p>
            <p className="text-xs text-muted-foreground">Fale com nossa equipe agora</p>
          </div>
          <Button 
            size="lg"
            className="flex-1 sm:flex-none bg-green-500 hover:bg-green-600 font-bold shadow-lg shadow-green-500/30"
            onClick={() => window.open(WHATSAPP_LINK, '_blank')}
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Falar no WhatsApp
          </Button>
        </div>
      </motion.div>

      {/* Espaço para barra fixa */}
      <div className="h-20" />
    </div>
  );
};

export default PvWhatsapp;
