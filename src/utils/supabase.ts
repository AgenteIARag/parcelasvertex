import { createClient } from '@supabase/supabase-js';
import type { LancamentoVenda, RegraMaster, RegraFilha, Vendedor, Usuario, Empresa } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fisnjgoggqvnvkyyyrwo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpc25qZ29nZ3F2bnZreXl5cndvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2OTQ0ODUsImV4cCI6MjA5OTI3MDQ4NX0.MUn5eAm0JMIaTftSjGL4kVWByZqfWhspnyIVmBhYst4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==========================================
// Funções auxiliares para sincronização
// ==========================================

// --- VENDEDORES ---
export const obterVendedoresSupabase = async (): Promise<Vendedor[]> => {
  const { data, error } = await supabase
    .from('vendedores')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao buscar vendedores do Supabase:', error);
    throw error;
  }
  return (data || []).map((v: any) => ({
    id: v.id,
    nome: v.nome,
    email: v.email,
    ativo: v.ativo,
    percentualComissao: Number(v.percentual_comissao ?? v.percentualComissao ?? 0),
    empresaId: v.empresa_id || 'emp_vertex'
  }));
};

export const salvarVendedorSupabase = async (vendedor: Vendedor): Promise<void> => {
  try {
    const { error } = await supabase
      .from('vendedores')
      .upsert({
        id: vendedor.id,
        nome: vendedor.nome,
        email: vendedor.email,
        ativo: vendedor.ativo,
        percentual_comissao: vendedor.percentualComissao || 0,
        empresa_id: vendedor.empresaId || 'emp_vertex'
      });

    if (error) {
      if (error.code === '42703') {
        console.warn('Coluna percentual_comissao ou empresa_id não existe no Supabase. Tentando salvar sem campos novos.');
        const { error: retryError } = await supabase
          .from('vendedores')
          .upsert({
            id: vendedor.id,
            nome: vendedor.nome,
            email: vendedor.email,
            ativo: vendedor.ativo
          });
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
  } catch (err) {
    console.error('Erro ao salvar vendedor no Supabase:', err);
    throw err;
  }
};

export const excluirVendedorSupabase = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('vendedores')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir vendedor no Supabase:', error);
    throw error;
  }
};

// --- REGRAS MASTER ---
export const obterRegrasLocais = (): RegraMaster[] => {
  try {
    const s = localStorage.getItem('apex_regras_master');
    return s ? JSON.parse(s) : [];
  } catch { return []; }
};

export const salvarRegraLocal = (regra: RegraMaster): void => {
  const lista = obterRegrasLocais();
  const idx = lista.findIndex(r => r.id === regra.id);
  if (idx >= 0) lista[idx] = regra;
  else lista.push(regra);
  localStorage.setItem('apex_regras_master', JSON.stringify(lista));
};

export const excluirRegraLocal = (id: string): void => {
  const lista = obterRegrasLocais().filter(r => r.id !== id);
  localStorage.setItem('apex_regras_master', JSON.stringify(lista));
};

export const obterRegrasSupabase = async (): Promise<RegraMaster[]> => {
  const regrasLocais = obterRegrasLocais();
  const { data, error } = await supabase
    .from('regras_master')
    .select('*')
    .order('segmento', { ascending: true })
    .order('tabela', { ascending: true });

  if (error) {
    console.warn('Erro ao buscar regras do Supabase, usando locais:', error.message);
    return regrasLocais;
  }

  const regrasRemotas = (data || []).map((r: any) => {
    // Procura versão local para mesclar campos que o banco possa não ter persistido
    const local = regrasLocais.find(rl => rl.id === r.id);

    return {
      id: r.id,
      empresaId: r.empresa_id || local?.empresaId || undefined,
      segmento: r.segmento,
      tabela: r.tabela,
      qtdParcelas: Number(r.qtd_parcelas ?? r.qtdParcelas ?? local?.qtdParcelas ?? 0),
      tipoTabela: (r.tipo_tabela as any) || local?.tipoTabela || 'Linear',
      percentualComissao: Number(r.percentual_comissao ?? r.percentualComissao ?? local?.percentualComissao ?? 0),
      percentualAdesao: r.percentual_adesao != null ? Number(r.percentual_adesao) : local?.percentualAdesao,
      percentualMensal: r.percentual_mensal != null ? Number(r.percentual_mensal) : local?.percentualMensal,
      percentuaisParcelas: Array.isArray(r.percentuais_parcelas) 
        ? r.percentuais_parcelas.map(Number) 
        : local?.percentuaisParcelas,
      percentualComissaoContemplacao: r.percentual_comissao_contemplacao != null
        ? Number(r.percentual_comissao_contemplacao)
        : local?.percentualComissaoContemplacao
    };
  });

  // Se houver regras locais que não estão no Supabase, inclui elas
  const idsRemotos = new Set(regrasRemotas.map(r => r.id));
  const apenasLocais = regrasLocais.filter(r => !idsRemotos.has(r.id));
  const todasRegras = [...regrasRemotas, ...apenasLocais];

  localStorage.setItem('apex_regras_master', JSON.stringify(todasRegras));
  return todasRegras;
};

export const salvarRegraSupabase = async (regra: RegraMaster): Promise<void> => {
  // Salva no cache local imediatamente
  salvarRegraLocal(regra);

  const payload: Record<string, unknown> = {
    id: regra.id,
    segmento: regra.segmento,
    tabela: regra.tabela,
    qtd_parcelas: regra.qtdParcelas,
    tipo_tabela: regra.tipoTabela || 'Linear',
    percentual_comissao: regra.percentualComissao,
  };
  if (regra.empresaId) payload.empresa_id = regra.empresaId;
  if (regra.percentualAdesao != null) payload.percentual_adesao = regra.percentualAdesao;
  if (regra.percentualMensal != null) payload.percentual_mensal = regra.percentualMensal;
  if (regra.percentuaisParcelas && Array.isArray(regra.percentuaisParcelas)) {
    payload.percentuais_parcelas = regra.percentuaisParcelas;
  }
  if (regra.percentualComissaoContemplacao != null) {
    payload.percentual_comissao_contemplacao = regra.percentualComissaoContemplacao;
  }

  try {
    const { error } = await supabase.from('regras_master').upsert(payload);
    if (error) {
      console.warn('Tentando salvar regra com campos básicos por incompatibilidade de schema:', error.message);
      // Fallback: salva apenas as colunas básicas
      await supabase.from('regras_master').upsert({
        id: regra.id,
        segmento: regra.segmento,
        tabela: regra.tabela,
        qtd_parcelas: regra.qtdParcelas,
        percentual_comissao: regra.percentualComissao,
      });
    }
  } catch (err) {
    console.warn('Erro ao persistir no Supabase (dados seguros no cache local):', err);
  }
};

export const excluirRegraSupabase = async (id: string): Promise<void> => {
  excluirRegraLocal(id);
  try {
    const { error } = await supabase
      .from('regras_master')
      .delete()
      .eq('id', id);

    if (error) console.warn('Aviso ao excluir regra remota:', error.message);
  } catch (err) {
    console.warn('Erro ao excluir regra remota:', err);
  }
};

// --- REGRAS FILHA ---
export const obterRegrasFilhaLocal = (): RegraFilha[] => {
  try {
    const s = localStorage.getItem('apex_regras_filha');
    return s ? JSON.parse(s) : [];
  } catch { return []; }
};

export const salvarRegraFilhaLocal = (regra: RegraFilha): void => {
  const lista = obterRegrasFilhaLocal();
  const idx = lista.findIndex(r => r.id === regra.id);
  if (idx >= 0) lista[idx] = regra;
  else lista.push(regra);
  localStorage.setItem('apex_regras_filha', JSON.stringify(lista));
};

export const excluirRegraFilhaLocal = (id: string): void => {
  const lista = obterRegrasFilhaLocal().filter(r => r.id !== id);
  localStorage.setItem('apex_regras_filha', JSON.stringify(lista));
};

export const obterRegrasFilhaSupabase = async (empresaFilhaId?: string): Promise<RegraFilha[]> => {
  const locais = obterRegrasFilhaLocal();
  try {
    let query = supabase
      .from('regras_filha')
      .select('*')
      .order('created_at', { ascending: true });

    if (empresaFilhaId) {
      query = query.eq('empresa_filha_id', empresaFilhaId);
    }

    const { data, error } = await query;
    if (error || !data) {
      return empresaFilhaId ? locais.filter(l => l.empresaFilhaId === empresaFilhaId) : locais;
    }

    const remotas = data.map((r: any) => {
      const local = locais.find(l => l.id === r.id || (l.regraMasterId === r.regra_master_id && l.empresaFilhaId === r.empresa_filha_id));
      return {
        id: r.id,
        empresaFilhaId: r.empresa_filha_id,
        regraMasterId: r.regra_master_id,
        tipoTabela: (r.tipo_tabela as any) || local?.tipoTabela || 'Linear',
        percentualComissao: Number(r.percentual_comissao ?? local?.percentualComissao ?? 0),
        percentualAdesao: r.percentual_adesao != null ? Number(r.percentual_adesao) : local?.percentualAdesao,
        percentualMensal: r.percentual_mensal != null ? Number(r.percentual_mensal) : local?.percentualMensal,
        percentuaisParcelas: Array.isArray(r.percentuais_parcelas) 
          ? r.percentuais_parcelas.map(Number) 
          : local?.percentuaisParcelas,
        percentualComissaoContemplacao: r.percentual_comissao_contemplacao != null
          ? Number(r.percentual_comissao_contemplacao)
          : local?.percentualComissaoContemplacao
      };
    });

    const idsRemotos = new Set(remotas.map(r => r.id));
    const apenasLocais = locais.filter(l => !idsRemotos.has(l.id));
    const todas = [...remotas, ...apenasLocais];
    localStorage.setItem('apex_regras_filha', JSON.stringify(todas));

    return empresaFilhaId ? todas.filter(t => t.empresaFilhaId === empresaFilhaId) : todas;
  } catch {
    return empresaFilhaId ? locais.filter(l => l.empresaFilhaId === empresaFilhaId) : locais;
  }
};

export const salvarRegraFilhaSupabase = async (regra: RegraFilha): Promise<void> => {
  // Salva no cache local imediatamente
  salvarRegraFilhaLocal(regra);

  const payload: Record<string, unknown> = {
    id: regra.id,
    empresa_filha_id: regra.empresaFilhaId,
    regra_master_id: regra.regraMasterId,
    tipo_tabela: regra.tipoTabela || 'Linear',
    percentual_comissao: regra.percentualComissao,
  };
  if (regra.percentualAdesao != null) payload.percentual_adesao = regra.percentualAdesao;
  if (regra.percentualMensal != null) payload.percentual_mensal = regra.percentualMensal;
  if (regra.percentuaisParcelas && Array.isArray(regra.percentuaisParcelas)) {
    payload.percentuais_parcelas = regra.percentuaisParcelas;
  }
  if (regra.percentualComissaoContemplacao != null) {
    payload.percentual_comissao_contemplacao = regra.percentualComissaoContemplacao;
  }

  try {
    const { error } = await supabase.from('regras_filha').upsert(payload);
    if (error) {
      console.warn('Aviso ao salvar regra_filha no Supabase (dados salvos localmente):', error.message);
    }
  } catch (err) {
    console.warn('Erro de rede ao salvar regra filha (dados salvos localmente):', err);
  }
};

export const excluirRegraFilhaSupabase = async (id: string): Promise<void> => {
  excluirRegraFilhaLocal(id);
  try {
    await supabase.from('regras_filha').delete().eq('id', id);
  } catch { /* silencioso */ }
};

// --- VENDAS ---
export const obterVendasSupabase = async (): Promise<LancamentoVenda[]> => {
  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar vendas do Supabase:', error);
    throw error;
  }

  // Mapeia os nomes das colunas de snake_case para camelCase
  return (data || []).map((v: any) => {
    const proj = { ...(v.projecao_mensal || {}) };
    const pac = proj.__pac || '';
    const dataVencimentoCliente = proj.__dataVencimentoCliente || '';
    const dataAssembleia = proj.__dataAssembleia || '';

    // Remove as propriedades especiais de metadados da projeção
    delete proj.__pac;
    delete proj.__dataVencimentoCliente;
    delete proj.__dataAssembleia;

    return {
      id: v.id,
      cliente: v.cliente,
      pac,
      vendedorId: v.vendedor_id,
      vendedorNome: v.vendedor_name || v.vendedor_nome,
      dataVenda: v.data_venda,
      dataSegundaParcela: v.data_segunda_parcela,
      dataVencimentoCliente,
      dataAssembleia,
      mesInicio: v.mes_inicio,
      segmento: v.segmento,
      tabela: v.tabela,
      qtdParcelas: v.qtd_parcelas,
      tipoTabela: (v.tipo_tabela as any) || 'Linear',
      percentualComissao: Number(v.percentual_comissao),
      percentualAdesao: v.percentual_adesao != null ? Number(v.percentual_adesao) : undefined,
      percentualMensal: v.percentual_mensal != null ? Number(v.percentual_mensal) : undefined,
      percentuaisParcelas: Array.isArray(v.percentuais_parcelas) ? v.percentuais_parcelas.map(Number) : undefined,
      valorVenda: Number(v.valor_venda),
      valorParcela: Number(v.valor_parcela),
      projecaoMensal: proj,
      totalVendas: Number(v.total_vendas),
      totalComissoes: Number(v.total_comissoes),
      statusCliente: v.status_cliente,
      empresaId: v.empresa_id || 'emp_vertex',
      // Campos de hierarquia
      vendaOrigemId: v.venda_origem_id || undefined,
      isVendaEspelho: v.is_venda_espelho || false,
      empresaFilhaOrigemId: v.empresa_filha_origem_id || undefined,
    };
  });
};

export const salvarVendaSupabase = async (venda: LancamentoVenda): Promise<void> => {
  const projecaoComMetadata = {
    ...(venda.projecaoMensal || {}),
    __pac: venda.pac,
    __dataVencimentoCliente: venda.dataVencimentoCliente,
    __dataAssembleia: venda.dataAssembleia
  };

  const payload: Record<string, unknown> = {
    id: venda.id,
    cliente: venda.cliente,
    vendedor_id: venda.vendedorId,
    vendedor_nome: venda.vendedorNome,
    data_venda: venda.dataVenda,
    data_segunda_parcela: venda.dataSegundaParcela,
    mes_inicio: venda.mesInicio,
    segmento: venda.segmento,
    tabela: venda.tabela,
    qtd_parcelas: venda.qtdParcelas,
    tipo_tabela: venda.tipoTabela || 'Linear',
    percentual_comissao: venda.percentualComissao,
    percentual_adesao: venda.percentualAdesao ?? null,
    percentual_mensal: venda.percentualMensal ?? null,
    percentuais_parcelas: venda.percentuaisParcelas && Array.isArray(venda.percentuaisParcelas) ? venda.percentuaisParcelas : null,
    valor_venda: venda.valorVenda,
    valor_parcela: venda.valorParcela,
    projecao_mensal: projecaoComMetadata,
    total_vendas: venda.totalVendas,
    total_comissoes: venda.totalComissoes,
    status_cliente: venda.statusCliente,
    empresa_id: venda.empresaId || 'emp_vertex',
    venda_origem_id: venda.vendaOrigemId || null,
    is_venda_espelho: venda.isVendaEspelho || false,
    empresa_filha_origem_id: venda.empresaFilhaOrigemId || null,
  };

  const { error } = await supabase.from('vendas').upsert(payload);

  if (error) {
    console.error('Erro ao salvar venda no Supabase:', error);
    throw error;
  }
};

export const excluirVendaSupabase = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('vendas')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir venda no Supabase:', error);
    throw error;
  }
};

// Excluir todas as vendas espelho vinculadas a uma venda origem
export const excluirVendasEspelhoSupabase = async (vendaOrigemId: string): Promise<void> => {
  const { error } = await supabase
    .from('vendas')
    .delete()
    .eq('venda_origem_id', vendaOrigemId);

  if (error) {
    console.warn('Aviso ao excluir vendas espelho:', error.message);
  }
};

// --- USUÁRIOS E AUTENTICAÇÃO ---
export const obterUsuariosLocais = (): Usuario[] => {
  try {
    const saved = localStorage.getItem('apex_usuarios');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Erro ao ler apex_usuarios:', e);
  }
  return [];
};

export const salvarUsuarioLocal = (usuario: Usuario): Usuario[] => {
  const atuais = obterUsuariosLocais();
  const index = atuais.findIndex(u => u.id === usuario.id || u.email === usuario.email);
  let novos: Usuario[];
  if (index >= 0) {
    novos = [...atuais];
    novos[index] = usuario;
  } else {
    novos = [...atuais, usuario];
  }
  localStorage.setItem('apex_usuarios', JSON.stringify(novos));
  return novos;
};

export const excluirUsuarioLocal = (id: string): Usuario[] => {
  const atuais = obterUsuariosLocais();
  const novos = atuais.filter(u => u.id !== id);
  localStorage.setItem('apex_usuarios', JSON.stringify(novos));
  return novos;
};

export const obterUsuariosSupabase = async (): Promise<Usuario[]> => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('nome', { ascending: true });

    const locais = obterUsuariosLocais();

    if (error || !data) {
      console.warn('Supabase usuários indisponível, usando localStorage:', error?.message);
      return locais;
    }

    const remotos: Usuario[] = data.map((u: any) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      senha: u.senha,
      role: u.role,
      permissoes: u.permissoes,
      empresaId: u.empresa_id || undefined,
      vendedorId: u.vendedor_id || u.vendedorId || undefined,
      created_at: u.created_at
    }));

    const mapa = new Map<string, Usuario>();
    remotos.forEach(u => mapa.set(u.email, u));
    locais.forEach(u => {
      if (!mapa.has(u.email)) mapa.set(u.email, u);
    });

    const listaFinal = Array.from(mapa.values());
    localStorage.setItem('apex_usuarios', JSON.stringify(listaFinal));
    return listaFinal;
  } catch (err) {
    console.warn('Erro ao buscar usuários do Supabase, usando locais:', err);
    return obterUsuariosLocais();
  }
};

export const salvarUsuarioSupabase = async (usuario: Usuario): Promise<void> => {
  salvarUsuarioLocal(usuario);
  try {
    const { error } = await supabase
      .from('usuarios')
      .upsert({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        senha: usuario.senha,
        role: usuario.role,
        permissoes: usuario.permissoes,
        empresa_id: usuario.empresaId || null,
        vendedor_id: usuario.vendedorId || null
      });

    if (error) {
      console.warn('Aviso ao salvar usuário no Supabase (salvo localmente):', error.message);
    }
  } catch (err) {
    console.warn('Erro Supabase salvar usuário (salvo localmente):', err);
  }
};

export const excluirUsuarioSupabase = async (id: string): Promise<void> => {
  excluirUsuarioLocal(id);
  try {
    const { error } = await supabase
      .from('usuarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Aviso ao excluir usuário no Supabase (removido localmente):', error.message);
    }
  } catch (err) {
    console.warn('Erro Supabase excluir usuário (removido localmente):', err);
  }
};

export const inicializarUsuarioMaster = async (): Promise<Usuario | null> => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*');

    if (error) {
      console.error('Erro na verificação de usuários do Supabase:', error);
      return null;
    }

    if (!data || data.length === 0) {
      // Banco vazio! Cria o usuário master padrão
      const master: Usuario = {
        id: 'u_master',
        nome: 'Super Administrador Master',
        email: 'master@apex.com',
        senha: 'master123',
        role: 'super_master',
        permissoes: {
          visualizar: true,
          editarVendas: true,
          cadastrarVendedores: true,
          cadastrarRegras: true
        }
      };
      await salvarUsuarioSupabase(master);
      console.log('Usuário master inicial cadastrado no Supabase com sucesso!');
      return master;
    }
    return null;
  } catch (err) {
    console.error('Falha ao rodar inicialização do Master:', err);
    return null;
  }
};

// ==========================================
// EMPRESAS
// ==========================================

export const EMPRESAS_PADRAO: Empresa[] = [
  { id: 'emp_vertex',  nome: 'Vertex',  ativo: true },
  { id: 'emp_winvest', nome: 'Winvest', ativo: true },
  { id: 'emp_shazam',  nome: 'Shazam',  ativo: true },
];

export const obterEmpresasLocais = (): Empresa[] => {
  try {
    const saved = localStorage.getItem('apex_empresas');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Erro ao ler apex_empresas:', e);
  }
  localStorage.setItem('apex_empresas', JSON.stringify(EMPRESAS_PADRAO));
  return EMPRESAS_PADRAO;
};

export const salvarEmpresaLocal = (empresa: Empresa): Empresa[] => {
  const atuais = obterEmpresasLocais();
  const index = atuais.findIndex(e => e.id === empresa.id);
  let novas: Empresa[];
  if (index >= 0) {
    novas = [...atuais];
    novas[index] = empresa;
  } else {
    novas = [...atuais, empresa];
  }
  localStorage.setItem('apex_empresas', JSON.stringify(novas));
  return novas;
};

export const excluirEmpresaLocal = (id: string): Empresa[] => {
  const atuais = obterEmpresasLocais();
  const novas = atuais.filter(e => e.id !== id);
  localStorage.setItem('apex_empresas', JSON.stringify(novas));
  return novas;
};

export const migrarTabelasHierarquia = async (): Promise<void> => {
  // Tenta adicionar as colunas e tabelas necessárias para a hierarquia empresa mãe/filha e tipoTabela Linear/Adesão e percentuais_parcelas
  try {
    // Adicionar empresa_mae_id nas empresas
    await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE empresas ADD COLUMN IF NOT EXISTS empresa_mae_id TEXT REFERENCES empresas(id);`
    });
  } catch { /* silencioso */ }

  try {
    // Adicionar empresa_id e colunas de Adesão e grade de parcelas nas regras_master
    await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE regras_master ADD COLUMN IF NOT EXISTS empresa_id TEXT;
            ALTER TABLE regras_master ADD COLUMN IF NOT EXISTS tipo_tabela TEXT DEFAULT 'Linear';
            ALTER TABLE regras_master ADD COLUMN IF NOT EXISTS percentual_adesao NUMERIC;
            ALTER TABLE regras_master ADD COLUMN IF NOT EXISTS percentual_mensal NUMERIC;
            ALTER TABLE regras_master ADD COLUMN IF NOT EXISTS percentuais_parcelas JSONB;
            ALTER TABLE regras_master ADD COLUMN IF NOT EXISTS percentual_comissao_contemplacao NUMERIC;`
    });
  } catch { /* silencioso */ }

  try {
    // Criar tabela regras_filha
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS regras_filha (
          id TEXT PRIMARY KEY,
          empresa_filha_id TEXT NOT NULL,
          regra_master_id TEXT NOT NULL,
          tipo_tabela TEXT DEFAULT 'Linear',
          percentual_comissao NUMERIC NOT NULL,
          percentual_adesao NUMERIC,
          percentual_mensal NUMERIC,
          percentuais_parcelas JSONB,
          percentual_comissao_contemplacao NUMERIC,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
  } catch { /* silencioso */ }

  try {
    // Adicionar colunas de hierarquia e grade de parcelas nas vendas
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE vendas ADD COLUMN IF NOT EXISTS venda_origem_id TEXT;
        ALTER TABLE vendas ADD COLUMN IF NOT EXISTS is_venda_espelho BOOLEAN DEFAULT false;
        ALTER TABLE vendas ADD COLUMN IF NOT EXISTS empresa_filha_origem_id TEXT;
        ALTER TABLE vendas ADD COLUMN IF NOT EXISTS tipo_tabela TEXT DEFAULT 'Linear';
        ALTER TABLE vendas ADD COLUMN IF NOT EXISTS percentual_adesao NUMERIC;
        ALTER TABLE vendas ADD COLUMN IF NOT EXISTS percentual_mensal NUMERIC;
        ALTER TABLE vendas ADD COLUMN IF NOT EXISTS percentuais_parcelas JSONB;
      `
    });
  } catch { /* silencioso */ }
};

export const migrarTabelaEmpresas = async (): Promise<void> => {
  const sql = `
    CREATE TABLE IF NOT EXISTS empresas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      empresa_mae_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE vendas   ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp_vertex';
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'emp_vertex';
    UPDATE vendas   SET empresa_id = 'emp_vertex' WHERE empresa_id IS NULL;
    UPDATE usuarios SET empresa_id = 'emp_vertex' WHERE empresa_id IS NULL;
  `;
  try {
    await supabase.rpc('exec_sql', { sql });
  } catch {
    // Silencioso
  }
};

export const obterEmpresasSupabase = async (): Promise<Empresa[]> => {
  try {
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .order('nome', { ascending: true });

    if (error || !data) {
      console.warn('Supabase empresas indisponível, usando localStorage:', error?.message);
      return obterEmpresasLocais();
    }

    const remotas: Empresa[] = data.map((e: any) => ({
      id: e.id,
      nome: e.nome,
      ativo: e.ativo,
      empresaMaeId: e.empresa_mae_id || undefined,
    }));

    if (remotas.length === 0) {
      return obterEmpresasLocais();
    }

    localStorage.setItem('apex_empresas', JSON.stringify(remotas));
    return remotas;
  } catch (err) {
    console.warn('Erro ao conectar Supabase empresas:', err);
    return obterEmpresasLocais();
  }
};

export const salvarEmpresaSupabase = async (empresa: Empresa): Promise<void> => {
  salvarEmpresaLocal(empresa);
  try {
    const { error } = await supabase
      .from('empresas')
      .upsert({
        id: empresa.id,
        nome: empresa.nome,
        ativo: empresa.ativo,
        empresa_mae_id: empresa.empresaMaeId || null,
      });

    if (error) {
      console.warn('Aviso ao salvar empresa no Supabase (salvo localmente):', error.message);
    }
  } catch (err) {
    console.warn('Erro Supabase empresas (salvo localmente):', err);
  }
};

export const excluirEmpresaSupabase = async (id: string): Promise<void> => {
  excluirEmpresaLocal(id);
  try {
    const { error } = await supabase
      .from('empresas')
      .delete()
      .eq('id', id);

    if (error) {
      console.warn('Aviso ao excluir empresa no Supabase (removido localmente):', error.message);
    }
  } catch (err) {
    console.warn('Erro Supabase excluir empresa (removido localmente):', err);
  }
};

export const inicializarEmpresasPadrao = async (): Promise<Empresa[]> => {
  const locais = obterEmpresasLocais();
  try {
    await migrarTabelaEmpresas();
    await migrarTabelasHierarquia();
    for (const emp of EMPRESAS_PADRAO) {
      await supabase
        .from('empresas')
        .upsert({ id: emp.id, nome: emp.nome, ativo: emp.ativo });
    }
    return await obterEmpresasSupabase();
  } catch (err) {
    console.warn('Falha ao inicializar empresas padrão no Supabase, usando locais:', err);
    return locais;
  }
};
