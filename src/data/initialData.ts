import { type RegraMaster, type LancamentoVenda, type ProjecaoMensalType, type StatusParcela, type MesesAno, type Vendedor, type TipoTabela, type Administradora, LISTA_MESES } from '../types';

export const INITIAL_ADMINISTRADORAS: Administradora[] = [
  { id: 'adm_âncora_1787152829001', nome: 'Âncora', ativo: true },
  { id: 'adm_porto', nome: 'Porto Seguro', ativo: true },
  { id: 'adm_embracon', nome: 'Embracon', ativo: true },
  { id: 'adm_rodobens', nome: 'Rodobens', ativo: true },
  { id: 'adm_ademicon', nome: 'Ademicon', ativo: true },
  { id: 'adm_itau', nome: 'Itaú Consórcios', ativo: true },
  { id: 'adm_santander', nome: 'Santander Consórcios', ativo: true },
];

export const INITIAL_VENDEDORES: Vendedor[] = [
  { id: 'vend_1', nome: 'Carlos Silva', email: 'carlos.silva@consultoria.com', ativo: true, empresaId: 'emp_vertex' },
  { id: 'vend_2', nome: 'Roberta Lima', email: 'roberta.lima@consultoria.com', ativo: true, empresaId: 'emp_vertex' },
  { id: 'vend_3', nome: 'Eduardo Souza', email: 'eduardo.souza@consultoria.com', ativo: true, empresaId: 'emp_vertex' }
];

export const INITIAL_REGRAS: RegraMaster[] = [];

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
  return venc > hoje ? 'A vencer' : 'Vencida';
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
      dataVencimento: dataVenc,
      dataRecebimento: dataVenc // Inicializa igual ao vencimento; editável pelo usuário
    };
  });
  return proj;
};

// Helper para calcular totais (ignora parcelas canceladas e evita somar cumulativamente faturamentos de repetição)
export const calcularTotaisLinha = (
  projecao: ProjecaoMensalType,
  percentualComissao: number,
  qtdParcelas: number,
  tipoTabela: TipoTabela = 'Linear',
  percentualAdesao?: number,
  percentualMensalRestante?: number,
  percentuaisParcelas?: number[]
): { totalVendas: number; totalComissoes: number; projecaoAtualizada: ProjecaoMensalType } => {
  let totalVendas = 0;
  let totalComissoes = 0;
  const projecaoAtualizada = { ...projecao };

  let parcelasAtivas = 0;
  let valorMaximoVenda = 0;

  const chavesOrdenadas = Object.keys(projecaoAtualizada).sort();
  
  // Identifica os meses com valor > 0 para aplicar a regra de 1ª parcela (Adesão) e parcelas restantes
  const mesesComVenda = chavesOrdenadas.filter(k => (projecaoAtualizada[k]?.valorVenda || 0) > 0);
  const primeiraChaveComVenda = mesesComVenda.length > 0 ? mesesComVenda[0] : null;

  const temGradePersonalizada = Array.isArray(percentuaisParcelas) && percentuaisParcelas.length > 0;
  const isAdesao = tipoTabela === 'Adesão';
  const pAdesao = percentualAdesao ?? 0;
  const pMensal = percentualMensalRestante ?? 0;
  const parcelasRestantes = Math.max(1, qtdParcelas - 1);

  chavesOrdenadas.forEach((mesChave) => {
    const celula = projecaoAtualizada[mesChave];
    const valor = celula.valorVenda || 0;
    
    let comissao = 0;
    if (valor > 0) {
      if (temGradePersonalizada) {
        // Usa a grade de percentuais por parcela individual [P1, P2, ..., Pn]
        const indiceParcela = Object.keys(projecao).filter(k => !k.startsWith('__')).sort().indexOf(mesChave);
        const percParcela = (indiceParcela >= 0 && percentuaisParcelas![indiceParcela] !== undefined)
          ? percentuaisParcelas![indiceParcela]
          : 0;
        comissao = valor * (percParcela / 100);
      } else if (isAdesao) {
        if (mesChave === primeiraChaveComVenda) {
          // 1ª Parcela: recebe a comissão de Adesão
          comissao = valor * (pAdesao / 100);
        } else {
          // Parcelas restantes (2..N): fracionadas
          comissao = valor * ((pMensal / parcelasRestantes) / 100);
        }
      } else {
        // Linear: percentual total dividido igualmente
        const percentualMensalLinear = percentualComissao / qtdParcelas;
        comissao = valor * (percentualMensalLinear / 100);
      }
    }
    
    projecaoAtualizada[mesChave] = {
      ...celula,
      comissaoGerada: Number(comissao.toFixed(2)),
      // Preserva dataRecebimento se já existir, senão inicializa igual a dataVencimento
      dataRecebimento: celula.dataRecebimento || celula.dataVencimento
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
export const gerarVendaMock = (
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
    statusCliente: 'Ativo',
    empresaId: 'emp_vertex'
  };
};

export const INITIAL_VENDAS: LancamentoVenda[] = [];
