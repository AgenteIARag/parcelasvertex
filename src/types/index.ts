export type SegmentoType = 'Imóveis' | 'Autos Leves' | 'Pesados';

export interface RegraMaster {
  id: string;
  segmento: SegmentoType;
  tabela: string;
  qtdParcelas: number;
  percentualComissao: number; // Ex: 5 significa 5% (ou 0.05, vamos usar de 0 a 100 para facilidade de inserção pelo usuário, ex: 5% = 5)
  percentualComissaoContemplacao?: number; // % de comissão pago na contemplação (ex: 2.5 = 2.5%)
}

export type StatusParcela = 'A vencer' | 'Vencida' | 'Paga' | 'Recebida' | 'Cancelada';

export type StatusCliente = 'Ativo' | 'Cancelado';

export interface MesProjecao {
  valorVenda: number; // Valor do crédito
  valorParcela: number; // Valor da parcela
  comissaoGerada: number;
  status: StatusParcela;
  dataVencimento: string; // Formato YYYY-MM-DD
  dataPrevisaoRecebimento?: string; // Próxima data de corte após o vencimento (YYYY-MM-DD)
  dataRecebimento?: string; // Data real de recebimento da parcela, editável pelo usuário (YYYY-MM-DD). Inicializa igual a dataVencimento
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
}

export interface LancamentoVenda {
  id: string;
  cliente: string;
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
  percentualComissao: number; // Percentual copiado/calculado da Regra Master
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

export type UserRole = 'master' | 'editor' | 'visualizador' | 'financeiro';

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
  created_at?: string;
}
