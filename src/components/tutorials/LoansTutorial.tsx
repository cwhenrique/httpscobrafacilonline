import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';

interface LoansTutorialProps {
  run: boolean;
  onFinish: () => void;
  onExit: () => void;
  stepIndex: number;
  onStepChange: (index: number) => void;
}

// Simplified tutorial steps - client form auto-opens
const TUTORIAL_STEPS: Step[] = [
  // Step 0: Click "Novo Empréstimo" button
  {
    target: '.tutorial-new-loan',
    content: '👆 Clique neste botão para começar a criar um empréstimo!',
    title: '🆕 Passo 1: Novo Empréstimo',
    disableBeacon: true,
    placement: 'bottom',
    hideFooter: true,
    spotlightClicks: true,
  },
  // Step 1: Fill client name (form auto-opened)
  {
    target: '.tutorial-client-name',
    content: '📝 Digite o nome completo do cliente no campo destacado.',
    title: '✏️ Passo 2: Nome do Cliente',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
    disableBeacon: true,
  },
  // Step 2: Fill client phone (optional)
  {
    target: '.tutorial-client-phone',
    content: '📱 Digite o telefone do cliente (opcional).',
    title: '📞 Passo 3: Telefone',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
    disableBeacon: true,
  },
  // Step 3: Click "Criar Cliente" button
  {
    target: '.tutorial-create-client-btn',
    content: '👆 Clique neste botão para criar o cliente!',
    title: '✅ Passo 4: Criar Cliente',
    placement: 'top',
    hideFooter: true,
    spotlightClicks: true,
    disableBeacon: true,
  },
  // Step 4: Fill loan value
  {
    target: '.tutorial-form-value',
    content: '💰 Digite o valor que será emprestado ao cliente.',
    title: '💵 Passo 5: Valor do Empréstimo',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
    disableBeacon: true,
  },
  // Step 5: Fill interest rate
  {
    target: '.tutorial-form-interest',
    content: '📊 Defina a taxa de juros em percentual (ex: 10%).',
    title: '📈 Passo 6: Taxa de Juros',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
    disableBeacon: true,
  },
  // Step 6: Select interest mode
  {
    target: '.tutorial-form-interest-mode',
    content: '⚙️ Escolha como os juros serão aplicados.',
    title: '🔧 Passo 7: Modo de Juros',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
    disableBeacon: true,
  },
  // Step 7: Select payment type
  {
    target: '.tutorial-form-payment-type',
    content: '📋 Selecione a modalidade de pagamento.',
    title: '💳 Passo 8: Modalidade',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
    disableBeacon: true,
  },
  // Step 8: Fill dates
  {
    target: '.tutorial-form-dates',
    content: '📅 Defina a data de início do empréstimo.',
    title: '🗓️ Passo 9: Datas',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
    disableBeacon: true,
  },
  // Step 9: Notes (optional)
  {
    target: '.tutorial-form-notes',
    content: '📝 Adicione observações opcionais sobre o empréstimo.',
    title: '📋 Passo 10: Observações',
    placement: 'top',
    hideFooter: false,
    disableBeacon: true,
  },
  // Step 10: Submit button
  {
    target: '.tutorial-form-submit',
    content: '✅ Quando terminar, clique em "Criar" para salvar! (Você pode cancelar se for teste)',
    title: '🎉 Passo 11: Criar Empréstimo',
    placement: 'top',
    hideFooter: false,
    disableBeacon: true,
  },
  // Step 11: Search field
  {
    target: '.tutorial-search',
    content: '🔍 Pesquise rapidamente por nome do cliente ou valor.',
    title: '🔎 Buscar Empréstimos',
    placement: 'bottom',
    hideFooter: false,
    disableBeacon: true,
  },
  // Step 12: Filters
  {
    target: '.tutorial-filters',
    content: '📋 Filtre por status: Em Dia, Pagos, Atraso, etc.',
    title: '🏷️ Filtros de Status',
    placement: 'bottom',
    hideFooter: false,
    disableBeacon: true,
  },
];

export default function LoansTutorial({ run, onFinish, onExit, stepIndex, onStepChange }: LoansTutorialProps) {
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action, index, type } = data;
    
    // Block all external close attempts
    if (action === ACTIONS.SKIP || action === ACTIONS.CLOSE) {
      return;
    }

    if (status === STATUS.FINISHED) {
      onFinish();
      return;
    }

    // Handle navigation
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        onStepChange(index + 1);
      } else if (action === ACTIONS.PREV) {
        onStepChange(Math.max(0, index - 1));
      }
    }
  };

  // Only render when tutorial is running
  if (!run) return null;

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
      disableScrolling
      disableScrollParentFix
      floaterProps={{
        disableAnimation: true,
        offset: 15,
      }}
      spotlightPadding={8}
      locale={{
        back: '← Voltar',
        close: 'Fechar',
        last: '🎉 Finalizar Tutorial',
        next: '✓ Próxima Etapa',
        open: 'Abrir',
        skip: '',
      }}
      styles={{
        options: {
          primaryColor: '#22c55e',
          backgroundColor: '#1e293b',
          textColor: '#f8fafc',
          arrowColor: '#1e293b',
          overlayColor: 'rgba(0, 0, 0, 0.85)',
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
