import jsPDF from 'jspdf';
import cobraFacilLogo from '@/assets/cobrafacil-logo.png';

// Simulation PDF Data Interface
export interface SimulationPDFData {
  principal: number;
  interestRate: number;
  installments: number;
  totalInterest: number;
  totalAmount: number;
  installmentValue: number;
  paymentType: string;
  interestMode: string;
  effectiveRate: number;
  startDate: string;
  firstDueDate?: string;
  schedule: Array<{
    number: number;
    dueDate: string;
    total: number;
  }>;
  companyName?: string;
  customLogoUrl?: string | null; // Custom company logo for PDF
}

// Theme colors (HSL converted to RGB)
const PRIMARY_GREEN = { r: 34, g: 197, b: 94 }; // #22c55e
const DARK_GREEN = { r: 22, g: 163, b: 74 }; // #16a34a
const LIGHT_GREEN_BG = { r: 220, g: 252, b: 231 }; // #dcfce7
const WHITE = { r: 255, g: 255, b: 255 };
const DARK_TEXT = { r: 30, g: 30, b: 30 };
const MUTED_TEXT = { r: 100, g: 100, b: 100 };

// Utility functions
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('pt-BR');
};

const getContractPrefix = (type: 'loan' | 'product' | 'vehicle' | 'contract'): string => {
  switch (type) {
    case 'loan': return 'EMP';
    case 'product': return 'PRD';
    case 'vehicle': return 'VEI';
    case 'contract': return 'CTR';
    default: return 'DOC';
  }
};

const getContractTypeName = (type: 'loan' | 'product' | 'vehicle' | 'contract'): string => {
  switch (type) {
    case 'loan': return 'EMPRÉSTIMO';
    case 'product': return 'VENDA DE PRODUTO';
    case 'vehicle': return 'VENDA DE VEÍCULO';
    case 'contract': return 'CONTRATO';
    default: return 'DOCUMENTO';
  }
};

// Load logo as base64 - supports custom logo URL with fallback to default
const loadLogoAsBase64 = (customLogoUrl?: string | null): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    
    img.onerror = () => {
      // If custom logo fails, fallback to default
      if (customLogoUrl && img.src !== cobraFacilLogo) {
        console.warn('Custom logo failed to load, using default');
        img.src = cobraFacilLogo;
      } else {
        reject(new Error('Could not load logo'));
      }
    };
    
    // Use custom logo if provided, otherwise use default
    img.src = customLogoUrl || cobraFacilLogo;
  });
};

export interface ContractReceiptData {
  type: 'loan' | 'product' | 'vehicle' | 'contract';
  contractId: string;
  companyName: string;
  customLogoUrl?: string | null; // Custom company logo for PDF
  client: {
    name: string;
    phone?: string;
    cpf?: string;
    rg?: string;
    email?: string;
    address?: string;
  };
  negotiation: {
    principal: number;
    interestRate?: number;
    installments: number;
    installmentValue: number;
    totalToReceive: number;
    startDate: string; // Mantido para compatibilidade - usar contractDate quando disponível
    contractDate?: string; // Data do contrato (quando foi fechado)
    firstDueDate?: string; // Data do primeiro vencimento
    downPayment?: number;
    costValue?: number;
    profit?: number;
  };
  dueDates: (string | { date: string; isPaid?: boolean })[];
  vehicleInfo?: {
    brand: string;
    model: string;
    year: number;
    color?: string;
    plate?: string;
    chassis?: string;
  };
  productInfo?: {
    name: string;
    description?: string;
  };
  // Informações de pagamento apenas de juros
  interestOnlyPayment?: {
    amountPaid: number;
    paymentDate: string;
    remainingBalance: number;
  };
}

export interface PaymentReceiptData {
  type: 'loan' | 'product' | 'vehicle' | 'contract';
  contractId: string;
  companyName: string;
  customLogoUrl?: string | null; // Custom company logo for PDF
  clientName: string;
  installmentNumber: number | number[]; // Suporta uma ou múltiplas parcelas
  totalInstallments: number;
  amountPaid: number;
  paymentDate: string;
  remainingBalance: number;
  totalPaid?: number;
  totalContract?: number;
  billingSignatureName?: string;
  nextDueDate?: string;
  discountAmount?: number;
  penaltyAmount?: number; // Valor da multa paga
}

export const generateContractReceipt = async (data: ContractReceiptData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let currentY = 0;

  // Load logo (custom or default)
  let logoBase64 = '';
  try {
    logoBase64 = await loadLogoAsBase64(data.customLogoUrl);
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  // === HEADER BAR ===
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 5, 40, 25);
  } else {
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CobraFácil', margin, 22);
  }

  // Company name on the right
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.companyName) {
    doc.text(data.companyName, pageWidth - margin, 15, { align: 'right' });
  }

  currentY = 45;

  // === DOCUMENT TITLE ===
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 18, 3, 3, 'F');
  
  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const documentTitle = data.interestOnlyPayment 
    ? 'COMPROVANTE DE PAGAMENTO DE JUROS' 
    : `COMPROVANTE DE ${getContractTypeName(data.type)}`;
  doc.text(documentTitle, pageWidth / 2, currentY + 8, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const contractNumber = `Nº: ${getContractPrefix(data.type)}-${data.contractId.substring(0, 8).toUpperCase()}`;
  doc.text(contractNumber, pageWidth / 2, currentY + 14, { align: 'center' });

  currentY += 25;

  // === CLIENT DATA SECTION ===
  // Calculate box height based on whether address exists and its length
  const hasAddress = data.client.address && data.client.address.length > 0;
  const addressMaxWidth = pageWidth - 2 * margin - 35;
  let addressLineCount = 0;
  if (hasAddress) {
    const tempLines = doc.splitTextToSize(data.client.address!, addressMaxWidth);
    addressLineCount = Math.min(tempLines.length, 3); // Max 3 lines
  }
  const clientBoxHeight = hasAddress ? 45 + (addressLineCount * 5) : 45;

  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, clientBoxHeight, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', margin + 5, currentY + 8);

  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  let clientY = currentY + 15;
  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Nome:', col1X, clientY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.client.name || '-', col1X + 20, clientY);

  if (data.client.phone) {
    doc.setFont('helvetica', 'bold');
    doc.text('Telefone:', col2X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.phone, col2X + 25, clientY);
  }

  clientY += 8;

  if (data.client.cpf) {
    doc.setFont('helvetica', 'bold');
    doc.text('CPF:', col1X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.cpf, col1X + 15, clientY);
  }

  if (data.client.rg) {
    doc.setFont('helvetica', 'bold');
    doc.text('RG:', col2X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.rg, col2X + 12, clientY);
  }

  clientY += 8;

  if (data.client.email) {
    doc.setFont('helvetica', 'bold');
    doc.text('E-mail:', col1X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.email, col1X + 20, clientY);
  }

  clientY += 8;

  if (hasAddress) {
    doc.setFont('helvetica', 'bold');
    doc.text('Endereço:', col1X, clientY);
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(data.client.address!, addressMaxWidth);
    // Show up to 3 lines of address
    addressLines.slice(0, 3).forEach((line: string, index: number) => {
      if (index === 0) {
        doc.text(line, col1X + 28, clientY);
      } else {
        doc.text(line, col1X + 28, clientY + (index * 5));
      }
    });
  }

  currentY += clientBoxHeight + 7;

  // === VEHICLE INFO (if applicable) ===
  if (data.type === 'vehicle' && data.vehicleInfo) {
    doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 32, 2, 2, 'S');

    doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO VEÍCULO', margin + 5, currentY + 8);

    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFontSize(9);

    let vehY = currentY + 15;
    doc.setFont('helvetica', 'bold');
    doc.text('Veículo:', col1X, vehY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.vehicleInfo.brand} ${data.vehicleInfo.model} ${data.vehicleInfo.year}`, col1X + 22, vehY);

    if (data.vehicleInfo.plate) {
      doc.setFont('helvetica', 'bold');
      doc.text('Placa:', col2X, vehY);
      doc.setFont('helvetica', 'normal');
      doc.text(data.vehicleInfo.plate, col2X + 18, vehY);
    }

    vehY += 8;

    if (data.vehicleInfo.color) {
      doc.setFont('helvetica', 'bold');
      doc.text('Cor:', col1X, vehY);
      doc.setFont('helvetica', 'normal');
      doc.text(data.vehicleInfo.color, col1X + 12, vehY);
    }

    if (data.vehicleInfo.chassis) {
      doc.setFont('helvetica', 'bold');
      doc.text('Chassi:', col2X, vehY);
      doc.setFont('helvetica', 'normal');
      doc.text(data.vehicleInfo.chassis, col2X + 20, vehY);
    }

    currentY += 38;
  }

  // === PRODUCT INFO (if applicable) ===
  if (data.type === 'product' && data.productInfo) {
    doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 20, 2, 2, 'S');

    doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PRODUTO', margin + 5, currentY + 8);

    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(data.productInfo.name, margin + 5, currentY + 15);

    currentY += 26;
  }

  // === NEGOTIATION DATA ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 45, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DA NEGOCIAÇÃO', margin + 5, currentY + 8);

  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(9);

  let negY = currentY + 15;

  // First row
  doc.setFont('helvetica', 'bold');
  doc.text(data.type === 'loan' ? 'Valor Emprestado:' : 'Valor Total:', col1X, negY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(data.negotiation.principal), col1X + (data.type === 'loan' ? 45 : 32), negY);

  if (data.negotiation.interestRate !== undefined && data.type === 'loan') {
    doc.setFont('helvetica', 'bold');
    doc.text('Taxa de Juros:', col2X, negY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${data.negotiation.interestRate.toFixed(2)}%`, col2X + 38, negY);
  }

  negY += 8;

  // Second row
  doc.setFont('helvetica', 'bold');
  doc.text('Parcelas:', col1X, negY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.negotiation.installments}x de ${formatCurrency(data.negotiation.installmentValue)}`, col1X + 25, negY);

  // Usar contractDate se disponível, senão startDate
  const contractDateDisplay = data.negotiation.contractDate || data.negotiation.startDate;
  doc.setFont('helvetica', 'bold');
  doc.text('Data Contrato:', col2X, negY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(contractDateDisplay), col2X + 35, negY);

  negY += 8;

  // Third row - Total with highlight
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(col1X - 2, negY - 5, 85, 10, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.text('Total a Receber:', col1X, negY);
  doc.setFontSize(10);
  doc.text(formatCurrency(data.negotiation.totalToReceive), col1X + 40, negY);

  if (data.negotiation.downPayment && data.negotiation.downPayment > 0) {
    doc.setFontSize(9);
    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFont('helvetica', 'bold');
    doc.text('Entrada:', col2X, negY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(data.negotiation.downPayment), col2X + 22, negY);
  }

  currentY += 52;

  // === INTEREST ONLY PAYMENT INFO (if applicable) ===
  if (data.interestOnlyPayment) {
    const PURPLE = { r: 168, g: 85, b: 247 }; // #a855f7
    const LIGHT_PURPLE_BG = { r: 245, g: 235, b: 255 }; // light purple bg
    
    doc.setDrawColor(PURPLE.r, PURPLE.g, PURPLE.b);
    doc.setFillColor(LIGHT_PURPLE_BG.r, LIGHT_PURPLE_BG.g, LIGHT_PURPLE_BG.b);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 40, 2, 2, 'FD');

    doc.setTextColor(PURPLE.r, PURPLE.g, PURPLE.b);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGAMENTO DE JUROS', margin + 5, currentY + 8);

    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFontSize(9);

    let payY = currentY + 16;

    doc.setFont('helvetica', 'bold');
    doc.text('Valor Pago:', col1X, payY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PURPLE.r, PURPLE.g, PURPLE.b);
    doc.text(formatCurrency(data.interestOnlyPayment.amountPaid), col1X + 28, payY);

    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFont('helvetica', 'bold');
    doc.text('Data:', col2X, payY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(data.interestOnlyPayment.paymentDate), col2X + 15, payY);

    payY += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Valor Restante:', col1X, payY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(PURPLE.r, PURPLE.g, PURPLE.b);
    doc.text(formatCurrency(data.interestOnlyPayment.remainingBalance), col1X + 38, payY);

    doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
    doc.setFontSize(7);
    payY += 8;
    doc.text('* Este pagamento corresponde apenas aos juros. O valor principal permanece inalterado.', margin + 5, payY);

    currentY += 48;
  }

  // === DUE DATES ===
  if (data.dueDates.length > 0) {
    const datesPerRow = 3;
    const rowHeight = 7;
    const headerHeight = 15;
    const maxRowsPerPage = 8; // 24 parcelas por seção antes de pular página
    const colWidth = (pageWidth - 2 * margin) / datesPerRow;
    
    let dateIndex = 0;
    let isFirstSection = true;
    
    while (dateIndex < data.dueDates.length) {
      const remainingDates = data.dueDates.length - dateIndex;
      const datesToShowThisSection = Math.min(remainingDates, maxRowsPerPage * datesPerRow);
      const rowsToShow = Math.ceil(datesToShowThisSection / datesPerRow);
      const datesBoxHeight = rowsToShow * rowHeight + headerHeight;
      
      // Verificar se precisa nova página
      if (currentY + datesBoxHeight > 250) {
        doc.addPage();
        currentY = 20;
      }
      
      // Desenhar caixa de fundo
      doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
      doc.roundedRect(margin, currentY, pageWidth - 2 * margin, datesBoxHeight, 2, 2, 'F');

      // Header
      doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const headerText = isFirstSection ? 'DATAS DE VENCIMENTO' : 'DATAS DE VENCIMENTO (continuação)';
      doc.text(headerText, margin + 5, currentY + 8);

      // Datas
      doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');

      const dateY = currentY + 15;
      
      for (let i = 0; i < datesToShowThisSection; i++) {
        const globalIndex = dateIndex + i;
        const item = data.dueDates[globalIndex];
        const col = i % datesPerRow;
        const row = Math.floor(i / datesPerRow);
        const x = margin + 5 + col * colWidth;
        const y = dateY + row * rowHeight;
        const dateStr = typeof item === 'string' ? item : item.date;
        const isPaid = typeof item === 'object' && item.isPaid;
        const prefix = isPaid ? '✓ ' : '';
        doc.text(`${prefix}${globalIndex + 1}ª: ${formatDate(dateStr)}`, x, y);
      }

      currentY += datesBoxHeight + 8;
      dateIndex += datesToShowThisSection;
      isFirstSection = false;
    }
  }

  // === SIGNATURES ===
  currentY = Math.max(currentY, 220);

  doc.setDrawColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setLineWidth(0.3);
  
  const sigWidth = 70;
  const sig1X = margin + 15;
  const sig2X = pageWidth - margin - sigWidth - 15;

  doc.line(sig1X, currentY, sig1X + sigWidth, currentY);
  doc.line(sig2X, currentY, sig2X + sigWidth, currentY);

  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setFontSize(8);
  doc.text('Assinatura do Cliente', sig1X + sigWidth / 2, currentY + 5, { align: 'center' });
  doc.text('Assinatura da Empresa', sig2X + sigWidth / 2, currentY + 5, { align: 'center' });

  // === FOOTER BAR ===
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, footerY, pageWidth, 15, 'F');

  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(8);
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, footerY + 9);
  doc.text('CobraFácil - Sistema de Gestão de Cobranças', pageWidth - margin, footerY + 9, { align: 'right' });

  // Download
  const fileName = `comprovante-${getContractPrefix(data.type).toLowerCase()}-${data.contractId.substring(0, 8)}.pdf`;
  doc.save(fileName);
};

export const generatePaymentReceipt = async (data: PaymentReceiptData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let currentY = 0;

  // Load logo (custom or default)
  let logoBase64 = '';
  try {
    logoBase64 = await loadLogoAsBase64(data.customLogoUrl);
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  // === HEADER BAR ===
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 5, 40, 25);
  } else {
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CobraFácil', margin, 22);
  }

  // Company name on the right
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.companyName) {
    doc.text(data.companyName, pageWidth - margin, 15, { align: 'right' });
  }

  currentY = 45;

  // === DOCUMENT TITLE ===
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 18, 3, 3, 'F');
  
  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROVANTE DE PAGAMENTO', pageWidth / 2, currentY + 8, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const contractNumber = `Contrato: ${getContractPrefix(data.type)}-${data.contractId.substring(0, 8).toUpperCase()}`;
  doc.text(contractNumber, pageWidth / 2, currentY + 14, { align: 'center' });

  currentY += 28;

  // === PAYMENT INFO ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 70, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO PAGAMENTO', margin + 5, currentY + 8);

  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(10);

  let payY = currentY + 18;
  const col1X = margin + 5;

  // Client
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', col1X, payY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientName, col1X + 22, payY);

  payY += 10;

  // Installment
  doc.setFont('helvetica', 'bold');
  doc.text('Parcela:', col1X, payY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.installmentNumber}ª de ${data.totalInstallments}`, col1X + 22, payY);

  payY += 10;

  // Payment date
  doc.setFont('helvetica', 'bold');
  doc.text('Data do Pagamento:', col1X, payY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(data.paymentDate), col1X + 50, payY);

  payY += 12;

  // Amount paid - highlighted
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(col1X - 2, payY - 5, 100, 12, 1, 1, 'F');

  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Valor Pago:', col1X, payY);
  doc.setFontSize(14);
  doc.text(formatCurrency(data.amountPaid), col1X + 32, payY);

  payY += 14;

  // Multa inclusa (se houver)
  if (data.penaltyAmount && data.penaltyAmount > 0) {
    doc.setTextColor(200, 50, 50); // Vermelho para multa
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Multa Inclusa:', col1X, payY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(data.penaltyAmount), col1X + 38, payY);
    payY += 10;
  }

  // Total do contrato (principal + juros)
  if (data.totalContract) {
    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Total do Contrato:', col1X, payY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(data.totalContract), col1X + 48, payY);
    payY += 10;
  }

  // Total pago até agora
  if (data.totalPaid) {
    doc.setFont('helvetica', 'bold');
    doc.text('Total Pago:', col1X, payY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(data.totalPaid), col1X + 30, payY);
    payY += 10;
  }

  // Remaining balance
  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Saldo Restante:', col1X, payY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(data.remainingBalance), col1X + 42, payY);

  currentY += 80;

  // === STATUS MESSAGE ===
  const isTotallyPaid = data.remainingBalance <= 0;
  
  doc.setFillColor(
    isTotallyPaid ? PRIMARY_GREEN.r : LIGHT_GREEN_BG.r,
    isTotallyPaid ? PRIMARY_GREEN.g : LIGHT_GREEN_BG.g,
    isTotallyPaid ? PRIMARY_GREEN.b : LIGHT_GREEN_BG.b
  );
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 20, 2, 2, 'F');

  doc.setTextColor(isTotallyPaid ? WHITE.r : DARK_GREEN.r, isTotallyPaid ? WHITE.g : DARK_GREEN.g, isTotallyPaid ? WHITE.b : DARK_GREEN.b);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  
  const statusText = isTotallyPaid ? '✓ CONTRATO QUITADO' : `Pagamento da ${data.installmentNumber}ª parcela confirmado`;
  doc.text(statusText, pageWidth / 2, currentY + 12, { align: 'center' });

  currentY += 35;

  // === SIGNATURES ===
  doc.setDrawColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setLineWidth(0.3);
  
  const sigWidth = 70;
  const sig1X = margin + 15;
  const sig2X = pageWidth - margin - sigWidth - 15;

  doc.line(sig1X, currentY, sig1X + sigWidth, currentY);
  doc.line(sig2X, currentY, sig2X + sigWidth, currentY);

  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setFontSize(8);
  doc.text('Assinatura do Cliente', sig1X + sigWidth / 2, currentY + 5, { align: 'center' });
  doc.text('Assinatura da Empresa', sig2X + sigWidth / 2, currentY + 5, { align: 'center' });

  // === FOOTER BAR ===
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, footerY, pageWidth, 15, 'F');

  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(8);
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, footerY + 9);
  doc.text('CobraFácil - Sistema de Gestão de Cobranças', pageWidth - margin, footerY + 9, { align: 'right' });

  // Download
  const fileName = `pagamento-${getContractPrefix(data.type).toLowerCase()}-${data.contractId.substring(0, 8)}-parcela${data.installmentNumber}.pdf`;
  doc.save(fileName);
};

// Interface for installment details
export interface InstallmentDetail {
  number: number;
  dueDate: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  paidDate?: string;
  paidAmount?: number;
}

// Interface for complete operations report
export interface LoanOperationData {
  id: string;
  clientName: string;
  principalAmount: number;
  interestRate: number;
  interestMode: string;
  installments: number;
  totalInterest: number;
  totalToReceive: number;
  totalPaid: number;
  remainingBalance: number;
  status: string;
  startDate: string;
  dueDate: string;
  paymentType: string;
  paidInstallments: number;
  pendingInstallments: number;
  overdueInstallments: number;
  installmentDetails: InstallmentDetail[];
  payments: {
    date: string;
    amount: number;
    principalPaid: number;
    interestPaid: number;
    notes?: string;
  }[];
}

export interface OperationsReportData {
  companyName: string;
  userName: string;
  generatedAt: string;
  loans: LoanOperationData[];
  summary: {
    totalLoans: number;
    totalLent: number;
    totalInterest: number;
    totalToReceive: number;
    totalReceived: number;
    totalPending: number;
    paidLoans: number;
    pendingLoans: number;
    overdueLoans: number;
  };
}

export const generateOperationsReport = async (data: OperationsReportData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = 0;
  let pageNumber = 1;

  // Dark background color (matching platform theme)
  const DARK_BG = { r: 17, g: 24, b: 39 }; // slate-900
  const CARD_BG = { r: 30, g: 41, b: 59 }; // slate-800

  // Load logo
  let logoBase64 = '';
  try {
    logoBase64 = await loadLogoAsBase64();
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  const drawBackground = () => {
    doc.setFillColor(DARK_BG.r, DARK_BG.g, DARK_BG.b);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const addHeader = () => {
    // Green header pill
    doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.roundedRect(margin, 10, pageWidth - 2 * margin, 25, 5, 5, 'F');

    // Logo or company name centered
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CobraFácil', pageWidth / 2, 22, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(data.companyName || data.userName, pageWidth / 2, 30, { align: 'center' });
  };

  const addFooter = () => {
    // Green footer pill
    doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.roundedRect(margin, pageHeight - 20, pageWidth - 2 * margin, 12, 3, 3, 'F');

    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(8);
    doc.text('CobraFácil - Sistema de Gestão de Cobranças', pageWidth / 2, pageHeight - 12, { align: 'center' });
    doc.setFontSize(6);
    doc.text(`Página ${pageNumber} | Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
  };

  const checkNewPage = (neededSpace: number) => {
    if (currentY + neededSpace > pageHeight - 30) {
      addFooter();
      doc.addPage();
      pageNumber++;
      drawBackground();
      addHeader();
      currentY = 50;
    }
  };

  const drawSectionHeader = (title: string, y: number) => {
    doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 8, 2, 2, 'F');
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 5, y + 5.5);
    return y + 10;
  };

  // === FIRST PAGE ===
  drawBackground();
  addHeader();
  currentY = 45;

  // === REPORT TITLE (pill style) ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setLineWidth(1);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 14, 3, 3, 'S');
  
  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE OPERAÇÕES - EMPRÉSTIMOS', pageWidth / 2, currentY + 9, { align: 'center' });

  currentY += 22;

  // === SUMMARY SECTION ===
  currentY = drawSectionHeader('RESUMO GERAL', currentY);

  // Summary card with dark background
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setLineWidth(0.5);
  doc.setFillColor(CARD_BG.r, CARD_BG.g, CARD_BG.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 45, 2, 2, 'FD');

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  let summaryY = currentY + 10;
  const col1X = margin + 8;
  const col2X = margin + 65;
  const col3X = margin + 125;

  // Row 1
  doc.text('Total de Contratos:', col1X, summaryY);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont('helvetica', 'bold');
  doc.text(data.summary.totalLoans.toString(), col1X + 42, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Emprestado:', col2X, summaryY);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.summary.totalLent), col2X + 40, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Total de Juros:', col3X, summaryY);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.summary.totalInterest), col3X + 32, summaryY);

  summaryY += 12;

  // Row 2
  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Total a Receber:', col1X, summaryY);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.summary.totalToReceive), col1X + 36, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Recebido:', col2X, summaryY);
  doc.setTextColor(34, 197, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.summary.totalReceived), col2X + 34, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Pendente:', col3X, summaryY);
  doc.setTextColor(239, 68, 68);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.summary.totalPending), col3X + 22, summaryY);

  summaryY += 12;

  // Row 3 - Status counts
  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Pagos:', col1X, summaryY);
  doc.setTextColor(34, 197, 94);
  doc.setFont('helvetica', 'bold');
  doc.text(data.summary.paidLoans.toString(), col1X + 16, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Pendentes:', col2X, summaryY);
  doc.setTextColor(234, 179, 8);
  doc.setFont('helvetica', 'bold');
  doc.text(data.summary.pendingLoans.toString(), col2X + 25, summaryY);

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.text('Em Atraso:', col3X, summaryY);
  doc.setTextColor(239, 68, 68);
  doc.setFont('helvetica', 'bold');
  doc.text(data.summary.overdueLoans.toString(), col3X + 25, summaryY);

  currentY += 55;

  // === LOANS LIST ===
  currentY = drawSectionHeader('DETALHAMENTO DOS CONTRATOS', currentY);

  for (const loan of data.loans) {
    // Calculate needed space for this loan card
    const installmentTableHeight = loan.installmentDetails.length > 0 
      ? Math.min(loan.installmentDetails.length, 20) * 6 + 20 
      : 0;
    const neededSpace = 70 + installmentTableHeight;
    checkNewPage(neededSpace);

    // Loan card with status color header
    const statusColor = loan.status === 'paid' ? { r: 34, g: 197, b: 94 } : 
                       loan.status === 'overdue' ? { r: 239, g: 68, b: 68 } : 
                       loan.status === 'interest_only' ? { r: 168, g: 85, b: 247 } :
                       { r: 234, g: 179, b: 8 };

    // Card header with status
    doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 9, 2, 2, 'F');

    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const statusText = loan.status === 'paid' ? 'QUITADO' : 
                      loan.status === 'overdue' ? 'EM ATRASO' : 
                      loan.status === 'interest_only' ? 'SÓ JUROS' : 'PENDENTE';
    doc.text(`EMP-${loan.id.substring(0, 8).toUpperCase()} | ${loan.clientName}`, margin + 5, currentY + 6);
    doc.text(statusText, pageWidth - margin - 5, currentY + 6, { align: 'right' });

    currentY += 11;

    // Values card
    doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.setLineWidth(0.5);
    doc.setFillColor(CARD_BG.r, CARD_BG.g, CARD_BG.b);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 38, 2, 2, 'FD');

    doc.setFontSize(8);
    let detailY = currentY + 8;
    const dcol1 = margin + 8;
    const dcol2 = margin + 55;
    const dcol3 = margin + 105;
    const dcol4 = margin + 150;

    // Row 1: Emprestado | Juros | Total | Recebido
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('Emprestado:', dcol1, detailY);
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(loan.principalAmount), dcol1, detailY + 5);

    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('Juros:', dcol2, detailY);
    doc.setTextColor(234, 179, 8);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(loan.totalInterest), dcol2, detailY + 5);

    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('Total:', dcol3, detailY);
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(loan.totalToReceive), dcol3, detailY + 5);

    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('Recebido:', dcol4, detailY);
    doc.setTextColor(34, 197, 94);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(loan.totalPaid), dcol4, detailY + 5);

    detailY += 16;

    // Row 2: Taxa | Tipo | Início | Saldo Restante
    const paymentTypeLabel = loan.paymentType === 'single' ? 'Único' : 
                            loan.paymentType === 'installment' ? 'Parcelado' :
                            loan.paymentType === 'daily' ? 'Diário' :
                            loan.paymentType === 'weekly' ? 'Semanal' :
                            loan.paymentType === 'biweekly' ? 'Quinzenal' : loan.paymentType;
    
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(`Taxa: ${loan.interestRate.toFixed(1)}%`, dcol1, detailY);

    doc.text(`Tipo: ${paymentTypeLabel}`, dcol2, detailY);
    doc.text(`Início: ${formatDate(loan.startDate)}`, dcol3, detailY);

    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('Saldo:', dcol4, detailY);
    doc.setTextColor(loan.remainingBalance > 0 ? 239 : 34, loan.remainingBalance > 0 ? 68 : 197, loan.remainingBalance > 0 ? 68 : 94);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(loan.remainingBalance), dcol4 + 15, detailY);

    detailY += 10;

    // Row 3: Installments progress
    const progressPercent = loan.installments > 0 ? Math.round((loan.paidInstallments / loan.installments) * 100) : 0;
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(`Parcelas: `, dcol1, detailY);
    doc.setTextColor(34, 197, 94);
    doc.setFont('helvetica', 'bold');
    doc.text(`${loan.paidInstallments}`, dcol1 + 20, detailY);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(` de ${loan.installments} pagas (${progressPercent}%)`, dcol1 + 24, detailY);

    if (loan.overdueInstallments > 0) {
      doc.setTextColor(239, 68, 68);
      doc.setFont('helvetica', 'bold');
      doc.text(`| ${loan.overdueInstallments} atrasada(s)`, dcol2 + 25, detailY);
    }

    currentY += 42;

    // === INSTALLMENTS TABLE ===
    if (loan.installmentDetails.length > 0) {
      checkNewPage(loan.installmentDetails.length * 6 + 18);
      
      // Table header
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 7, 1, 1, 'F');
      
      doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('#', margin + 5, currentY + 5);
      doc.text('VENCIMENTO', margin + 18, currentY + 5);
      doc.text('VALOR', margin + 55, currentY + 5);
      doc.text('STATUS', margin + 95, currentY + 5);
      doc.text('DATA PGTO', margin + 135, currentY + 5);
      
      currentY += 8;
      
      // Table rows
      const maxInstallmentsToShow = 20;
      const installmentsToShow = loan.installmentDetails.slice(0, maxInstallmentsToShow);
      
      for (const inst of installmentsToShow) {
        // Alternate row background
        if (inst.number % 2 === 0) {
          doc.setFillColor(25, 35, 50);
          doc.rect(margin, currentY - 3, pageWidth - 2 * margin, 6, 'F');
        }
        
        doc.setFontSize(7);
        doc.setTextColor(200, 200, 200);
        doc.setFont('helvetica', 'normal');
        doc.text(`${inst.number}ª`, margin + 5, currentY);
        doc.text(formatDate(inst.dueDate), margin + 18, currentY);
        doc.text(formatCurrency(inst.amount), margin + 55, currentY);
        
        // Status with color and symbol
        if (inst.status === 'paid') {
          doc.setTextColor(34, 197, 94);
          doc.setFont('helvetica', 'bold');
          doc.text('PAGO', margin + 95, currentY);
        } else if (inst.status === 'overdue') {
          doc.setTextColor(239, 68, 68);
          doc.setFont('helvetica', 'bold');
          doc.text('ATRASADO', margin + 95, currentY);
        } else {
          doc.setTextColor(234, 179, 8);
          doc.setFont('helvetica', 'normal');
          doc.text('PENDENTE', margin + 95, currentY);
        }
        
        // Payment date
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        if (inst.paidDate) {
          doc.text(formatDate(inst.paidDate), margin + 135, currentY);
        } else {
          doc.text('-', margin + 135, currentY);
        }
        
        currentY += 6;
      }
      
      // Show "more" indicator if truncated
      if (loan.installmentDetails.length > maxInstallmentsToShow) {
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(6);
        doc.text(`... e mais ${loan.installmentDetails.length - maxInstallmentsToShow} parcela(s)`, margin + 5, currentY);
        currentY += 5;
      }
    }

    currentY += 8;
  }

  addFooter();

  // Download
  const fileName = `relatorio-operacoes-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

// Interface for client-facing sale receipt (WITHOUT cost/profit)
export interface ClientSaleReceiptData {
  contractId: string;
  companyName: string;
  customLogoUrl?: string | null; // Custom company logo for PDF
  client: {
    name: string;
    phone?: string;
    cpf?: string;
    rg?: string;
    email?: string;
    address?: string;
  };
  product: {
    name: string;
    description?: string;
  };
  sale: {
    totalAmount: number;
    downPayment: number;
    installments: number;
    installmentValue: number;
    saleDate: string;
  };
  dueDates: string[];
}

// Generate client-facing sale receipt PDF (WITHOUT cost/profit info)
export const generateClientSaleReceipt = async (data: ClientSaleReceiptData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let currentY = 0;

  // Load logo (custom or default)
  let logoBase64 = '';
  try {
    logoBase64 = await loadLogoAsBase64(data.customLogoUrl);
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  // === HEADER BAR ===
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 5, 40, 25);
  } else {
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CobraFácil', margin, 22);
  }

  // Company name on the right
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.companyName) {
    doc.text(data.companyName, pageWidth - margin, 15, { align: 'right' });
  }

  currentY = 45;

  // === DOCUMENT TITLE ===
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 18, 3, 3, 'F');
  
  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROVANTE DE VENDA', pageWidth / 2, currentY + 8, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const contractNumber = `Nº: PRD-${data.contractId.substring(0, 8).toUpperCase()}`;
  doc.text(contractNumber, pageWidth / 2, currentY + 14, { align: 'center' });

  currentY += 25;

  // === CLIENT DATA SECTION ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 45, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', margin + 5, currentY + 8);

  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  let clientY = currentY + 15;
  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Nome:', col1X, clientY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.client.name || '-', col1X + 20, clientY);

  if (data.client.phone) {
    doc.setFont('helvetica', 'bold');
    doc.text('Telefone:', col2X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.phone, col2X + 25, clientY);
  }

  clientY += 8;

  if (data.client.cpf) {
    doc.setFont('helvetica', 'bold');
    doc.text('CPF:', col1X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.cpf, col1X + 15, clientY);
  }

  if (data.client.rg) {
    doc.setFont('helvetica', 'bold');
    doc.text('RG:', col2X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.rg, col2X + 12, clientY);
  }

  clientY += 8;

  if (data.client.email) {
    doc.setFont('helvetica', 'bold');
    doc.text('E-mail:', col1X, clientY);
    doc.setFont('helvetica', 'normal');
    doc.text(data.client.email, col1X + 20, clientY);
  }

  clientY += 8;

  if (data.client.address) {
    doc.setFont('helvetica', 'bold');
    doc.text('Endereço:', col1X, clientY);
    doc.setFont('helvetica', 'normal');
    const maxWidth = pageWidth - 2 * margin - 35;
    const addressLines = doc.splitTextToSize(data.client.address, maxWidth);
    doc.text(addressLines[0] || '-', col1X + 28, clientY);
  }

  currentY += 52;

  // === PRODUCT INFO ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 20, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRODUTO', margin + 5, currentY + 8);

  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(data.product.name, margin + 5, currentY + 15);

  currentY += 26;

  // === SALE DATA (WITHOUT cost/profit) ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 40, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DA VENDA', margin + 5, currentY + 8);

  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(9);

  let saleY = currentY + 16;

  // First row - Total value
  doc.setFont('helvetica', 'bold');
  doc.text('Valor Total:', col1X, saleY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(data.sale.totalAmount), col1X + 32, saleY);

  doc.setFont('helvetica', 'bold');
  doc.text('Data da Venda:', col2X, saleY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(data.sale.saleDate), col2X + 42, saleY);

  saleY += 8;

  // Second row - Installments
  doc.setFont('helvetica', 'bold');
  doc.text('Parcelas:', col1X, saleY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.sale.installments}x de ${formatCurrency(data.sale.installmentValue)}`, col1X + 25, saleY);

  if (data.sale.downPayment > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Entrada:', col2X, saleY);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(data.sale.downPayment), col2X + 22, saleY);
  }

  currentY += 48;

  // === DUE DATES ===
  if (data.dueDates.length > 0) {
    const datesBoxHeight = Math.min(Math.ceil(data.dueDates.length / 3) * 8 + 15, 50);
    
    doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
    doc.roundedRect(margin, currentY, pageWidth - 2 * margin, datesBoxHeight, 2, 2, 'F');

    doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DATAS DE VENCIMENTO', margin + 5, currentY + 8);

    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    let dateY = currentY + 15;
    const colWidth = (pageWidth - 2 * margin) / 3;
    
    data.dueDates.slice(0, 15).forEach((date, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = margin + 5 + col * colWidth;
      const y = dateY + row * 7;
      
      doc.text(`${index + 1}ª: ${formatDate(date)}`, x, y);
    });

    if (data.dueDates.length > 15) {
      doc.text(`... e mais ${data.dueDates.length - 15} parcela(s)`, margin + 5, dateY + Math.ceil(15 / 3) * 7);
    }

    currentY += datesBoxHeight + 8;
  }

  // === SIGNATURES ===
  currentY = Math.max(currentY, 220);

  doc.setDrawColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setLineWidth(0.3);
  
  const sigWidth = 70;
  const sig1X = margin + 15;
  const sig2X = pageWidth - margin - sigWidth - 15;

  doc.line(sig1X, currentY, sig1X + sigWidth, currentY);
  doc.line(sig2X, currentY, sig2X + sigWidth, currentY);

  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setFontSize(8);
  doc.text('Assinatura do Cliente', sig1X + sigWidth / 2, currentY + 5, { align: 'center' });
  doc.text('Assinatura da Empresa', sig2X + sigWidth / 2, currentY + 5, { align: 'center' });

  // === FOOTER BAR ===
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, footerY, pageWidth, 15, 'F');

  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(8);
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, footerY + 9);
  doc.text('CobraFácil - Sistema de Gestão de Cobranças', pageWidth - margin, footerY + 9, { align: 'right' });

  // Download
  const fileName = `comprovante-venda-${data.contractId.substring(0, 8)}.pdf`;
  doc.save(fileName);
};

// ===================== SIMULATION PDF =====================

export const generateSimulationPDF = async (data: SimulationPDFData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let currentY = 0;

  // Load logo (custom or default)
  let logoBase64 = '';
  try {
    logoBase64 = await loadLogoAsBase64(data.customLogoUrl);
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  // Color definitions for interest modes
  const CYAN = { r: 34, g: 211, b: 238 }; // cyan-400
  const YELLOW = { r: 250, g: 204, b: 21 }; // yellow-400
  const LIGHT_CYAN_BG = { r: 207, g: 250, b: 254 }; // cyan-100
  const LIGHT_YELLOW_BG = { r: 254, g: 249, b: 195 }; // yellow-100

  const getInterestModeColor = () => {
    if (data.interestMode.includes('Compostos')) return CYAN;
    if (data.interestMode.includes('Total')) return YELLOW;
    return PRIMARY_GREEN;
  };

  const getInterestModeBg = () => {
    if (data.interestMode.includes('Compostos')) return LIGHT_CYAN_BG;
    if (data.interestMode.includes('Total')) return LIGHT_YELLOW_BG;
    return LIGHT_GREEN_BG;
  };

  const modeColor = getInterestModeColor();
  const modeBg = getInterestModeBg();

  // === HEADER BAR ===
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 5, 40, 25);
  } else {
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CobraFácil', margin, 22);
  }

  // Company name on the right
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.companyName) {
    doc.text(data.companyName, pageWidth - margin, 15, { align: 'right' });
  }
  doc.text('Simulação de Empréstimo', pageWidth - margin, 25, { align: 'right' });

  currentY = 45;

  // === DOCUMENT TITLE ===
  doc.setFillColor(modeBg.r, modeBg.g, modeBg.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 18, 3, 3, 'F');
  
  doc.setTextColor(modeColor.r, modeColor.g, modeColor.b);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SIMULAÇÃO DE EMPRÉSTIMO', pageWidth / 2, currentY + 8, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerada em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, currentY + 14, { align: 'center' });

  currentY += 28;

  // === CONFIGURATION SECTION ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 40, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFIGURAÇÃO', margin + 5, currentY + 8);

  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(9);

  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 5;
  let configY = currentY + 16;

  doc.setFont('helvetica', 'bold');
  doc.text('Tipo de Pagamento:', col1X, configY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.paymentType, col1X + 48, configY);

  doc.setFont('helvetica', 'bold');
  doc.text('Modo de Juros:', col2X, configY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.interestMode, col2X + 40, configY);

  configY += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Data de Início:', col1X, configY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.startDate, col1X + 35, configY);

  doc.setFont('helvetica', 'bold');
  doc.text('Primeiro Vencimento:', col2X, configY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.firstDueDate || data.startDate, col2X + 52, configY);

  configY += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Nº de Parcelas:', col1X, configY);
  doc.setFont('helvetica', 'normal');
  doc.text(String(data.installments), col1X + 40, configY);

  currentY += 48;

  // === SIMULATION DATA SECTION ===
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 28, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DA SIMULAÇÃO', margin + 5, currentY + 8);

  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(9);

  let dataY = currentY + 16;

  doc.setFont('helvetica', 'bold');
  doc.text('Valor do Empréstimo:', col1X, dataY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatCurrency(data.principal), col1X + 50, dataY);

  doc.setFont('helvetica', 'bold');
  doc.text('Taxa de Juros:', col2X, dataY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.interestRate.toFixed(2)}%`, col2X + 38, dataY);

  currentY += 36;

  // === RESULTS SECTION ===
  doc.setFillColor(modeBg.r, modeBg.g, modeBg.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 45, 2, 2, 'F');

  doc.setTextColor(modeColor.r, modeColor.g, modeColor.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESULTADO', margin + 5, currentY + 8);

  doc.setFontSize(10);

  let resultY = currentY + 18;

  // Row 1
  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFont('helvetica', 'bold');
  doc.text('Valor da Parcela:', col1X, resultY);
  doc.setTextColor(modeColor.r, modeColor.g, modeColor.b);
  doc.setFontSize(12);
  doc.text(formatCurrency(data.installmentValue), col1X + 45, resultY);

  doc.setFontSize(10);
  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFont('helvetica', 'bold');
  doc.text('Total de Juros:', col2X, resultY);
  doc.setTextColor(250, 204, 21); // warning color
  doc.text(formatCurrency(data.totalInterest), col2X + 38, resultY);

  resultY += 12;

  // Row 2
  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFont('helvetica', 'bold');
  doc.text('Total a Receber:', col1X, resultY);
  doc.setTextColor(34, 197, 94); // success color
  doc.setFontSize(14);
  doc.text(formatCurrency(data.totalAmount), col1X + 45, resultY);

  doc.setFontSize(10);
  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFont('helvetica', 'bold');
  doc.text('Taxa Efetiva:', col2X, resultY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.effectiveRate.toFixed(1)}%`, col2X + 32, resultY);

  currentY += 55;

  // === INSTALLMENT SCHEDULE ===
  const scheduleHeight = Math.min(data.schedule.length * 7 + 20, 90);
  
  doc.setDrawColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, scheduleHeight, 2, 2, 'S');

  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CRONOGRAMA DE PARCELAS', margin + 5, currentY + 8);

  doc.setFontSize(8);
  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);

  let scheduleY = currentY + 16;
  const scheduleCol1 = margin + 10;
  const scheduleCol2 = margin + 50;
  const scheduleCol3 = margin + 100;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.text('Parcela', scheduleCol1, scheduleY);
  doc.text('Vencimento', scheduleCol2, scheduleY);
  doc.text('Valor', scheduleCol3, scheduleY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);

  scheduleY += 5;
  const maxItems = Math.min(data.schedule.length, 10);
  
  for (let i = 0; i < maxItems; i++) {
    const item = data.schedule[i];
    scheduleY += 6;
    doc.text(`${item.number}/${data.installments}`, scheduleCol1, scheduleY);
    doc.text(item.dueDate, scheduleCol2, scheduleY);
    doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.text(formatCurrency(item.total), scheduleCol3, scheduleY);
    doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  }

  if (data.schedule.length > 10) {
    scheduleY += 6;
    doc.text(`... e mais ${data.schedule.length - 10} parcela(s)`, scheduleCol1, scheduleY);
  }

  currentY += scheduleHeight + 10;

  // === DISCLAIMER ===
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 15, 2, 2, 'F');
  
  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text('⚠️ Este documento é apenas uma simulação e não representa um contrato oficial.', pageWidth / 2, currentY + 6, { align: 'center' });
  doc.text('Os valores podem variar no momento da contratação do empréstimo.', pageWidth / 2, currentY + 11, { align: 'center' });

  // === FOOTER BAR ===
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, footerY, pageWidth, 15, 'F');

  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('CobraFácil - Simulação de Empréstimo', margin, footerY + 9);
  doc.text(`${data.installments}x de ${formatCurrency(data.installmentValue)} = ${formatCurrency(data.totalAmount)}`, pageWidth - margin, footerY + 9, { align: 'right' });

  // Download
  const fileName = `simulacao-emprestimo-${data.principal}-${data.installments}x.pdf`;
  doc.save(fileName);
};

// ==================== PRICE TABLE PDF ====================

export interface PriceTablePDFData {
  companyName?: string;
  customLogoUrl?: string | null; // Custom company logo for PDF
  clientName?: string;
  principal: number;
  interestRate: number;
  installments: number;
  pmt: number;
  rows: Array<{
    installmentNumber: number;
    payment: number;
    amortization: number;
    interest: number;
    balance: number;
  }>;
  totalPayment: number;
  totalInterest: number;
  installmentDates?: string[];
}

export const generatePriceTablePDF = async (data: PriceTablePDFData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let currentY = 0;

  // Load logo (custom or default)
  let logoBase64 = '';
  try {
    logoBase64 = await loadLogoAsBase64(data.customLogoUrl);
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  // === HEADER BAR ===
  doc.setFillColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // Logo
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 5, 40, 25);
  } else {
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CobraFácil', margin, 22);
  }

  // Company name on the right
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (data.companyName) {
    doc.text(data.companyName, pageWidth - margin, 15, { align: 'right' });
  }

  currentY = 45;

  // === DOCUMENT TITLE ===
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 18, 3, 3, 'F');
  
  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TABELA PRICE - SIMULAÇÃO DE EMPRÉSTIMO', pageWidth / 2, currentY + 8, { align: 'center' });
  
  if (data.clientName) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Cliente: ${data.clientName}`, pageWidth / 2, currentY + 14, { align: 'center' });
  }

  currentY += 28;

  // === SUMMARY SECTION ===
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 28, 3, 3, 'F');
  
  const col1X = margin + 10;
  const col2X = pageWidth / 2 + 10;

  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setFontSize(9);
  doc.text('Valor do Capital', col1X, currentY + 8);
  doc.text('Taxa Mensal', col2X, currentY + 8);
  
  doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.principal), col1X, currentY + 15);
  doc.text(`${data.interestRate.toFixed(2)}%`, col2X, currentY + 15);

  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Nº de Parcelas', col1X, currentY + 22);
  doc.text('Valor da Parcela (PMT)', col2X, currentY + 22);
  
  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.installments}x`, col1X, currentY + 28);
  doc.text(formatCurrency(data.pmt), col2X, currentY + 28);

  currentY += 38;

  // === AMORTIZATION TABLE ===
  // Table Header
  doc.setFillColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.rect(margin, currentY, pageWidth - 2 * margin, 10, 'F');
  
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  
  const colWidths = [15, 35, 35, 30, 35, 30];
  const colHeaders = ['#', 'PARCELA', 'AMORTIZAÇÃO', 'JUROS', 'SALDO DEV.', 'VENCIMENTO'];
  let colX = margin + 3;
  
  colHeaders.forEach((header, i) => {
    doc.text(header, colX + (i === 0 ? 0 : colWidths.slice(0, i).reduce((a, b) => a + b, 0)), currentY + 7);
  });

  currentY += 10;

  // Table Rows
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  data.rows.forEach((row, index) => {
    // Check if we need a new page
    if (currentY > 265) {
      doc.addPage();
      currentY = 20;
      
      // Repeat header on new page
      doc.setFillColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
      doc.rect(margin, currentY, pageWidth - 2 * margin, 10, 'F');
      doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      colHeaders.forEach((header, i) => {
        doc.text(header, margin + 3 + (i === 0 ? 0 : colWidths.slice(0, i).reduce((a, b) => a + b, 0)), currentY + 7);
      });
      currentY += 10;
      doc.setFont('helvetica', 'normal');
    }

    // Alternating row colors
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, currentY, pageWidth - 2 * margin, 8, 'F');
    }

    colX = margin + 3;
    
    // Row number
    doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
    doc.setFont('helvetica', 'bold');
    doc.text(row.installmentNumber.toString(), colX, currentY + 6);
    
    // Payment
    colX += colWidths[0];
    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(row.payment), colX, currentY + 6);
    
    // Amortization
    colX += colWidths[1];
    doc.setTextColor(34, 197, 94); // emerald-500
    doc.text(formatCurrency(row.amortization), colX, currentY + 6);
    
    // Interest
    colX += colWidths[2];
    doc.setTextColor(249, 115, 22); // orange-500
    doc.text(formatCurrency(row.interest), colX, currentY + 6);
    
    // Balance
    colX += colWidths[3];
    doc.setTextColor(DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b);
    doc.text(formatCurrency(row.balance), colX, currentY + 6);
    
    // Due Date
    colX += colWidths[4];
    doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
    const dueDate = data.installmentDates?.[index] ? formatDate(data.installmentDates[index]) : '-';
    doc.text(dueDate, colX, currentY + 6);

    currentY += 8;
  });

  currentY += 5;

  // === TOTALS ===
  doc.setFillColor(LIGHT_GREEN_BG.r, LIGHT_GREEN_BG.g, LIGHT_GREEN_BG.b);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 18, 3, 3, 'F');

  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setFontSize(9);
  doc.text('Total a Receber:', margin + 10, currentY + 8);
  doc.text('Total de Juros:', pageWidth / 2 + 10, currentY + 8);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PRIMARY_GREEN.r, PRIMARY_GREEN.g, PRIMARY_GREEN.b);
  doc.text(formatCurrency(data.totalPayment), margin + 10, currentY + 15);
  
  doc.setTextColor(DARK_GREEN.r, DARK_GREEN.g, DARK_GREEN.b);
  doc.text(formatCurrency(data.totalInterest), pageWidth / 2 + 10, currentY + 15);

  currentY += 25;

  // === FOOTER ===
  const footerY = Math.max(currentY, 270);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY, pageWidth - margin, footerY);
  
  doc.setFontSize(8);
  doc.setTextColor(MUTED_TEXT.r, MUTED_TEXT.g, MUTED_TEXT.b);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, footerY + 5);
  doc.text('Gerado pelo CobraFácil', pageWidth - margin, footerY + 5, { align: 'right' });

  // Download
  const fileName = `tabela-price-${data.principal}-${data.installments}x.pdf`;
  doc.save(fileName);
};
