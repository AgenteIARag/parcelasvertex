export type SegmentoType = 'Imóveis' | 'Autos Leves' | 'Pesados';

export interface RegraMaster {
  id: string;
  segmento: SegmentoType;
  tabela: string;
  qtdParcelas: number;
  percentualComissao: number; // Ex: 5 significa 5% (ou 0.05, vamos usar de 0 a 100 para facilidade de inserção pelo usuário, ex: 5% = 5)
}

export type StatusParcela = 'A vencer' | 'Vendida' | 'Paga' | 'Recebida' | 'Cancelada';

export type StatusCliente = 'Ativo' | 'Cancelado';

export interface MesProjecao {
  valorVenda: number; // Valor do crédito
  valorParcela: number; // Valor da parcela
  comissaoGerada: number;
  status: StatusParcela;
  dataVencimento: string; // Formato YYYY-MM-DD
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
  dataSegundaParcela?: string; // Formato YYYY-MM-DD para usar em fluxos
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

export type UserRole = 'master' | 'editor' | 'visualizador';

export interface UserPermissions {
  visualizar: boolean;
  editarVendas: boolean;
  cadastrarVendedores: boolean;
  cadastrarRegras: boolean;
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
