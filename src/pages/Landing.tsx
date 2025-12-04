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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
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

  const problems = [
    {
      title: "Planilhas desorganizadas",
      description: "Controle confuso que causa erros e perda de informações",
      isTraditional: true,
    },
    {
      title: "Esquece de cobrar",
      description: "Perde dinheiro por não lembrar das datas de vencimento",
      isTraditional: true,
    },
    {
      title: "Cálculos manuais",
      description: "Gasta horas calculando juros e parcelas manualmente",
      isTraditional: true,
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

  const traditionalProblems = [
    "Conteúdo genérico para todos",
    "Sem acompanhamento individual",
    "Material desatualizado",
    "Sem flexibilidade de horários",
  ];

  const cobraFacilBenefits = [
    "Sistema 100% personalizado",
    "Alertas automáticos no WhatsApp",
    "Cálculos sempre atualizados",
    "Acesse quando e onde quiser",
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] overflow-x-hidden text-white">
      {/* Header */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5"
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">CobraFácil</span>
            <span className="hidden sm:inline text-sm text-gray-400">sistema de gestão de empréstimos</span>
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
      <section className="pt-24 pb-12 px-4 relative min-h-screen flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src={heroPerson} 
            alt="" 
            className="absolute right-0 top-0 h-full w-auto object-cover opacity-20 max-w-none"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-[#0a0a0f]/50" />
        </div>
        
        <div className="container mx-auto text-center relative">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6 bg-primary/20 text-primary border-primary/30 px-4 py-2">
              <Sparkles className="w-4 h-4 mr-2" />
              Sistema Completo de Gestão de Empréstimos
            </Badge>
          </motion.div>
          
          <motion.h1 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-tight"
          >
            Pare de Perder Dinheiro.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-600">
              Cobre com Facilidade
            </span>
          </motion.h1>

          {/* Feature Badges */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex flex-wrap justify-center gap-3 mb-8"
          >
            <Badge variant="outline" className="border-gray-600 text-gray-300 px-4 py-2">
              <Calculator className="w-4 h-4 mr-2 text-primary" />
              Cálculo Automático
            </Badge>
            <Badge variant="outline" className="border-gray-600 text-gray-300 px-4 py-2">
              <MessageCircle className="w-4 h-4 mr-2 text-primary" />
              Alertas WhatsApp
            </Badge>
            <Badge variant="outline" className="border-gray-600 text-gray-300 px-4 py-2">
              <TrendingUp className="w-4 h-4 mr-2 text-primary" />
              Score de Clientes
            </Badge>
          </motion.div>
          
          <motion.p 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto"
          >
            O único sistema que calcula juros automaticamente, envia alertas no WhatsApp
            e organiza todas as suas cobranças em um só lugar.
          </motion.p>
          
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link to="/auth">
              <Button size="lg" className="text-lg px-8 h-14 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
                <Sparkles className="w-5 h-5 mr-2" />
                Descobrir Todas as Funcionalidades
              </Button>
            </Link>
            <div className="flex items-center gap-2 text-gray-400 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
              <Shield className="w-5 h-5 text-primary" />
              <div className="text-left">
                <div className="text-sm font-semibold text-white">100% Grátis</div>
                <div className="text-xs">Teste sem compromisso</div>
              </div>
            </div>
          </motion.div>

          {/* Trust Badges */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-gray-500"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Sem cartão de crédito
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Acesso imediato
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Cancele quando quiser
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
              { value: "R$ 10M+", label: "Gerenciados" },
              { value: "500+", label: "Cobradores Ativos" },
              { value: "⭐ 4.9/5", label: "Avaliação" },
              { value: "97%", label: "Satisfação" },
            ].map((stat, index) => (
              <motion.div 
                key={index} 
                variants={scaleIn}
                className="text-center p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
              >
                <div className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Comparison Section */}
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
            <Badge className="mb-4 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              💰 Compare e Economize
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Quanto Você Está Perdendo com Controle Manual?
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Veja a diferença absurda de organização e tempo
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Traditional Way */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeInUp}
            >
              <Card className="bg-red-950/20 border-red-500/30 h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">Controle Manual</h3>
                    <Badge variant="destructive">Ultrapassado</Badge>
                  </div>
                  <div className="space-y-3">
                    {traditionalProblems.map((problem, index) => (
                      <div key={index} className="flex items-center gap-3 text-gray-400">
                        <X className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <span>{problem}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-red-500/20">
                    <div className="text-sm text-gray-500">Prejuízo estimado</div>
                    <div className="text-3xl font-bold text-red-400">R$ 5.000+/ano</div>
                    <div className="text-xs text-gray-500">em cobranças esquecidas</div>
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
              <Card className="bg-primary/10 border-primary/30 h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                  RECOMENDADO
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">CobraFácil</h3>
                    <Badge className="bg-primary text-primary-foreground">Moderno</Badge>
                  </div>
                  <div className="space-y-3">
                    {cobraFacilBenefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-3 text-gray-300">
                        <Check className="w-5 h-5 text-primary flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-primary/20">
                    <div className="text-sm text-gray-500">Investimento</div>
                    <div className="text-3xl font-bold text-primary">Grátis</div>
                    <div className="text-xs text-gray-500">para sempre no plano básico</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container mx-auto relative">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">
              Benefícios
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Por Que Escolher o CobraFácil?
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
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
                <Card className="bg-white/5 border-white/10 hover:border-primary/50 transition-all duration-300 h-full group">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all">
                      <feature.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-400 text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-4 relative">
        <div className="container mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">
              Simples e Eficiente
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Do Zero à Organização em 4 Etapas
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
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
                <Card className="bg-white/5 border-white/10 h-full">
                  <CardContent className="p-6 text-center">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-lg font-bold text-primary-foreground">
                      {step.number}
                    </div>
                    <div className="text-3xl mb-3">{step.emoji}</div>
                    <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-gray-400 text-sm">{step.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/20 to-transparent" />
        <div className="container mx-auto relative">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">
              Depoimentos
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              O que nossos clientes dizem
            </h2>
            <p className="text-gray-400">Conheça quem já usa o CobraFácil</p>
          </motion.div>
          
          <VideoCarousel />
        </div>
      </section>

      {/* Pricing Section */}
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
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">
              Escolha Seu Plano
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Comece a usar hoje mesmo
            </h2>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={scaleIn}
            transition={{ duration: 0.6 }}
          >
            <Card className="max-w-lg mx-auto bg-gradient-to-b from-primary/20 to-primary/5 border-primary/30 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-violet-500 to-primary" />
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <Badge className="mb-4 bg-primary text-primary-foreground">Mais Popular</Badge>
                  <div className="text-5xl font-bold text-white mb-2">Grátis</div>
                  <p className="text-gray-400">Para sempre no plano básico</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {includedFeatures.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth" className="block">
                  <Button size="lg" className="w-full text-lg h-14 bg-primary hover:bg-primary/90">
                    Criar Conta Grátis
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
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
            <Badge className="mb-4 bg-primary/20 text-primary border-primary/30">
              FAQ
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Perguntas frequentes
            </h2>
          </motion.div>
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className="bg-white/5 border border-white/10 rounded-xl px-6 data-[state=open]:border-primary/30"
              >
                <AccordionTrigger className="text-left text-white hover:text-primary hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-gray-400">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-violet-950/30 to-[#0a0a0f]" />
        <div className="container mx-auto text-center relative">
          <motion.h2 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="text-3xl sm:text-5xl font-bold mb-6"
          >
            Pronto para organizar suas cobranças?
          </motion.h2>
          <motion.p 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            transition={{ delay: 0.1 }}
            className="text-gray-400 mb-10 max-w-xl mx-auto text-lg"
          >
            Junte-se a centenas de cobradores que já usam o CobraFácil
          </motion.p>
          <Link to="/auth">
            <Button size="lg" className="text-lg px-10 h-16 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
              Começar Agora - É Grátis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">CobraFácil</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
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
          <div className="mt-8 pt-8 border-t border-white/5 text-center">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} CobraFácil. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      {/* Fixed Bottom Bar */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: showBottomBar ? 0 : 100 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/10 py-3 px-4"
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm text-gray-300">
              <span className="hidden sm:inline">Comece agora </span>
              <span className="text-primary font-semibold">100% Grátis</span>
            </span>
          </div>
          <Link to="/auth">
            <Button className="bg-primary hover:bg-primary/90">
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
