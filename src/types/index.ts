export type SegmentoType = 'Imóveis' | 'Autos Leves' | 'Pesados';

export interface Empresa {
  id: string;
  nome: string;
  ativo: boolean;
  empresaMaeId?: string; // Se preenchido, esta é uma empresa filha
}

export interface Administradora {
  id: string;
  nome: string;
  ativo: boolean;
  created_at?: string;
}

export type TipoTabela = 'Linear' | 'Adesão';

export interface RegraMaster {
  id: string;
  empresaId?: string; // ID da empresa proprietária da regra (empresa mãe)
  administradoraId?: string; // ID da administradora do consórcio
  administradoraNome?: string; // Nome da administradora do consórcio
  segmento: SegmentoType;
  tabela: string;
  qtdParcelas: number;
  tipoTabela?: TipoTabela; // 'Linear' (default) ou 'Adesão'
  percentualComissao: number; // Percentual linear total (ou total na adesão). Ex: 5 significa 5%
  percentualAdesao?: number; // % pago na 1ª parcela (ex: 2 = 2%)
  percentualMensal?: number; // % restante fracionado nas parcelas restantes (ex: 3 = 3%)
  percentuaisParcelas?: number[]; // Percentual exato de cada parcela individual [p1, p2, ..., pn]
  percentualComissaoContemplacao?: number; // % de comissão pago na contemplação (ex: 2.5 = 2.5%)
}

/**
 * Regra customizada de uma empresa filha.
 * Referencia uma RegraMaster da empresa mãe, e define percentuais menores
 * para a filha. A diferença (mãe - filha) gera parcelas espelho para a mãe.
 */
export interface RegraFilha {
  id: string;
  empresaFilhaId: string;
  regraMasterId: string;      // Referência à regra da mãe
  administradoraId?: string;  // ID da administradora do consórcio
  administradoraNome?: string; // Nome da administradora do consórcio
  tipoTabela?: TipoTabela;    // 'Linear' ou 'Adesão'
  percentualComissao: number; // % da filha (deve ser ≤ % da mãe)
  percentualAdesao?: number;  // % adesão da filha
  percentualMensal?: number;  // % mensal da filha
  percentuaisParcelas?: number[]; // Grade de percentuais por parcela da filha
  percentualComissaoContemplacao?: number; // % contempl. da filha
}

export type StatusParcela = 'A vencer' | 'Vencida' | 'Paga' | 'Cancelada';

/** Status independente do pagamento da comissão ao parceiro/vendedor */
export type StatusComissao = 'A pagar' | 'Paga' | 'Contestada';

export type StatusCliente = 'Ativo' | 'Cancelado';

export interface MesProjecao {
  valorVenda: number; // Valor do crédito
  valorParcela: number; // Valor da parcela
  comissaoGerada: number;
  status: StatusParcela;
  statusComissao?: StatusComissao; // Status do pagamento da comissão ao parceiro (independente do status da parcela)
  dataVencimento: string; // Formato YYYY-MM-DD
  dataPrevisaoRecebimento?: string; // Próxima data de corte após o vencimento (YYYY-MM-DD)
  dataRecebimento?: string; // Data real de recebimento da parcela, editável pelo usuário (YYYY-MM-DD). Inicializa igual a dataVencimento
  recebida?: boolean; // Indica se a comissão foi recebida
  dataPagamentoCliente?: string; // Data em que o cliente efetuou o pagamento da parcela (YYYY-MM-DD)
  dataRecebimentoComissao?: string; // Data em que a comissão foi efetivamente recebida da administradora (YYYY-MM-DD)
  numeroRelatorioRecebimento?: string; // Nº do relatório da administradora referente ao recebimento da comissão
  notaFiscalRecebimento?: string; // Nº ou código da Nota Fiscal relativa ao recebimento da comissão
}

export type MesesAno =
  | 'janeiro'
  | 'fevereiro'
  | 'março'
  | 'abril'
  | 'maio'
  | 'junho'
  | 'julho'
  | 'agosto'
  | 'setembro'
  | 'outubro'
  | 'novembro'
  | 'dezembro';

export type ProjecaoMensalType = Record<string, MesProjecao>;

export interface Vendedor {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  percentualComissao?: number; // Comissão padrão do vendedor (%)
  empresaId?: string; // ID da empresa à qual o vendedor pertence
}

export interface LancamentoVenda {
  id: string;
  cliente: string;
  administradoraId?: string; // ID da administradora do consórcio
  administradoraNome?: string; // Nome da administradora do consórcio
  vendedorId?: string;
  vendedorNome?: string;
  dataVenda?: string; // Data da venda (YYYY-MM-DD)
  dataVencimentoCliente?: string; // Data de Vencimento do Cliente (YYYY-MM-DD)
  dataSegundaParcela?: string; // Mantido para compatibilidade (legado)
  dataAssembleia?: string; // Data da 1ª Assembleia = vencimento da 1ª parcela (YYYY-MM-DD)
  mesInicio?: string; // Mês inicial de faturamento da venda (YYYY-MM)
  segmento: SegmentoType;
  tabela: string;
  qtdParcelas: number;
  tipoTabela?: TipoTabela; // 'Linear' ou 'Adesão'
  percentualComissao: number; // Percentual copiado/calculado da Regra Master
  percentualAdesao?: number; // % adesão pago na 1ª parcela
  percentualMensal?: number; // % mensal restante
  percentuaisParcelas?: number[]; // Percentual de comissão de cada parcela
  valorVenda: number; // Valor de referência geral da venda (Crédito)
  valorParcela: number; // Valor nominal da parcela
  projecaoMensal: ProjecaoMensalType;
  totalVendas: number; // Calculado (faturamento nominal ativo consolidado)
  totalComissoes: number; // Calculado (soma das comissões geradas dos meses ativos e não cancelados)
  statusCliente: StatusCliente;
  pac?: string; // Código do Contrato/PAC
  contemplado?: boolean; // Se o cliente foi contemplado
  dataContemplacao?: string; // Data da contemplação (YYYY-MM-DD)
  comissaoContemplacao?: number; // Valor da comissão gerada na contemplação
  numeroRelatorio?: string; // Número do relatório gerado pela ADM
  dataRelatorio?: string; // Data do relatório ADM (YYYY-MM-DD)
  empresaId?: string; // ID da empresa proprietária do registro

  // Campos de hierarquia empresa mãe/filha
  vendaOrigemId?: string;   // Se preenchido, esta é uma venda espelho da empresa mãe
  isVendaEspelho?: boolean; // Flag explícita: true = venda espelho (diferencial da mãe)
  empresaFilhaOrigemId?: string; // ID da empresa filha que originou esta venda espelho
}

export const LISTA_MESES: MesesAno[] = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
];

export const NOMES_MESES_EXIBICAO: Record<MesesAno, string> = {
  janeiro: 'Jan/26',
  fevereiro: 'Fev/26',
  março: 'Mar/26',
  abril: 'Abr/26',
  maio: 'Mai/26',
  junho: 'Jun/26',
  julho: 'Jul/26',
  agosto: 'Ago/26',
  setembro: 'Set/26',
  outubro: 'Out/26',
  novembro: 'Nov/26',
  dezembro: 'Dez/26'
};

export type UserRole = 'super_master' | 'master' | 'editor' | 'visualizador' | 'financeiro' | 'vendedor';

export interface UserPermissions {
  visualizar: boolean;
  editarVendas: boolean;
  cadastrarVendedores: boolean;
  cadastrarRegras: boolean;
  receberParcelas?: boolean;
  visualizarDashboardVendedores?: boolean;
  editarParcelas?: boolean; // Permite edição parcela a parcela (todos os campos: datas, valores, status)
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senha?: string;
  role: UserRole;
  permissoes: UserPermissions;
  empresaId?: string; // ID da empresa à qual o usuário pertence
  vendedorId?: string; // ID do vendedor vinculado (quando role === 'vendedor')
  created_at?: string;
}
