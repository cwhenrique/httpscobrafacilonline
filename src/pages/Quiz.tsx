import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QuizProgress } from "@/components/quiz/QuizProgress";
import { QuizQuestion } from "@/components/quiz/QuizQuestion";
import { QuizResultQualified } from "@/components/quiz/QuizResultQualified";
import { QuizResultDisqualified } from "@/components/quiz/QuizResultDisqualified";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import logo from "@/assets/cobrafacil-logo.png";

interface QuizOption {
  label: string;
  value: string;
  points: number;
  isEliminator?: boolean;
}

interface QuizQuestionData {
  id: string;
  question: string;
  options: QuizOption[];
}

const questions: QuizQuestionData[] = [
  {
    id: "segment",
    question: "Qual é o seu principal tipo de negócio?",
    options: [
      { label: "Empréstimos pessoais / Agiota", value: "emprestimos", points: 25 },
      { label: "Venda de veículos parcelados", value: "veiculos", points: 25 },
      { label: "Venda de produtos parcelados", value: "produtos", points: 20 },
      { label: "Prestador de serviços com mensalidades", value: "servicos", points: 15 },
      { label: "Outro", value: "outro", points: 5 },
    ],
  },
  {
    id: "volume",
    question: "Quantos clientes você gerencia atualmente?",
    options: [
      { label: "Mais de 100", value: "100+", points: 25 },
      { label: "Entre 50 e 100", value: "50-100", points: 20 },
      { label: "Entre 10 e 50", value: "10-50", points: 15 },
      { label: "Menos de 10", value: "menos-10", points: 5 },
    ],
  },
  {
    id: "pain",
    question: "Qual é o seu maior desafio hoje?",
    options: [
      { label: "Clientes que atrasam pagamentos", value: "atrasos", points: 20 },
      { label: "Falta de controle sobre as parcelas", value: "controle", points: 20 },
      { label: "Dificuldade para cobrar sem parecer chato", value: "cobranca", points: 15 },
      { label: "Calcular juros e valores corretamente", value: "calculos", points: 15 },
      { label: "Perco tempo demais com planilhas", value: "tempo", points: 10 },
    ],
  },
  {
    id: "method",
    question: "Como você controla suas cobranças hoje?",
    options: [
      { label: "Caderno / Papel", value: "caderno", points: 20 },
      { label: "Não tenho controle organizado", value: "sem-controle", points: 20 },
      { label: "Planilhas (Excel/Google Sheets)", value: "planilhas", points: 15 },
      { label: "Aplicativo genérico", value: "app-generico", points: 10 },
      { label: "Já uso um sistema específico", value: "sistema", points: 0 },
    ],
  },
  {
    id: "investment",
    question: "Você tem pelo menos R$50 por mês para investir no crescimento do seu negócio?",
    options: [
      { label: "Sim, com certeza!", value: "sim-certeza", points: 20 },
      { label: "Sim, se valer a pena", value: "sim-depende", points: 15 },
      { label: "Talvez, depende do retorno", value: "talvez", points: 10 },
      { label: "Não tenho esse valor disponível", value: "nao", points: 0, isEliminator: true },
    ],
  },
  {
    id: "urgency",
    question: "Quando você pretende resolver esse problema?",
    options: [
      { label: "Agora mesmo, preciso urgente!", value: "agora", points: 20 },
      { label: "Nas próximas semanas", value: "semanas", points: 15 },
      { label: "Estou apenas pesquisando", value: "pesquisando", points: 5 },
      { label: "Ainda não sei", value: "nao-sei", points: 0 },
    ],
  },
];

interface Answer {
  questionId: string;
  question: string;
  answer: string;
  points: number;
  isEliminator?: boolean;
}

export default function Quiz() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isEliminated, setIsEliminated] = useState(false);
  const [eliminationReason, setEliminationReason] = useState<'low_score' | 'no_investment'>('low_score');

  const handleAnswer = (option: QuizOption) => {
    const currentQuestion = questions[currentStep];
    
    const newAnswer: Answer = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      answer: option.label,
      points: option.points,
      isEliminator: option.isEliminator,
    };

    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);

    // Check if eliminated by investment question
    if (option.isEliminator) {
      setIsEliminated(true);
      setEliminationReason('no_investment');
      setIsFinished(true);
      return;
    }

    // Move to next question or finish
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Calculate final score
      const totalScore = newAnswers.reduce((sum, a) => sum + a.points, 0);
      
      if (totalScore < 50) {
        setIsEliminated(true);
        setEliminationReason('low_score');
      }
      
      setIsFinished(true);
    }
  };

  const totalScore = answers.reduce((sum, a) => sum + a.points, 0);
  const isHotLead = totalScore >= 80;

  const formattedAnswers = answers.map(a => ({
    question: a.question.replace("?", ""),
    answer: a.answer,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="CobraFacil" className="h-8" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-16 max-w-2xl">
        <AnimatePresence mode="wait">
          {!isFinished ? (
            <motion.div
              key="quiz"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Welcome message on first question */}
              {currentStep === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-2 mb-8"
                >
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    Descubra se o CobraFacil é pra você
                  </h1>
                  <p className="text-muted-foreground">
                    Responda 6 perguntas rápidas e saiba como podemos ajudar seu negócio
                  </p>
                </motion.div>
              )}

              {/* Progress Bar */}
              <QuizProgress 
                currentStep={currentStep + 1} 
                totalSteps={questions.length} 
              />

              {/* Question */}
              <QuizQuestion
                key={currentStep}
                question={questions[currentStep].question}
                options={questions[currentStep].options}
                onAnswer={handleAnswer}
              />
            </motion.div>
          ) : isEliminated ? (
            <QuizResultDisqualified 
              key="disqualified"
              reason={eliminationReason} 
            />
          ) : (
            <QuizResultQualified
              key="qualified"
              score={totalScore}
              answers={formattedAnswers}
              isHot={isHotLead}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-4 text-center text-xs text-muted-foreground bg-background/80 backdrop-blur-sm border-t">
        © {new Date().getFullYear()} CobraFacil - Todos os direitos reservados
      </footer>
    </div>
  );
}
