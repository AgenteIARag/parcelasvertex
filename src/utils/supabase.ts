import { createClient } from '@supabase/supabase-js';
import type { LancamentoVenda, RegraMaster, Vendedor, Usuario } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fisnjgoggqvnvkyyyrwo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lMR0ukFHAcetODHl_3wB2g_tIQmi9Rt';

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
  return data || [];
};

export const salvarVendedorSupabase = async (vendedor: Vendedor): Promise<void> => {
  const { error } = await supabase
    .from('vendedores')
    .upsert({
      id: vendedor.id,
      nome: vendedor.nome,
      email: vendedor.email,
      ativo: vendedor.ativo
    });

  if (error) {
    console.error('Erro ao salvar vendedor no Supabase:', error);
    throw error;
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
  return data || [];
};

export const salvarRegraSupabase = async (regra: RegraMaster): Promise<void> => {
  const { error } = await supabase
    .from('regras_master')
    .upsert({
      id: regra.id,
      segmento: regra.segmento,
      tabela: regra.tabela,
      qtd_parcelas: regra.qtdParcelas,
      percentual_comissao: regra.percentualComissao
    });

  if (error) {
    console.error('Erro ao salvar regra no Supabase:', error);
    throw error;
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
  return (data || []).map((v: any) => ({
    id: v.id,
    cliente: v.cliente,
    vendedorId: v.vendedor_id,
    vendedorNome: v.vendedor_name || v.vendedor_nome, // suporta ambos
    dataVenda: v.data_venda,
    dataSegundaParcela: v.data_segunda_parcela,
    mesInicio: v.mes_inicio,
    segmento: v.segmento,
    tabela: v.tabela,
    qtdParcelas: v.qtd_parcelas,
    percentualComissao: Number(v.percentual_comissao),
    valorVenda: Number(v.valor_venda),
    valorParcela: Number(v.valor_parcela),
    projecaoMensal: v.projecao_mensal,
    totalVendas: Number(v.total_vendas),
    totalComissoes: Number(v.total_comissoes),
    statusCliente: v.status_cliente
  }));
};

export const salvarVendaSupabase = async (venda: LancamentoVenda): Promise<void> => {
  const { error } = await supabase
    .from('vendas')
    .upsert({
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
      projecao_mensal: venda.projecaoMensal,
      total_vendas: venda.totalVendas,
      total_comissoes: venda.totalComissoes,
      status_cliente: venda.statusCliente
    });

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

// --- USUÁRIOS E AUTENTICAÇÃO ---
export const obterUsuariosSupabase = async (): Promise<Usuario[]> => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao buscar usuários do Supabase:', error);
    throw error;
  }
  return data || [];
};

export const salvarUsuarioSupabase = async (usuario: Usuario): Promise<void> => {
  const { error } = await supabase
    .from('usuarios')
    .upsert({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      senha: usuario.senha,
      role: usuario.role,
      permissoes: usuario.permissoes
    });

  if (error) {
    console.error('Erro ao salvar usuário no Supabase:', error);
    throw error;
  }
};

export const excluirUsuarioSupabase = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('usuarios')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir usuário no Supabase:', error);
    throw error;
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
        nome: 'Administrador Master',
        email: 'master@apex.com',
        senha: 'master123',
        role: 'master',
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
