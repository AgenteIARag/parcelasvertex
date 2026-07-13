import { type RegraMaster, type LancamentoVenda, type ProjecaoMensalType, type StatusParcela, type MesesAno, type Vendedor, LISTA_MESES } from '../types';

export const INITIAL_VENDEDORES: Vendedor[] = [
  { id: 'vend_1', nome: 'Carlos Silva', email: 'carlos.silva@consultoria.com', ativo: true },
  { id: 'vend_2', nome: 'Roberta Lima', email: 'roberta.lima@consultoria.com', ativo: true },
  { id: 'vend_3', nome: 'Eduardo Souza', email: 'eduardo.souza@consultoria.com', ativo: true }
];

export const INITIAL_REGRAS: RegraMaster[] = [
  // Imóveis
  { id: 'r_imoveis_1', segmento: 'Imóveis', tabela: 'REAJUSTE INCC - Normal - Integral', qtdParcelas: 10, percentualComissao: 4.0 },
  { id: 'r_imoveis_2', segmento: 'Imóveis', tabela: 'REAJUSTE INCC - Normal - Adesão 1%', qtdParcelas: 8, percentualComissao: 4.0 },
  { id: 'r_imoveis_3', segmento: 'Imóveis', tabela: 'REAJUSTE INCC - Normal - Adesão 2%', qtdParcelas: 7, percentualComissao: 4.0 },
  { id: 'r_imoveis_4', segmento: 'Imóveis', tabela: 'REAJUSTE INCC - Plano 70% - Integral', qtdParcelas: 13, percentualComissao: 4.0 },
  { id: 'r_imoveis_5', segmento: 'Imóveis', tabela: 'REAJUSTE INCC - Plano 70% - Adesão 1%', qtdParcelas: 11, percentualComissao: 4.0 },
  { id: 'r_imoveis_6', segmento: 'Imóveis', tabela: 'REAJUSTE INCC - Plano 70% - Adesão 2%', qtdParcelas: 9, percentualComissao: 4.0 },
  { id: 'r_imoveis_7', segmento: 'Imóveis', tabela: 'REAJUSTE INCC - Plano 50% - Integral', qtdParcelas: 20, percentualComissao: 4.0 },
  { id: 'r_imoveis_8', segmento: 'Imóveis', tabela: 'REAJUSTE INCC - Plano 50% - Adesão 1%', qtdParcelas: 17, percentualComissao: 4.0 },
  { id: 'r_imoveis_9', segmento: 'Imóveis', tabela: 'REAJUSTE INCC - Plano 50% - Adesão 2%', qtdParcelas: 13, percentualComissao: 4.0 },
  { id: 'r_imoveis_10', segmento: 'Imóveis', tabela: 'GRUPO 708 - Normal', qtdParcelas: 13, percentualComissao: 4.0 },
  { id: 'r_imoveis_11', segmento: 'Imóveis', tabela: 'GRUPO 708 - Plano 70%', qtdParcelas: 17, percentualComissao: 4.0 },
  { id: 'r_imoveis_12', segmento: 'Imóveis', tabela: 'GRUPO 708 - Plano 50%', qtdParcelas: 20, percentualComissao: 4.0 },
  { id: 'r_imoveis_13', segmento: 'Imóveis', tabela: 'GRUPO 708 - ACELERADO - Normal 6x', qtdParcelas: 5, percentualComissao: 4.0 },
  { id: 'r_imoveis_14', segmento: 'Imóveis', tabela: 'GRUPO 708 - ACELERADO - Normal 8x', qtdParcelas: 8, percentualComissao: 4.0 },
  { id: 'r_imoveis_15', segmento: 'Imóveis', tabela: 'GRUPO 708 - ACELERADO - Plano 50% 16x', qtdParcelas: 16, percentualComissao: 4.0 },

  // Autos Leves
  { id: 'r_autos_1', segmento: 'Autos Leves', tabela: 'Carro/Motos/IGPM - Normal', qtdParcelas: 4, percentualComissao: 4.0 },
  { id: 'r_autos_2', segmento: 'Autos Leves', tabela: 'Carro/Motos/IGPM - Adesão 1%', qtdParcelas: 4, percentualComissao: 4.0 },
  { id: 'r_autos_3', segmento: 'Autos Leves', tabela: 'Carro/Motos/IGPM - Adesão 2%', qtdParcelas: 3, percentualComissao: 4.0 },
  { id: 'r_autos_4', segmento: 'Autos Leves', tabela: 'Carro/Motos/IGPM - Plano 70%', qtdParcelas: 8, percentualComissao: 4.0 },
  { id: 'r_autos_5', segmento: 'Autos Leves', tabela: 'Carro/Motos/IGPM - Plano 50%', qtdParcelas: 8, percentualComissao: 4.0 },
  { id: 'r_autos_6', segmento: 'Autos Leves', tabela: 'Carro/Motos/IGPM - Acelera Aí', qtdParcelas: 15, percentualComissao: 4.0 },

  // Pesados
  { id: 'r_pesados_1', segmento: 'Pesados', tabela: 'Carro/Motos/IGPM - Normal', qtdParcelas: 5, percentualComissao: 4.0 },
  { id: 'r_pesados_2', segmento: 'Pesados', tabela: 'Carro/Motos/IGPM - Plano 70%', qtdParcelas: 8, percentualComissao: 4.0 },
  { id: 'r_pesados_3', segmento: 'Pesados', tabela: 'Carro/Motos/IGPM - Plano 50%', qtdParcelas: 16, percentualComissao: 4.0 }
];

export const MAP_MES_NUMERO: Record<MesesAno, string> = {
  janeiro: '01',
  fevereiro: '02',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12'
};

export const getStatusInicial = (dataVencimentoStr: string): StatusParcela => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(`${dataVencimentoStr}T00:00:00`);
  return venc > hoje ? 'A vencer' : 'Vendida';
};

// Helper para gerar projeção mensal vazia com datas e status iniciais (Chaves YYYY-MM)
export const gerarProjecaoVazia = (): ProjecaoMensalType => {
  const proj: ProjecaoMensalType = {};
  LISTA_MESES.forEach((mes) => {
    const dataVenc = `2026-${MAP_MES_NUMERO[mes]}-15`;
    const status = getStatusInicial(dataVenc);
    proj[`2026-${MAP_MES_NUMERO[mes]}`] = {
      valorVenda: 0,
      valorParcela: 0,
      comissaoGerada: 0,
      status,
      dataVencimento: dataVenc
    };
  });
  return proj;
};

// Helper para calcular totais (ignora parcelas canceladas e evita somar cumulativamente faturamentos de repetição)
export const calcularTotaisLinha = (
  projecao: ProjecaoMensalType,
  percentualComissao: number,
  qtdParcelas: number
): { totalVendas: number; totalComissoes: number; projecaoAtualizada: ProjecaoMensalType } => {
  let totalVendas = 0;
  let totalComissoes = 0;
  const projecaoAtualizada = { ...projecao };

  const percentualMensal = percentualComissao / qtdParcelas;

  let parcelasAtivas = 0;
  let valorMaximoVenda = 0;

  Object.keys(projecaoAtualizada).forEach((mesChave) => {
    const celula = projecaoAtualizada[mesChave];
    const valor = celula.valorVenda || 0;
    const comissao = valor * (percentualMensal / 100);
    
    projecaoAtualizada[mesChave] = {
      ...celula,
      comissaoGerada: Number(comissao.toFixed(2))
    };
    
    if (celula.status !== 'Cancelada' && valor > 0) {
      parcelasAtivas += 1;
      totalComissoes += comissao;
      if (valor > valorMaximoVenda) {
        valorMaximoVenda = valor;
      }
    }
  });

  // O valor total de vendas nominal da linha é o valor nominal da venda ativa (não cumulativo pelas repetições mensais).
  // Se todas as parcelas forem canceladas, o total de faturamento é 0.
  totalVendas = parcelasAtivas > 0 ? valorMaximoVenda : 0;

  return {
    totalVendas: Number(totalVendas.toFixed(2)),
    totalComissoes: Number(totalComissoes.toFixed(2)),
    projecaoAtualizada
  };
};

// Vendas Iniciais Mockadas
const gerarVendaMock = (
  id: string,
  cliente: string,
  vendedorId: string,
  vendedorNome: string,
  segmento: 'Imóveis' | 'Autos Leves' | 'Pesados',
  tabela: string,
  qtdParcelas: number,
  percentualComissao: number,
  distribuicaoMensalVendas: Record<string, number>
): LancamentoVenda => {
  const proj = gerarProjecaoVazia();
  
  const valoresMeses = Object.values(distribuicaoMensalVendas);
  const valorMaximoVenda = valoresMeses.length > 0 ? Math.max(...valoresMeses) : 0;
  const valorParcelaMock = qtdParcelas > 0 ? valorMaximoVenda / qtdParcelas : 0;

  LISTA_MESES.forEach((mes) => {
    if (distribuicaoMensalVendas[mes] !== undefined) {
      const chaveMes = `2026-${MAP_MES_NUMERO[mes]}`;
      proj[chaveMes].valorVenda = distribuicaoMensalVendas[mes];
      proj[chaveMes].valorParcela = valorParcelaMock;
    }
  });

  const { totalVendas, totalComissoes, projecaoAtualizada } = calcularTotaisLinha(
    proj,
    percentualComissao,
    qtdParcelas
  );

  // Calcula a data da segunda parcela para o fluxo de simulação mockada
  const mesesOrdenadosComVenda = LISTA_MESES.filter(m => distribuicaoMensalVendas[m] !== undefined && distribuicaoMensalVendas[m] > 0);
  const mesInicioMock = mesesOrdenadosComVenda.length > 0 ? mesesOrdenadosComVenda[0] : 'janeiro';
  const indexInicioMock = LISTA_MESES.indexOf(mesInicioMock);
  let dataSegundaParcela = '';
  if (qtdParcelas >= 2) {
    const indexSegunda = (indexInicioMock + 1) % 12;
    const mesSegunda = LISTA_MESES[indexSegunda];
    dataSegundaParcela = `2026-${MAP_MES_NUMERO[mesSegunda]}-15`;
  } else {
    dataSegundaParcela = `2026-${MAP_MES_NUMERO[mesInicioMock]}-15`;
  }

  const mesInicioChaveMock = `2026-${MAP_MES_NUMERO[mesInicioMock]}`;
  const dataVendaMock = `2026-${MAP_MES_NUMERO[mesInicioMock]}-01`;

  return {
    id,
    cliente,
    vendedorId,
    vendedorNome,
    dataVenda: dataVendaMock,
    dataSegundaParcela,
    mesInicio: mesInicioChaveMock,
    segmento,
    tabela,
    qtdParcelas,
    percentualComissao,
    valorVenda: valorMaximoVenda,
    valorParcela: valorParcelaMock, // Valor da venda base no mock
    projecaoMensal: projecaoAtualizada,
    totalVendas,
    totalComissoes,
    statusCliente: 'Ativo'
  };
};

export const INITIAL_VENDAS: LancamentoVenda[] = [
  gerarVendaMock(
    'v1',
    'Residencial Park Central',
    'vend_1',
    'Carlos Silva',
    'Imóveis',
    'Tabela Platinum',
    180,
    5.5,
    {
      janeiro: 1200000,
      fevereiro: 800000,
      março: 1500000,
      maio: 2000000,
      julho: 1100000,
      agosto: 900000,
      outubro: 1300000,
      dezembro: 1600000
    }
  ),
  gerarVendaMock(
    'v2',
    'Transportadora RodoSul',
    'vend_2',
    'Roberta Lima',
    'Pesados',
    'Tabela Agro-Frota',
    72,
    7.5,
    {
      fevereiro: 900000,
      abril: 1200000,
      junho: 1500000,
      agosto: 1800000,
      outubro: 1100000,
      novembro: 1400000,
      dezembro: 2000000
    }
  ),
  gerarVendaMock(
    'v3',
    'Frota Local Aluguel',
    'vend_3',
    'Eduardo Souza',
    'Autos Leves',
    'Tabela Linear Flex',
    48,
    9.0,
    {
      janeiro: 300000,
      fevereiro: 350000,
      março: 400000,
      abril: 300000,
      maio: 450000,
      junho: 500000,
      julho: 400000,
      agosto: 300000,
      setembro: 600000,
      outubro: 450000,
      novembro: 500000,
      dezembro: 700000
    }
  )
];
