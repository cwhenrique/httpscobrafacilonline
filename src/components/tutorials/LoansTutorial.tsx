import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';
import { useEffect } from 'react';

interface LoansTutorialProps {
  run: boolean;
  onFinish: () => void;
  onExit: () => void;
  stepIndex: number;
  onStepChange: (index: number) => void;
}

// New tutorial steps - starts with client registration
const TUTORIAL_STEPS: Step[] = [
  // Step 0: Click "Novo Empréstimo" button
  {
    target: '.tutorial-new-loan',
    content: '👆 Clique neste botão para começar a criar um empréstimo!',
    title: '🆕 Passo 1: Novo Empréstimo',
    disableBeacon: true,
    placement: 'bottom',
    hideFooter: true, // User must click the actual button
    spotlightClicks: true,
  },
  // Step 1: Click "Cadastrar novo cliente" button
  {
    target: '.tutorial-new-client-btn',
    content: '👆 Como você ainda não tem clientes, clique aqui para cadastrar um novo cliente!',
    title: '👤 Passo 2: Cadastrar Cliente',
    placement: 'bottom',
    hideFooter: true, // User must click the actual button
    spotlightClicks: true,
  },
  // Step 2: Fill client name
  {
    target: '.tutorial-client-name',
    content: '📝 Digite o nome completo do cliente no campo destacado. Depois clique em "Próxima Etapa".',
    title: '✏️ Passo 3: Nome do Cliente',
    placement: 'right',
    hideFooter: false, // Show "Próxima Etapa" button
    spotlightClicks: true,
  },
  // Step 3: Fill client phone (optional)
  {
    target: '.tutorial-client-phone',
    content: '📱 Digite o telefone do cliente (opcional). Depois clique em "Próxima Etapa".',
    title: '📞 Passo 4: Telefone',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
  },
  // Step 4: Click "Criar Cliente" button
  {
    target: '.tutorial-create-client-btn',
    content: '👆 Clique neste botão para criar o cliente!',
    title: '✅ Passo 5: Criar Cliente',
    placement: 'top',
    hideFooter: true, // User must click the actual button
    spotlightClicks: true,
  },
  // Step 5: Fill loan value
  {
    target: '.tutorial-form-value',
    content: '💰 Digite o valor que será emprestado ao cliente. Depois clique em "Próxima Etapa".',
    title: '💵 Passo 6: Valor do Empréstimo',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
  },
  // Step 6: Fill interest rate
  {
    target: '.tutorial-form-interest',
    content: '📊 Defina a taxa de juros em percentual (ex: 10%). Depois clique em "Próxima Etapa".',
    title: '📈 Passo 7: Taxa de Juros',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
  },
  // Step 7: Select interest mode
  {
    target: '.tutorial-form-interest-mode',
    content: '⚙️ Escolha como os juros serão aplicados: "Por Parcela" ou "Sobre o Total". Depois clique em "Próxima Etapa".',
    title: '🔧 Passo 8: Modo de Juros',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
  },
  // Step 8: Select payment type
  {
    target: '.tutorial-form-payment-type',
    content: '📋 Selecione a modalidade de pagamento: Único, Parcelado, Semanal ou Diário. Depois clique em "Próxima Etapa".',
    title: '💳 Passo 9: Modalidade',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
  },
  // Step 9: Fill dates
  {
    target: '.tutorial-form-dates',
    content: '📅 Defina a data de início do empréstimo. Depois clique em "Próxima Etapa".',
    title: '🗓️ Passo 10: Datas',
    placement: 'right',
    hideFooter: false,
    spotlightClicks: true,
  },
  // Step 10: Notes (optional)
  {
    target: '.tutorial-form-notes',
    content: '📝 Adicione observações opcionais sobre o empréstimo. Este campo é opcional.',
    title: '📋 Passo 11: Observações',
    placement: 'top',
    hideFooter: false,
    disableBeacon: true,
  },
  // Step 11: Submit button
  {
    target: '.tutorial-form-submit',
    content: '✅ Quando terminar de preencher, clique em "Criar" para salvar o empréstimo! (Você pode cancelar se for apenas um teste)',
    title: '🎉 Passo 12: Criar Empréstimo',
    placement: 'top',
    hideFooter: false,
    disableBeacon: true,
  },
  // Step 12: Search field
  {
    target: '.tutorial-search',
    content: '🔍 Pesquise rapidamente por nome do cliente ou valor para encontrar empréstimos específicos.',
    title: '🔎 Buscar Empréstimos',
    placement: 'bottom',
    hideFooter: false,
    disableBeacon: true,
  },
  // Step 13: Filters
  {
    target: '.tutorial-filters',
    content: '📋 Filtre por status: Em Dia, Pagos, Atraso, Renegociados, Só Juros, Semanal ou Diário.',
    title: '🏷️ Filtros de Status',
    placement: 'bottom',
    hideFooter: false,
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
      return; // Ignore - only the red exit button can close the tutorial
    }

    // Only finish when truly completed all steps
    if (status === STATUS.FINISHED) {
      onFinish();
      return;
    }

    // Handle navigation via Next/Back buttons
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        onStepChange(index + 1);
      } else if (action === ACTIONS.PREV) {
        onStepChange(Math.max(0, index - 1));
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
