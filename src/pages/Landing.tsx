import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  X,
  Check,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import VideoCarousel from "@/components/VideoCarousel";
import heroPerson from "@/assets/hero-person.png";

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

const Landing = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showBottomBar, setShowBottomBar] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBottomBar(window.scrollY > 500);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const features = [
    {
      icon: BarChart3,
      title: "Dashboard Inteligente",
      description: "Visão geral completa de tudo que você tem a receber em tempo real",
    },
    {
      icon: Calculator,
      title: "Cálculo Automático de Juros",
      description: "Juros simples ou por parcela, calculados automaticamente",
    },
    {
      icon: MessageCircle,
      title: "Alertas WhatsApp",
      description: "Receba avisos de vencimento e atraso direto no seu WhatsApp",
    },
    {
      icon: Calendar,
      title: "Calendário de Cobranças",
      description: "Visualize todas as datas de vencimento em um calendário intuitivo",
    },
  ];

  const steps = [
    {
      number: "1",
      title: "Cadastre-se Gratuitamente",
      description: "Crie sua conta em menos de 1 minuto, sem cartão de crédito",
      emoji: "🎯",
    },
    {
      number: "2",
      title: "Adicione Seus Clientes",
      description: "Cadastre clientes com foto, telefone e informações importantes",
      emoji: "👥",
    },
    {
      number: "3",
      title: "Registre Empréstimos",
      description: "Configure juros, parcelas e datas. O sistema calcula tudo automaticamente",
      emoji: "💰",
    },
    {
      number: "4",
      title: "Receba Alertas",
      description: "Seja notificado no WhatsApp sobre vencimentos e atrasos",
      emoji: "🚀",
    },
  ];

  const faqs = [
    {
      question: "Como funciona o cálculo de juros?",
      answer: "Você escolhe entre juros simples ou por parcela. O sistema calcula automaticamente com base na taxa e número de parcelas que você definir.",
    },
    {
      question: "Preciso instalar algo?",
      answer: "Não! O CobraFácil funciona 100% no navegador. Acesse de qualquer dispositivo, seja computador, tablet ou celular.",
    },
    {
      question: "Meus dados estão seguros?",
      answer: "Sim! Utilizamos criptografia de ponta e servidores seguros. Seus dados são isolados e só você tem acesso.",
    },
    {
      question: "Como recebo os alertas no WhatsApp?",
      answer: "Basta cadastrar seu número de telefone no perfil. O sistema envia automaticamente resumos diários, alertas de vencimento e avisos de atraso.",
    },
  ];

  const includedFeatures = [
    "Clientes ilimitados",
    "Empréstimos ilimitados",
    "Cálculo automático de juros",
    "Alertas WhatsApp",
    "Calendário de cobranças",
    "Score de clientes",
    "Simulador de empréstimos",
    "Contas a pagar e receber",
  ];

  const competitorProblems = [
    "Mensalidade todo mês que nunca para",
    "Preços que aumentam sem aviso",
    "Funcionalidades bloqueadas em planos caros",
    "Paga mesmo sem usar no mês",
  ];

  const cobraFacilBenefits = [
    "Pagamento único, use para sempre",
    "Todas as funcionalidades liberadas",
    "Atualizações gratuitas incluídas",
    "Sem surpresas na fatura",
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border"
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl text-foreground">CobraFácil</span>
            <span className="hidden sm:inline text-sm text-muted-foreground">sistema de gestão de empréstimos</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:flex border-primary/30 text-primary bg-primary/10">
              <Users className="w-3 h-3 mr-1" />
              <span>500+ cobradores ativos</span>
            </Badge>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="pt-24 pb-8 px-4 relative min-h-[90vh] flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src={heroPerson} 
            alt="" 
            className="absolute right-0 top-0 h-full w-auto object-cover opacity-10 max-w-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
        </div>
        
        <div className="container mx-auto text-center relative">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6 bg-red-500/10 text-red-600 border-red-500/30 px-4 py-2 text-sm font-bold">
              🔥 CHEGA DE PERDER DINHEIRO COM CALOTE!
            </Badge>
          </motion.div>
          
          <motion.h1 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-tight text-foreground"
          >
            Você Empresta, Aluga ou Presta Serviços?
            <br />
            <span className="text-primary">
              Nunca Mais Esqueça de Cobrar!
            </span>
          </motion.h1>

          {/* Target Audience Badges */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex flex-wrap justify-center gap-3 mb-8"
          >
            <Badge className="bg-primary/20 text-primary border-primary/40 px-4 py-2 font-semibold">
              💰 Empréstimos Autônomos
            </Badge>
            <Badge className="bg-primary/20 text-primary border-primary/40 px-4 py-2 font-semibold">
              🏠 Aluguel de Casas e Kitnets
            </Badge>
            <Badge className="bg-primary/20 text-primary border-primary/40 px-4 py-2 font-semibold">
              🛠️ Prestadores de Serviço
            </Badge>
          </motion.div>
          
          <motion.p 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto"
          >
            Sistema completo para quem trabalha com <strong className="text-foreground">empréstimos, aluguéis ou mensalidades</strong>. 
            Calcula juros automático, avisa no WhatsApp e controla tudo em um só lugar.
          </motion.p>
          
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link to="/auth">
              <Button size="lg" className="text-lg px-10 h-16 shadow-2xl shadow-primary/40 font-bold bg-gradient-to-r from-primary to-green-600 hover:from-green-600 hover:to-primary transition-all duration-300">
                <Zap className="w-6 h-6 mr-2" />
                QUERO ORGANIZAR MINHAS COBRANÇAS
              </Button>
            </Link>
          </motion.div>

          {/* Premium Badge */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-4"
          >
            <div className="inline-flex items-center justify-center gap-3 bg-primary/10 border-2 border-primary/30 rounded-xl px-10 h-16 text-lg font-bold">
              <CheckCircle2 className="w-6 h-6 text-primary" />
              <span className="text-primary">PAGAMENTO ÚNICO</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-foreground">Pague uma vez, use para sempre</span>
            </div>
          </motion.div>

          {/* Trust Badges */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-muted-foreground"
          >
            <span className="flex items-center gap-2 bg-card/80 px-4 py-2 rounded-full border border-border">
              <Shield className="w-4 h-4 text-primary" />
              Acesso vitalício
            </span>
            <span className="flex items-center gap-2 bg-card/80 px-4 py-2 rounded-full border border-border">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Atualizações inclusas
            </span>
            <span className="flex items-center gap-2 bg-card/80 px-4 py-2 rounded-full border border-border">
              <Zap className="w-4 h-4 text-primary" />
              Suporte prioritário
            </span>
          </motion.div>
          
          {/* Stats */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            transition={{ delay: 0.5 }}
            className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto"
          >
            {[
              { value: "1.350+", label: "Clientes Ativos", icon: "👥" },
              { value: "1x", label: "Pagamento Único", icon: "💎" },
              { value: "⭐ 4.9/5", label: "Avaliação", icon: "" },
              { value: "98.9%", label: "Satisfação", icon: "🏆" },
            ].map((stat, index) => (
              <motion.div 
                key={index} 
                variants={scaleIn}
                className="text-center p-6 rounded-2xl bg-gradient-to-br from-card to-card/50 border border-border shadow-lg hover:shadow-xl transition-shadow"
              >
                {stat.icon && <span className="text-2xl">{stat.icon}</span>}
                <div className="text-2xl sm:text-3xl font-bold text-primary mt-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-12 px-4 relative bg-muted/30">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30 px-4 py-2 font-semibold">
              <TrendingUp className="w-4 h-4 mr-2" />
              Compare e Economize
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Chega de Pagar Mensalidade Todo Mês
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Veja a diferença entre plataformas com mensalidade e o CobraFácil
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Competitors */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
            >
              <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-500/30 h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-foreground">Outras Plataformas</h3>
                    <Badge variant="destructive">Mensalidade</Badge>
                  </div>
                  <div className="space-y-3">
                    {competitorProblems.map((problem, index) => (
                      <div key={index} className="flex items-center gap-3 text-muted-foreground">
                        <X className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <span>{problem}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-red-200 dark:border-red-500/20">
                    <div className="text-sm text-muted-foreground">Custo anual estimado</div>
                    <div className="text-3xl font-bold text-red-500">R$ 600+/ano</div>
                    <div className="text-xs text-muted-foreground">em mensalidades recorrentes</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* CobraFácil */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-primary/5 border-primary/30 h-full relative overflow-hidden shadow-lg shadow-primary/10">
                <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-green-600 text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-bl-lg">
                  ✨ MELHOR ESCOLHA
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-foreground">CobraFácil</h3>
                    <Badge className="bg-primary text-primary-foreground font-bold">Pagamento Único</Badge>
                  </div>
                  <div className="space-y-3">
                    {cobraFacilBenefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-3 text-muted-foreground">
                        <Check className="w-5 h-5 text-primary flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-primary/20">
                    <div className="text-sm text-muted-foreground">Investimento</div>
                    <div className="text-3xl font-bold text-primary">1x e Pronto!</div>
                    <div className="text-xs text-muted-foreground">acesso vitalício garantido</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Detailed Features Section */}
      <section className="py-16 px-4 relative">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30 px-4 py-2 font-semibold">
              <Smartphone className="w-4 h-4 mr-2" />
              Conheça o Sistema
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Tudo Que Você Precisa em Um Só Lugar
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Veja em detalhes cada funcionalidade que vai transformar sua gestão de cobranças
            </p>
          </motion.div>

          {/* Feature 1 - Dashboard */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center mb-16"
          >
            <div className="order-2 md:order-1">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Dashboard</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Visão Geral Completa
              </h3>
              <p className="text-muted-foreground mb-6">
                Acompanhe em tempo real todos os seus empréstimos, valores a receber, pagamentos atrasados e muito mais. Tudo em uma única tela intuitiva.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Total emprestado e recebido</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Alertas de atrasos em destaque</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Gráficos de evolução financeira</span>
                </li>
              </ul>
            </div>
            <div className="order-1 md:order-2">
              <div className="bg-muted/50 border border-border rounded-2xl p-4 aspect-video flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Screenshot do Dashboard</span>
              </div>
            </div>
          </motion.div>

          {/* Feature 2 - Empréstimos */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center mb-16"
          >
            <div className="order-2">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Empréstimos</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Gestão Completa de Empréstimos
              </h3>
              <p className="text-muted-foreground mb-6">
                Cadastre empréstimos com juros simples ou por parcela. O sistema calcula tudo automaticamente e exibe em cards visuais e organizados.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Cálculo automático de juros</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Parcelas com datas personalizadas</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Status visual: em dia, atrasado, pago</span>
                </li>
              </ul>
            </div>
            <div className="order-1">
              <div className="bg-muted/50 border border-border rounded-2xl p-4 aspect-video flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Screenshot de Empréstimos</span>
              </div>
            </div>
          </motion.div>

          {/* Feature 3 - Calendário */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center mb-16"
          >
            <div className="order-2 md:order-1">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Calendário</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Calendário de Cobranças
              </h3>
              <p className="text-muted-foreground mb-6">
                Visualize todas as datas de vencimento em um calendário intuitivo. Nunca mais esqueça de cobrar ninguém.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Indicadores visuais por status</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Detalhes ao clicar na data</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Estatísticas mensais</span>
                </li>
              </ul>
            </div>
            <div className="order-1 md:order-2">
              <div className="bg-muted/50 border border-border rounded-2xl p-4 aspect-video flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Screenshot do Calendário</span>
              </div>
            </div>
          </motion.div>

          {/* Feature 4 - Alertas WhatsApp */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center mb-16"
          >
            <div className="order-2">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">WhatsApp</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Alertas Automáticos no WhatsApp
              </h3>
              <p className="text-muted-foreground mb-6">
                Receba resumos diários, alertas de vencimento e avisos de atraso direto no seu WhatsApp. Você sempre informado.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Resumo diário às 8h</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Alertas de vencimento no dia</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Avisos progressivos de atraso</span>
                </li>
              </ul>
            </div>
            <div className="order-1">
              <div className="bg-muted/50 border border-border rounded-2xl p-4 aspect-video flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Screenshot dos Alertas WhatsApp</span>
              </div>
            </div>
          </motion.div>

          {/* Feature 5 - Score de Clientes */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center mb-16"
          >
            <div className="order-2 md:order-1">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Score</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Score de Clientes
              </h3>
              <p className="text-muted-foreground mb-6">
                Sistema inteligente que avalia a confiabilidade de cada cliente baseado no histórico de pagamentos. Saiba quem é bom pagador.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Score de 0 a 150 pontos</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Atualização automática</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Indicador visual por cores</span>
                </li>
              </ul>
            </div>
            <div className="order-1 md:order-2">
              <div className="bg-muted/50 border border-border rounded-2xl p-4 aspect-video flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Screenshot do Score de Clientes</span>
              </div>
            </div>
          </motion.div>

          {/* Feature 6 - Simulador */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid md:grid-cols-2 gap-8 items-center"
          >
            <div className="order-2">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">Simulador</Badge>
              <h3 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                Simulador de Empréstimos
              </h3>
              <p className="text-muted-foreground mb-6">
                Planeje empréstimos antes de criar. Simule valores, juros e parcelas para apresentar propostas aos seus clientes.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Cálculo instantâneo</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Tabela de parcelas detalhada</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span>Total de juros e valor final</span>
                </li>
              </ul>
            </div>
            <div className="order-1">
              <div className="bg-muted/50 border border-border rounded-2xl p-4 aspect-video flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Screenshot do Simulador</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 relative">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
              Benefícios
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Por Que Escolher o CobraFácil?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Tecnologia de ponta para transformar suas cobranças em resultados reais
            </p>
          </motion.div>
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="bg-card border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 h-full group">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all">
                      <feature.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-4 relative bg-muted/30">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
              Simples e Eficiente
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Do Zero à Organização em 4 Etapas
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Veja como é fácil transformar suas cobranças
            </p>
          </motion.div>
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto"
          >
            {steps.map((step, index) => (
              <motion.div 
                key={index} 
                variants={fadeInUp}
                className="relative"
              >
                <Card className="bg-card border-border h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 text-center">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold text-primary-foreground">
                      {step.number}
                    </div>
                    <div className="text-3xl mb-3">{step.emoji}</div>
                    <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-4 relative">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
              Depoimentos
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              O que nossos clientes dizem
            </h2>
            <p className="text-muted-foreground">Conheça quem já usa o CobraFácil</p>
          </motion.div>
          
          <VideoCarousel />
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-4 relative bg-muted/30">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
              Escolha Seu Plano
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Comece a Usar Hoje Mesmo
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para você. Quanto maior o período, maior a economia!
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Plano Mensal */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
            >
              <Card className="bg-card border-border h-full">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <Badge variant="outline" className="mb-4 border-muted-foreground/30 text-muted-foreground">Mensal</Badge>
                    <div className="text-4xl font-bold text-foreground mb-1">
                      R$ 39<span className="text-2xl">,90</span>
                    </div>
                    <p className="text-sm text-muted-foreground">por mês</p>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Acesso a todas funcionalidades</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Alertas WhatsApp</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Suporte por email</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Ideal para testar</span>
                    </li>
                  </ul>
                  <Link to="/auth" className="block">
                    <Button variant="outline" size="lg" className="w-full">
                      Começar Teste
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Plano Vitalício - DESTAQUE */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={scaleIn}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-card border-2 border-primary h-full relative overflow-hidden shadow-2xl shadow-primary/20 scale-105">
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary via-green-500 to-primary text-primary-foreground text-center py-2 text-sm font-bold">
                  🔥 MAIS VENDIDO - MELHOR CUSTO-BENEFÍCIO
                </div>
                <CardContent className="p-6 pt-12">
                  <div className="text-center mb-6">
                    <Badge className="mb-4 bg-primary text-primary-foreground font-bold">Vitalício</Badge>
                    <div className="text-5xl font-bold text-primary mb-1">
                      R$ 199<span className="text-2xl">,90</span>
                    </div>
                    <p className="text-sm text-muted-foreground">pagamento único</p>
                    <div className="mt-2 inline-flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold text-primary">Acesso para sempre!</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground text-sm font-medium">Acesso vitalício garantido</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground text-sm font-medium">Todas as funcionalidades</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground text-sm font-medium">Atualizações gratuitas</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground text-sm font-medium">Suporte prioritário</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground text-sm font-medium">Sem mensalidades nunca mais</span>
                    </li>
                  </ul>
                  <Link to="/auth" className="block">
                    <Button size="lg" className="w-full text-lg h-14 bg-gradient-to-r from-primary to-green-600 hover:from-green-600 hover:to-primary shadow-lg">
                      <Zap className="w-5 h-5 mr-2" />
                      Quero Acesso Vitalício
                    </Button>
                  </Link>
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    💳 Pague em até 12x no cartão
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Plano Anual */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-card border-border h-full">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <Badge variant="outline" className="mb-4 border-primary/50 text-primary">Anual</Badge>
                    <div className="text-4xl font-bold text-foreground mb-1">
                      R$ 147<span className="text-2xl">,90</span>
                    </div>
                    <p className="text-sm text-muted-foreground">por ano</p>
                    <div className="mt-2 text-xs text-primary font-medium">
                      Economia de R$ 330/ano vs mensal
                    </div>
                  </div>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Acesso por 12 meses</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Todas as funcionalidades</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Alertas WhatsApp</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Suporte prioritário</span>
                    </li>
                  </ul>
                  <Link to="/auth" className="block">
                    <Button variant="outline" size="lg" className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                      Assinar Anual
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Garantia */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="mt-12 text-center"
          >
            <div className="inline-flex items-center gap-3 bg-card border border-border rounded-2xl px-6 py-4">
              <Shield className="w-8 h-8 text-primary" />
              <div className="text-left">
                <div className="font-bold text-foreground">Garantia de 7 Dias</div>
                <div className="text-sm text-muted-foreground">Se não gostar, devolvemos 100% do seu dinheiro</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-4 relative">
        <div className="container mx-auto max-w-3xl">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
              FAQ
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Perguntas frequentes
            </h2>
          </motion.div>
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className="bg-card border border-border rounded-xl px-6 data-[state=open]:border-primary/30 shadow-sm"
              >
                <AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-4 relative overflow-hidden bg-primary">
        <div className="container mx-auto text-center relative">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-3xl sm:text-5xl font-bold mb-6 text-primary-foreground"
          >
            Pronto para organizar suas cobranças?
          </motion.h2>
          <motion.p 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ delay: 0.1 }}
            className="text-primary-foreground/80 mb-10 max-w-xl mx-auto text-lg"
          >
            Junte-se a centenas de cobradores que já usam o CobraFácil
          </motion.p>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="text-lg px-10 h-16 shadow-lg">
              Começar Agora - É Grátis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border bg-card">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl text-foreground">CobraFácil</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Dados protegidos
              </span>
              <span className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                100% Responsivo
              </span>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} CobraFácil. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* Fixed Bottom Bar */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: showBottomBar ? 0 : 100 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border py-3 px-4"
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              <span className="hidden sm:inline">Comece agora </span>
              <span className="text-primary font-semibold">100% Grátis</span>
            </span>
          </div>
          <Link to="/auth">
            <Button>
              Começar Agora
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Landing;
