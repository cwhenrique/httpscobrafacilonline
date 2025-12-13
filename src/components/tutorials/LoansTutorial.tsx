import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';
import { useEffect } from 'react';

interface LoansTutorialProps {
  run: boolean;
  onFinish: () => void;
  onExit: () => void; // Explicit exit function
  stepIndex: number;
  onStepChange: (index: number) => void;
}

// Define which steps require user action (no next button)
const INTERACTIVE_STEP_INDICES = [0, 1, 2, 3, 4, 5, 6]; // Steps that need user action

const TUTORIAL_STEPS: Step[] = [
  {
    target: '.tutorial-new-loan',
    content: '👆 Clique neste botão para começar a criar um empréstimo!',
    title: '🆕 Passo 1: Novo Empréstimo',
    disableBeacon: true,
    placement: 'bottom',
    hideFooter: true,
    spotlightClicks: true,
  },
  {
    target: '.tutorial-form-client',
    content: '👆 Selecione um cliente da lista ou cadastre um novo para continuar.',
    title: '👤 Passo 2: Selecionar Cliente',
    placement: 'right',
    hideFooter: true,
    spotlightClicks: true,
  },
  {
    target: '.tutorial-form-value',
    content: '📝 Digite o valor que será emprestado ao cliente e pressione TAB ou clique fora.',
    title: '💰 Passo 3: Valor do Empréstimo',
    placement: 'right',
    hideFooter: true,
    spotlightClicks: true,
  },
  {
    target: '.tutorial-form-interest',
    content: '📝 Defina a taxa de juros em percentual (ex: 10%) e pressione TAB ou clique fora.',
    title: '📊 Passo 4: Taxa de Juros',
    placement: 'right',
    hideFooter: true,
    spotlightClicks: true,
  },
  {
    target: '.tutorial-form-interest-mode',
    content: '👆 Escolha como os juros serão aplicados: "Por Parcela" ou "Sobre o Total".',
    title: '⚙️ Passo 5: Modo de Juros',
    placement: 'right',
    hideFooter: true,
    spotlightClicks: true,
  },
  {
    target: '.tutorial-form-payment-type',
    content: '👆 Selecione a modalidade de pagamento: Único, Parcelado, Semanal ou Diário.',
    title: '📋 Passo 6: Modalidade',
    placement: 'right',
    hideFooter: true,
    spotlightClicks: true,
  },
  {
    target: '.tutorial-form-dates',
    content: '📅 Defina a data de início do empréstimo.',
    title: '📅 Passo 7: Datas',
    placement: 'right',
    hideFooter: true,
    spotlightClicks: true,
  },
  {
    target: '.tutorial-form-notes',
    content: 'Adicione observações opcionais sobre o empréstimo. Este campo é opcional.',
    title: '📝 Passo 8: Observações',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.tutorial-form-submit',
    content: '✅ Quando terminar de preencher, clique em "Criar" para salvar o empréstimo! (Você pode cancelar se for apenas um teste)',
    title: '✅ Passo 9: Criar Empréstimo',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.tutorial-search',
    content: 'Pesquise rapidamente por nome do cliente ou valor para encontrar empréstimos específicos.',
    title: '🔍 Buscar Empréstimos',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.tutorial-filters',
    content: 'Filtre por status: Em Dia, Pagos, Atraso, Renegociados, Só Juros, Semanal ou Diário.',
    title: '📋 Filtros de Status',
    placement: 'bottom',
    disableBeacon: true,
  },
];

export default function LoansTutorial({ run, onFinish, onExit, stepIndex, onStepChange }: LoansTutorialProps) {
  // Reset step index when tutorial starts
  useEffect(() => {
    if (run && stepIndex === -1) {
      onStepChange(0);
    }
  }, [run, stepIndex, onStepChange]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;
    
    // BLOCK all external close attempts - only explicit exit button can close
    if (action === ACTIONS.SKIP || action === ACTIONS.CLOSE) {
      // Ignore - only the red exit button can close the tutorial
      return;
    }

    // Only finish when truly completed all steps
    if (status === STATUS.FINISHED) {
      onFinish();
      return;
    }

    // Handle navigation for non-interactive steps (steps with Next button)
    if (type === EVENTS.STEP_AFTER && !INTERACTIVE_STEP_INDICES.includes(index)) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      onStepChange(nextIndex);
    }
    
    // Handle going back on steps with buttons
    if (type === EVENTS.STEP_AFTER && action === ACTIONS.PREV) {
      const nextIndex = index - 1;
      if (nextIndex >= 0) {
        onStepChange(nextIndex);
      }
    }
  };

  if (stepIndex < 0) return null;

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      stepIndex={stepIndex}
      scrollToFirstStep
      showProgress
      showSkipButton={false}
      steps={TUTORIAL_STEPS}
      disableOverlayClose
      disableCloseOnEsc
      floaterProps={{
        disableAnimation: true,
        offset: 15,
      }}
      spotlightPadding={8}
      locale={{
        back: 'Voltar',
        close: 'Fechar',
        last: 'Finalizar',
        next: 'Próximo',
        open: 'Abrir',
        skip: '',
      }}
      styles={{
        options: {
          primaryColor: '#22c55e',
          backgroundColor: '#1e293b',
          textColor: '#f8fafc',
          arrowColor: '#1e293b',
          overlayColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          padding: 16,
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 600,
          marginBottom: 8,
        },
        tooltipContent: {
          fontSize: 14,
          lineHeight: 1.5,
        },
        buttonNext: {
          backgroundColor: '#22c55e',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 500,
        },
        buttonBack: {
          color: '#94a3b8',
          marginRight: 8,
          fontSize: 14,
        },
        buttonSkip: {
          color: '#64748b',
          fontSize: 13,
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
    />
  );
}
