import { nomeUsuarioCabecalho, type UsuarioSessao } from "./auth";

function apiBasePadrao() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8001";
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8001`;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || apiBasePadrao()).trim();
const API_BASE_FALLBACK_URL = apiBasePadrao();

export type PacienteApiPayload = {
  nome: string;
  apelido: string;
  sexo: string;
  prontuario?: string | null;
  cpf: string;
  rg: string;
  data_nascimento: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  complemento?: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  estado_civil: string;
  profissao?: string;
  origem?: string;
  observacoes: string;
  menor_idade: boolean;
  responsavel: string;
  cpf_responsavel: string;
};

export type PacienteResumoApi = {
  id: number;
  nome: string;
  apelido?: string;
  prontuario: string;
  cpf?: string;
  telefone?: string;
  email?: string;
  dataNascimento?: string;
  fotoUrl?: string;
};

export type PacienteDetalheApi = {
  id: number;
  nome: string;
  apelido?: string;
  sexo?: string;
  prontuario: string;
  cpf?: string;
  rg?: string;
  dataNascimento?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  endereco?: string;
  complemento?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  estadoCivil?: string;
  profissao?: string;
  origem?: string;
  observacoes?: string;
  menorIdade?: boolean;
  responsavel?: string;
  cpfResponsavel?: string;
  fotoUrl?: string;
};

export type ProcedimentoResumoApi = {
  id: number;
  nome: string;
  categoria?: string;
  valorPadrao: number;
  duracaoPadraoMinutos?: number;
  descricao?: string;
  etapasPadrao?: string[];
  materiaisPadrao?: string[];
  ativo: boolean;
};

export type UsuarioResumoApi = {
  id: number;
  nome: string;
  usuario: string;
  nomeAgenda: string;
  perfil: "Administrador" | "Usuario";
  cargo: "Administrador" | "Profissional" | "Recepcionista";
  agendaEscopo: "Toda a clinica" | "Somente a propria" | string;
  agendaDisponivel: boolean;
  status: "Ativo" | "Inativo" | string;
  ultimoAcesso: string;
  modulos: Record<string, string>;
  pacientesAbas: Record<string, string>;
};

export type UsuarioPayloadApi = {
  nome: string;
  usuario?: string;
  nome_agenda?: string;
  cargo: string;
  agenda_escopo: string;
  agenda_disponivel?: boolean;
  perfil?: string;
  ativo?: boolean;
  modulos?: Record<string, string>;
  pacientes_abas?: Record<string, string>;
};

export type ProcedimentoPayload = {
  nome: string;
  categoria: string;
  valor_padrao: number;
  duracao_padrao_minutos: number;
  descricao: string;
  etapas_padrao: string[];
  materiais_padrao: string[];
  ativo: boolean;
};

export type OrdemServicoEtapaApi = {
  etapa: string;
  descricao_outro?: string;
};

export type OrdemServicoResumoApi = {
  id: number;
  procedimentoId?: number | null;
  procedimentoNome: string;
  material?: string;
  materialOutro?: string;
  cor?: string;
  escala?: string;
  elementoArcada?: string;
  cargaImediata?: boolean;
  retornoSolicitado?: string;
  documentoNome?: string;
  observacao?: string;
  criadoEm?: string;
  etapas: OrdemServicoEtapaApi[];
};

export type OrdemServicoPayload = {
  procedimento_id: number;
  material: string;
  material_outro: string;
  cor: string;
  escala: string;
  elemento_arcada: string;
  carga_imediata: boolean;
  retorno_solicitado: string;
  observacao: string;
  etapas: OrdemServicoEtapaApi[];
};

export type ContratoResumoApi = {
  id: number;
  valorTotal: string;
  entrada: string;
  parcelas: number;
  primeiroVencimento?: string;
  dataCriacao?: string;
  formaPagamento?: string;
  status?: string;
  aprovadoPor?: string;
  dataAprovacao?: string;
  procedimentos: string[];
};

export type RecebivelResumoApi = {
  id: number;
  pacienteId?: number | null;
  pacienteNome?: string;
  prontuario?: string;
  contratoId?: number | null;
  parcela?: number | null;
  vencimento?: string;
  valor: string;
  formaPagamento?: string;
  status?: string;
  dataPagamento?: string;
  observacao?: string;
};

export type RecebivelAtualizacaoPayload = {
  paciente_nome: string;
  prontuario: string;
  vencimento: string;
  valor: number;
  forma_pagamento: string;
  status: string;
  data_pagamento: string;
  observacao: string;
};

export type RecebivelLotePayload = {
  paciente_nome: string;
  prontuario: string;
  forma_pagamento: string;
  status: string;
  observacao: string;
  primeiro_vencimento: string;
};

export type BaixaRecebivelPayload = {
  data_pagamento: string;
  forma_pagamento: string;
  conta_caixa: string;
  desconto_valor?: number;
  observacao: string;
};

export type MovimentoCaixaPayload = {
  origem: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_movimento: string;
  prontuario: string;
  forma_pagamento: string;
  conta_caixa: string;
  observacao: string;
  contrato_id?: number | null;
  recebivel_id?: number | null;
};

export type MovimentoCaixaAtualizacaoPayload = MovimentoCaixaPayload;

export type AgendamentoResumoApi = {
  id: number;
  data?: string;
  horario?: string;
  profissional?: string;
  status?: string;
  procedimento?: string;
  observacao?: string;
};

export type ArquivoPacienteItemApi = {
  nome: string;
  caminho: string;
  modificadoEm?: string;
  extensao?: string;
};

export type FinanceiroResumoApi = {
  total: string;
  emAberto: string;
  atrasado: string;
  pagos: string;
  quantidadeAtrasados: number;
  indicador: string;
};

export type MovimentoCaixaResumoApi = {
  id: number;
  data?: string;
  origem?: string;
  descricao?: string;
  valor: string;
  tipo?: string;
  prontuario?: string;
  formaPagamento?: string;
  contaCaixa?: string;
  observacao?: string;
  contratoId?: number | null;
  recebivelId?: number | null;
};

export type SaldoContaResumoApi = {
  id: number;
  data?: string;
  conta?: string;
  saldo: string;
  observacao?: string;
};

export type ReciboManualApi = {
  id: number;
  valor: string;
  pagador: string;
  recebedor: string;
  dataPagamento: string;
  referente: string;
  observacao: string;
  cidade: string;
  criadoEm: string;
};

export type MetaMensalApi = {
  ano: number;
  mes: number;
  mesNome: string;
  meta: number;
  supermeta: number;
  hipermeta: number;
  dataAtualizacao: string;
};

export type MetaMensalPayload = {
  meta: number;
  supermeta: number;
  hipermeta: number;
};

export type NotaFiscalEmitidaApi = {
  id: number;
  competencia: string;
  dataEmissao: string;
  dataRecebimento: string;
  numeroNf: string;
  serie: string;
  cliente: string;
  descricao: string;
  contaDestino: string;
  valorNf: string;
  valorRecebido: string;
  valorNfNumero: number;
  valorRecebidoNumero: number;
  diferenca: string;
  diferencaNumero: number;
  status: string;
  observacao: string;
  conciliado: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

export type NotaFiscalEmitidaPayload = {
  competencia: string;
  data_emissao: string;
  data_recebimento: string;
  numero_nf: string;
  serie: string;
  cliente: string;
  descricao: string;
  conta_destino: string;
  valor_nf: number;
  valor_recebido: number;
  status: string;
  observacao: string;
};

export type SaldoContaPayload = {
  data: string;
  conta: string;
  saldo: number;
  observacao: string;
};

export type ReciboManualPayload = {
  valor: number;
  pagador: string;
  recebedor: string;
  data_pagamento: string;
  referente: string;
  observacao: string;
  cidade: string;
};

export type ContaPagarResumoApi = {
  id: number;
  vencimento?: string;
  descricao?: string;
  fornecedor?: string;
  categoria?: string;
  valor: string;
  valorPago?: string;
  pagoEm?: string;
  status?: string;
  observacao?: string;
};

export type ContaPagarPayload = {
  vencimento: string;
  descricao: string;
  fornecedor: string;
  categoria: string;
  valor: number;
  valor_pago: number;
  pago_em: string;
  status: string;
  observacao: string;
};

export type LoginPayload = {
  usuario: string;
  senha: string;
};

export type LoginResposta = UsuarioSessao;

export type TrocaSenhaPayload = {
  usuario: string;
  senha_atual: string;
  nova_senha: string;
};

export type RedefinirSenhaPayload = {
  nova_senha: string;
};

export type UsuarioAtualizacaoPayload = {
  nome: string;
  cargo: string;
  agenda_escopo: string;
  ativo?: boolean;
};

export type FinanceiroPainelApi = {
  resumo: FinanceiroResumoApi;
  recebiveis: RecebivelResumoApi[];
  caixa: MovimentoCaixaResumoApi[];
  contasPagar: ContaPagarResumoApi[];
  saldosConta: SaldoContaResumoApi[];
};

export type DashboardIndicadorApi = {
  chave: string;
  titulo: string;
  valor: string;
  detalhe?: string;
};

export type DashboardResumoHojeApi = {
  entradasConfirmadas: string;
  saidasPrevistas: string;
  saldoProjetado: string;
};

export type DashboardAgendaHojeItemApi = {
  horario?: string;
  titulo?: string;
  subtitulo?: string;
};

export type DashboardAlertaApi = {
  titulo: string;
  detalhe: string;
};

export type DashboardAtividadeApi = {
  paciente: string;
  evento: string;
  valor: string;
  status: string;
};

export type DashboardPainelApi = {
  indicadores: DashboardIndicadorApi[];
  meses: string[];
  serieVendas: number[];
  resumoHoje: DashboardResumoHojeApi;
  metas: {
    vendidoMes: string;
    vendidoAno: string;
    metaMes: string;
    supermetaMes: string;
    hipermetaMes: string;
    faltaMetaMes: string;
    faltaMetaAno: string;
    percentualMetaMes: number;
    percentualMetaAno: number;
  };
  agendaHoje: DashboardAgendaHojeItemApi[];
  alertas: DashboardAlertaApi[];
  atividades: DashboardAtividadeApi[];
};

export type OdontogramaPacienteApi = {
  dentes_contratados: number[];
  elementos: Array<{
    elemento: string;
    dente?: number | null;
    denticao?: string;
    procedimentos: string[];
  }>;
};

export type OrcamentoRegiaoPayload = {
  regiao: string;
  dente?: number | null;
  valor: number;
  ativo: boolean;
  faces: string[];
};

export type OrcamentoItemPayload = {
  procedimento: string;
  profissional: string;
  denticao: string;
  valor_unitario: number;
  regioes: OrcamentoRegiaoPayload[];
};

export type ParcelaPagamentoApi = {
  indice: number;
  descricao: string;
  data: string;
  forma: string;
  valor: number;
  parcelas_cartao?: number;
};

export type OrcamentoPacientePayload = {
  clinica: string;
  criado_por: string;
  data: string;
  observacoes: string;
  tabela: string;
  desconto_percentual?: number;
  desconto_valor?: number;
  validade_orcamento?: string;
  forma_pagamento?: string;
  parcelas?: number;
  entrada?: boolean;
  plano_pagamento?: ParcelaPagamentoApi[];
  itens: OrcamentoItemPayload[];
};

export type OrcamentoCriadoApi = {
  contrato_id: number;
};

export type OrcamentoDetalheApi = {
  contrato_id: number;
  status: string;
  aprovadoPor?: string;
  dataAprovacao?: string;
  clinica: string;
  criadoPor: string;
  data: string;
  observacoes: string;
  tabela: string;
  descontoPercentual?: number;
  descontoValor?: number;
  validadeOrcamento?: string;
  formaPagamento?: string;
  parcelas?: number;
  entrada?: boolean;
  planoPagamento?: ParcelaPagamentoApi[];
  itens: OrcamentoItemPayload[];
};

export type FichaPacienteApi = {
  paciente: PacienteDetalheApi;
  contratos: ContratoResumoApi[];
  recebiveis: RecebivelResumoApi[];
  financeiro: FinanceiroResumoApi;
  agendamentos: AgendamentoResumoApi[];
  proximoAgendamento?: AgendamentoResumoApi | null;
  documentos: ArquivoPacienteItemApi[];
  exames: ArquivoPacienteItemApi[];
  recibos: RecebivelResumoApi[];
  crm?: CrmPacienteResumoApi | null;
};

export type CrmPacienteResumoApi = {
  crmId?: number | null;
  finalizado?: boolean;
  avaliacao?: boolean;
  etapaFunil?: string;
  campanha?: string;
  canal?: string;
  ultimaAvaliacaoEm?: string;
  finalizadoEm?: string;
};

export type CrmPacienteItemApi = {
  id: number;
  pacienteId: number;
  nome: string;
  prontuario?: string;
  telefone?: string;
  origemFinalizado?: boolean;
  origemAvaliacao?: boolean;
  etapaFunil?: string;
  canal?: string;
  campanha?: string;
  conjuntoAnuncio?: string;
  anuncio?: string;
  responsavel?: string;
  proximoContato?: string;
  observacao?: string;
  ultimaInteracao?: string;
  ultimaAvaliacaoEm?: string;
  finalizadoEm?: string;
  atualizadoEm?: string;
};

export type CrmAvaliacaoItemApi = {
  pacienteId: number;
  nome: string;
  prontuario?: string;
  telefone?: string;
  dataAvaliacao?: string;
  profissional?: string;
  status?: string;
  procedimento?: string;
  jaNoCrm?: boolean;
};

export type CrmPainelApi = {
  pipeline: CrmPacienteItemApi[];
  finalizados: CrmPacienteItemApi[];
  avaliacoes: CrmAvaliacaoItemApi[];
};

export type CrmAtualizacaoPayloadApi = {
  etapa_funil: string;
  canal: string;
  campanha: string;
  conjunto_anuncio: string;
  anuncio: string;
  responsavel: string;
  proximo_contato: string;
  observacao: string;
  ultima_interacao: string;
};

function normalizarErro(detail: unknown, fallback: string) {
  if (Array.isArray(detail)) {
    return detail.join(" ");
  }
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }
  return fallback;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const usuario = nomeUsuarioCabecalho();
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (usuario && !headers.has("x-usuario")) {
    headers.set("x-usuario", usuario);
  }

  const requestInit: RequestInit = {
    headers,
    ...init
  };

  let response: Response;
  try {
    response = await fetch(url, requestInit);
  } catch (error) {
    const podeTentarLocal =
      typeof window !== "undefined" &&
      API_BASE_URL !== API_BASE_FALLBACK_URL &&
      ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
      url.startsWith(API_BASE_URL);

    if (!podeTentarLocal) {
      throw error;
    }

    response = await fetch(url.replace(API_BASE_URL, API_BASE_FALLBACK_URL), requestInit);
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const detail = typeof body === "object" && body !== null && "detail" in body
      ? (body as { detail?: unknown }).detail
      : null;
    throw new Error(normalizarErro(detail, `Falha na requisição: ${response.status}`));
  }

  return response.json() as Promise<T>;
}

export function apiPacientesDisponivel() {
  return Boolean(API_BASE_URL);
}

export async function listarPacientesApi(busca: string) {
  const query = busca.trim() ? `?q=${encodeURIComponent(busca.trim())}` : "";
  return fetchJson<PacienteResumoApi[]>(`${API_BASE_URL}/api/pacientes${query}`);
}

export async function listarProcedimentosApi(busca = "", ativosApenas = true) {
  const params = new URLSearchParams();
  if (busca.trim()) params.set("q", busca.trim());
  params.set("ativos_apenas", ativosApenas ? "true" : "false");
  return fetchJson<ProcedimentoResumoApi[]>(`${API_BASE_URL}/api/procedimentos?${params.toString()}`);
}

export async function criarProcedimentoApi(payload: ProcedimentoPayload) {
  return fetchJson<ProcedimentoResumoApi>(`${API_BASE_URL}/api/procedimentos`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function atualizarProcedimentoApi(procedimentoId: number, payload: ProcedimentoPayload) {
  return fetchJson<ProcedimentoResumoApi>(`${API_BASE_URL}/api/procedimentos/${procedimentoId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function excluirProcedimentoApi(procedimentoId: number) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/procedimentos/${procedimentoId}`, {
    method: "DELETE"
  });
}

export async function listarOrdensServicoPacienteApi(pacienteId: number) {
  return fetchJson<OrdemServicoResumoApi[]>(`${API_BASE_URL}/api/pacientes/${pacienteId}/ordens-servico`);
}

export async function criarOrdemServicoPacienteApi(pacienteId: number, payload: OrdemServicoPayload) {
  return fetchJson<OrdemServicoResumoApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/ordens-servico`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listarPacientesRecentesApi() {
  return fetchJson<PacienteResumoApi[]>(`${API_BASE_URL}/api/pacientes/recentes`);
}

export async function detalharPacienteApi(pacienteId: number) {
  return fetchJson<PacienteDetalheApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}`);
}

export async function fichaPacienteApi(pacienteId: number) {
  return fetchJson<FichaPacienteApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/ficha`);
}

export async function listarCrmApi() {
  return fetchJson<CrmPainelApi>(`${API_BASE_URL}/api/crm`);
}

export async function marcarPacienteFinalizadoCrmApi(pacienteId: number) {
  return fetchJson<CrmPacienteItemApi>(`${API_BASE_URL}/api/crm/pacientes/${pacienteId}/finalizado`, {
    method: "POST"
  });
}

export async function adicionarPacienteAvaliacaoCrmApi(pacienteId: number) {
  return fetchJson<CrmPacienteItemApi>(`${API_BASE_URL}/api/crm/pacientes/${pacienteId}/avaliacao`, {
    method: "POST"
  });
}

export async function atualizarCrmApi(crmId: number, payload: CrmAtualizacaoPayloadApi) {
  return fetchJson<CrmPacienteItemApi>(`${API_BASE_URL}/api/crm/${crmId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function odontogramaPacienteApi(pacienteId: number) {
  return fetchJson<OdontogramaPacienteApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/odontograma`);
}

export async function criarPacienteApi(payload: PacienteApiPayload) {
  return fetchJson<PacienteDetalheApi>(`${API_BASE_URL}/api/pacientes`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function atualizarPacienteApi(pacienteId: number, payload: PacienteApiPayload) {
  return fetchJson<PacienteDetalheApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function urlFotoPaciente(pacienteId: number) {
  return `${API_BASE_URL}/api/pacientes/${pacienteId}/foto`;
}

export async function enviarFotoPacienteApi(pacienteId: number, arquivo: File) {
  const usuario = nomeUsuarioCabecalho();
  const response = await fetch(`${API_BASE_URL}/api/pacientes/${pacienteId}/foto`, {
    method: "POST",
    headers: {
      "Content-Type": arquivo.type || "application/octet-stream",
      "x-filename": arquivo.name,
      ...(usuario ? { "x-usuario": usuario } : {})
    },
    body: arquivo
  });

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const detail = typeof body === "object" && body !== null && "detail" in body
      ? (body as { detail?: unknown }).detail
      : null;
    throw new Error(normalizarErro(detail, `Falha na requisição: ${response.status}`));
  }

  return response.json() as Promise<PacienteDetalheApi>;
}

export async function loginApi(payload: LoginPayload) {
  return fetchJson<LoginResposta>(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function trocarSenhaApi(payload: TrocaSenhaPayload) {
  return fetchJson<LoginResposta>(`${API_BASE_URL}/api/auth/trocar-senha`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function redefinirSenhaUsuarioApi(usuarioId: number, payload: RedefinirSenhaPayload) {
  return fetchJson<LoginResposta>(`${API_BASE_URL}/api/usuarios/${usuarioId}/redefinir-senha`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listarUsuariosApi() {
  return fetchJson<UsuarioResumoApi[]>(`${API_BASE_URL}/api/usuarios`);
}

export async function criarUsuarioApi(payload: UsuarioPayloadApi) {
  return fetchJson<UsuarioResumoApi>(`${API_BASE_URL}/api/usuarios`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function atualizarUsuarioApi(usuarioId: number, payload: UsuarioPayloadApi) {
  return fetchJson<UsuarioResumoApi>(`${API_BASE_URL}/api/usuarios/${usuarioId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function excluirUsuarioApi(usuarioId: number) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/usuarios/${usuarioId}`, {
    method: "DELETE"
  });
}

export function urlExportarAcoesUsuariosApi(data: string) {
  const query = data ? `?data=${encodeURIComponent(data)}` : "";
  return `${API_BASE_URL}/api/usuarios/acoes/export.xlsx${query}`;
}

export async function criarOrcamentoPacienteApi(pacienteId: number, payload: OrcamentoPacientePayload) {
  return fetchJson<OrcamentoCriadoApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/orcamentos`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function detalharOrcamentoPacienteApi(pacienteId: number, contratoId: number) {
  return fetchJson<OrcamentoDetalheApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/orcamentos/${contratoId}`);
}

export async function atualizarOrcamentoPacienteApi(pacienteId: number, contratoId: number, payload: OrcamentoPacientePayload) {
  return fetchJson<OrcamentoCriadoApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/orcamentos/${contratoId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function atualizarRecebivelPacienteApi(pacienteId: number, recebivelId: number, payload: RecebivelAtualizacaoPayload) {
  return fetchJson<RecebivelResumoApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/recebiveis/${recebivelId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function atualizarRecebiveisLoteApi(contratoId: number, payload: RecebivelLotePayload) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/financeiro/recebiveis/lote/${contratoId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function baixarRecebivelPacienteApi(pacienteId: number, recebivelId: number, payload: BaixaRecebivelPayload) {
  return fetchJson<RecebivelResumoApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/recebiveis/${recebivelId}/baixar`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function alterarStatusOrcamentoPacienteApi(
  pacienteId: number,
  contratoId: number,
  status: "APROVADO" | "EM_ABERTO",
  aprovadoPor = "JULIANA"
) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/pacientes/${pacienteId}/orcamentos/${contratoId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, aprovado_por: aprovadoPor })
  });
}

export async function buscarCepApi(cep: string) {
  return fetchJson<{
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
  }>(`${API_BASE_URL}/api/pacientes/cep/${encodeURIComponent(cep)}`);
}

export function urlDocumentoPaciente(pacienteId: number, nomeArquivo: string, download = false) {
  return `${API_BASE_URL}/api/pacientes/${pacienteId}/documentos/${encodeURIComponent(nomeArquivo)}${download ? "?download=1" : ""}`;
}

export function urlReciboPaciente(pacienteId: number, recebivelId: number) {
  return `${API_BASE_URL}/api/pacientes/${pacienteId}/recibos/${recebivelId}`;
}

export function urlExamePaciente(pacienteId: number, nomeArquivo: string, download = false) {
  return `${API_BASE_URL}/api/pacientes/${pacienteId}/exames/${encodeURIComponent(nomeArquivo)}${download ? "?download=1" : ""}`;
}

export async function painelFinanceiroApi() {
  return fetchJson<FinanceiroPainelApi>(`${API_BASE_URL}/api/financeiro/painel`);
}

export async function painelDashboardApi() {
  return fetchJson<DashboardPainelApi>(`${API_BASE_URL}/api/dashboard`);
}

export async function listarMetasFinanceirasApi(ano: number) {
  return fetchJson<MetaMensalApi[]>(`${API_BASE_URL}/api/financeiro/metas?ano=${encodeURIComponent(String(ano))}`);
}

export async function atualizarMetaFinanceiraApi(ano: number, mes: number, payload: MetaMensalPayload) {
  return fetchJson<MetaMensalApi>(`${API_BASE_URL}/api/financeiro/metas/${ano}/${mes}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function listarNotasFiscaisEmitidasApi() {
  return fetchJson<NotaFiscalEmitidaApi[]>(`${API_BASE_URL}/api/financeiro/notas-fiscais`);
}

export async function criarNotaFiscalEmitidaApi(payload: NotaFiscalEmitidaPayload) {
  return fetchJson<NotaFiscalEmitidaApi>(`${API_BASE_URL}/api/financeiro/notas-fiscais`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function atualizarNotaFiscalEmitidaApi(notaId: number, payload: NotaFiscalEmitidaPayload) {
  return fetchJson<NotaFiscalEmitidaApi>(`${API_BASE_URL}/api/financeiro/notas-fiscais/${notaId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function criarContaPagarApi(payload: ContaPagarPayload) {
  return fetchJson<ContaPagarResumoApi>(`${API_BASE_URL}/api/financeiro/contas-pagar`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function atualizarContaPagarApi(contaId: number, payload: ContaPagarPayload) {
  return fetchJson<ContaPagarResumoApi>(`${API_BASE_URL}/api/financeiro/contas-pagar/${contaId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function criarMovimentoCaixaApi(payload: MovimentoCaixaPayload) {
  return fetchJson<MovimentoCaixaResumoApi>(`${API_BASE_URL}/api/financeiro/caixa`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function atualizarMovimentoCaixaApi(movimentoId: number, payload: MovimentoCaixaAtualizacaoPayload) {
  return fetchJson<MovimentoCaixaResumoApi>(`${API_BASE_URL}/api/financeiro/caixa/${movimentoId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function excluirMovimentoCaixaApi(movimentoId: number) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/financeiro/caixa/${movimentoId}`, {
    method: "DELETE"
  });
}

export async function baixarContaPagarApi(contaId: number, payload: BaixaRecebivelPayload) {
  return fetchJson<ContaPagarResumoApi>(`${API_BASE_URL}/api/financeiro/contas-pagar/${contaId}/baixar`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function criarSaldoContaApi(payload: SaldoContaPayload) {
  return fetchJson<SaldoContaResumoApi>(`${API_BASE_URL}/api/financeiro/saldos-conta`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function urlExportarCaixaExcel() {
  return `${API_BASE_URL}/api/financeiro/caixa/export.xlsx`;
}

export function urlExportarSistemaExcel() {
  return `${API_BASE_URL}/api/sistema/export.xlsx`;
}

export async function listarRecibosManuaisApi() {
  return fetchJson<ReciboManualApi[]>(`${API_BASE_URL}/api/financeiro/recibos`);
}

export async function criarReciboManualApi(payload: ReciboManualPayload) {
  return fetchJson<ReciboManualApi>(`${API_BASE_URL}/api/financeiro/recibos`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function urlReciboManual(reciboId: number) {
  return `${API_BASE_URL}/api/financeiro/recibos/${reciboId}`;
}
