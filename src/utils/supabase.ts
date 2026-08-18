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
export const obterRegrasSupabase = async (): Promise<RegraMaster[]> => {
  const { data, error } = await supabase
    .from('regras_master')
    .select('*')
    .order('segmento', { ascending: true })
    .order('tabela', { ascending: true });

  if (error) {
    console.error('Erro ao buscar regras do Supabase:', error);
    throw error;
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    empresaId: r.empresa_id || undefined,
    segmento: r.segmento,
    tabela: r.tabela,
    qtdParcelas: Number(r.qtd_parcelas ?? r.qtdParcelas ?? 0),
    percentualComissao: Number(r.percentual_comissao ?? r.percentualComissao ?? 0),
    percentualComissaoContemplacao: r.percentual_comissao_contemplacao != null
      ? Number(r.percentual_comissao_contemplacao)
      : undefined
  }));
};

export const salvarRegraSupabase = async (regra: RegraMaster): Promise<void> => {
  const payload: Record<string, unknown> = {
    id: regra.id,
    segmento: regra.segmento,
    tabela: regra.tabela,
    qtd_parcelas: regra.qtdParcelas,
    percentual_comissao: regra.percentualComissao,
  };
  if (regra.empresaId) payload.empresa_id = regra.empresaId;
  if (regra.percentualComissaoContemplacao != null) {
    payload.percentual_comissao_contemplacao = regra.percentualComissaoContemplacao;
  }

  const { error } = await supabase.from('regras_master').upsert(payload);
  if (error) {
    // Tenta sem a coluna empresa_id se não existir
    if (error.code === '42703') {
      const { error: e2 } = await supabase.from('regras_master').upsert({
        id: regra.id,
        segmento: regra.segmento,
        tabela: regra.tabela,
        qtd_parcelas: regra.qtdParcelas,
        percentual_comissao: regra.percentualComissao,
      });
      if (e2) throw e2;
    } else {
      console.error('Erro ao salvar regra no Supabase:', error);
      throw error;
    }
  }
};

export const excluirRegraSupabase = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('regras_master')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir regra no Supabase:', error);
    throw error;
  }
};

// --- REGRAS FILHA ---
export const obterRegrasFilhaSupabase = async (empresaFilhaId?: string): Promise<RegraFilha[]> => {
  let query = supabase
    .from('regras_filha')
    .select('*')
    .order('created_at', { ascending: true });

  if (empresaFilhaId) {
    query = query.eq('empresa_filha_id', empresaFilhaId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('Tabela regras_filha não encontrada ou erro:', error.message);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    empresaFilhaId: r.empresa_filha_id,
    regraMasterId: r.regra_master_id,
    percentualComissao: Number(r.percentual_comissao),
    percentualComissaoContemplacao: r.percentual_comissao_contemplacao != null
      ? Number(r.percentual_comissao_contemplacao)
      : undefined
  }));
};

export const salvarRegraFilhaSupabase = async (regra: RegraFilha): Promise<void> => {
  const payload: Record<string, unknown> = {
    id: regra.id,
    empresa_filha_id: regra.empresaFilhaId,
    regra_master_id: regra.regraMasterId,
    percentual_comissao: regra.percentualComissao,
  };
  if (regra.percentualComissaoContemplacao != null) {
    payload.percentual_comissao_contemplacao = regra.percentualComissaoContemplacao;
  }

  const { error } = await supabase.from('regras_filha').upsert(payload);
  if (error) {
    console.error('Erro ao salvar regra filha no Supabase:', error);
    // Salva localmente como fallback
    salvarRegraFilhaLocal(regra);
    throw error;
  }
};

export const excluirRegraFilhaSupabase = async (id: string): Promise<void> => {
  const { error } = await supabase.from('regras_filha').delete().eq('id', id);
  if (error) {
    console.error('Erro ao excluir regra filha no Supabase:', error);
    throw error;
  }
};

// Fallback local para regras filha
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
      percentualComissao: Number(v.percentual_comissao),
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
    percentual_comissao: venda.percentualComissao,
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
  // Tenta adicionar as colunas e tabelas necessárias para a hierarquia empresa mãe/filha
  try {
    // Adicionar empresa_mae_id nas empresas
    await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE empresas ADD COLUMN IF NOT EXISTS empresa_mae_id TEXT REFERENCES empresas(id);`
    });
  } catch { /* silencioso */ }

  try {
    // Adicionar empresa_id nas regras_master
    await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE regras_master ADD COLUMN IF NOT EXISTS empresa_id TEXT;
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
          percentual_comissao NUMERIC NOT NULL,
          percentual_comissao_contemplacao NUMERIC,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
  } catch { /* silencioso */ }

  try {
    // Adicionar colunas de hierarquia nas vendas
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE vendas ADD COLUMN IF NOT EXISTS venda_origem_id TEXT;
        ALTER TABLE vendas ADD COLUMN IF NOT EXISTS is_venda_espelho BOOLEAN DEFAULT false;
        ALTER TABLE vendas ADD COLUMN IF NOT EXISTS empresa_filha_origem_id TEXT;
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
