import { nomeUsuarioCabecalho, type UsuarioSessao } from "./auth";

function apiBasePadrao() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8001";
  }

  const { protocol, hostname } = window.location;
  const hostNormalizado = hostname.toLowerCase();
  if (!["localhost", "127.0.0.1"].includes(hostNormalizado)) {
    return "https://soulsul-production.up.railway.app";
  }
  return `${protocol}//${hostname}:8001`;
}

function apiBaseConfigurada() {
  const configurada = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!configurada) return apiBasePadrao();
  if (typeof window === "undefined") return configurada;
  const hostAtual = window.location.hostname;
  const hostConfigurado = configurada.replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0]?.toLowerCase();
  const emAmbienteLocal = ["localhost", "127.0.0.1"].includes(hostAtual);
  const configuracaoLocal = ["localhost", "127.0.0.1"].includes(hostConfigurado || "");
  if (!emAmbienteLocal && configuracaoLocal) {
    return apiBasePadrao();
  }
  // Keep local requests on the same hostname as the UI. Browsers consider
  // `localhost` and `127.0.0.1` distinct origins, which made large requests
  // (notably the financial panel) fail intermittently in local development.
  if (emAmbienteLocal && configuracaoLocal && hostConfigurado !== hostAtual) {
    return configurada.replace(hostConfigurado || "", hostAtual);
  }
  return configurada;
}

const API_BASE_URL = apiBaseConfigurada();
const API_BASE_FALLBACK_URL = apiBasePadrao();
const EDUCACAO_API_BASE_URL = typeof window !== "undefined" && !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ? `${window.location.origin}/edu-api`
  : `${API_BASE_URL}/api/educacao`;

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
  tratamentoSuspenso?: boolean;
};

export type AlunoApi = { id: number; codigo:string; nome: string; sexo:string; cpf: string; rg:string; data_nascimento:string; telefone: string; email: string; cep:string; endereco:string; complemento:string; numero:string; bairro:string; cidade:string; estado:string; estado_civil:string; cro:string; profissao:string; origem:string; menor_idade:boolean; responsavel:string; cpf_responsavel:string; indicado_por_aluno:string; indicado_clinica:boolean; observacoes: string; ativo: boolean };
export type AlunoPayloadApi = Omit<AlunoApi, "id" | "codigo">;
export type TreinamentoApi = { id: number; nome: string; categoria: string; descricao: string; cargaHoraria: number; valor: number; ativo: boolean; quantidadeTurmas:number; maxAlunosPorTurma:number; dataInicio:string; horarioInicio:string; periodicidade:string; diasHorarios:Record<string,{inicio:string;fim:string}> };
export type TreinamentoPayloadApi = { nome: string; categoria: string; descricao: string; carga_horaria: number; valor: number; ativo: boolean; quantidade_turmas:number; max_alunos_por_turma:number; data_inicio:string; horario_inicio:string; periodicidade:string; dias_horarios:Record<string,{inicio:string;fim:string}> };
export type TurmaTreinamentoApi = { id: number; treinamentoId: number; treinamentoNome: string; treinamentoValor:number; nome: string; instrutor: string; dataInicio: string; dataFim: string; horario: string; local: string; vagas: number; matriculados: number; status: string };
export type TurmaTreinamentoPayloadApi = { treinamento_id: number; nome: string; instrutor: string; data_inicio: string; data_fim: string; horario: string; local: string; vagas: number; status: string };
export type MatriculaTreinamentoApi = { id: number; alunoId: number; alunoNome: string; turmaId: number; turmaNome: string; treinamentoNome: string; dataMatricula: string; status: string; observacoes: string; valorCurso:number; entrada:number; parcelas:number; formaPagamento:string; contratoDisponivel:boolean; pacienteIndicadoFechou?:boolean; pacientesIndicadosFechados?:Array<{id:number;prontuario:string;nome:string}> };

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
  tratamentoSuspenso?: boolean;
  tratamentoSuspensoObservacao?: string;
  tratamentoSuspensoPor?: string;
  tratamentoSuspensoEm?: string;
};

export type TratamentoSuspensaoPayloadApi = {
  suspenso: boolean;
  observacao?: string;
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
  atividadesAcesso: boolean;
  atividadesAgendaDisponivel: boolean;
  atividadesEscopo: "PROPRIAS" | "EQUIPE" | string;
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
  atividades_acesso?: boolean;
  atividades_agenda_disponivel?: boolean;
  atividades_escopo?: string;
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
  criadoPor?: string;
  criadoEm?: string;
  etapas: OrdemServicoEtapaApi[];
  pacienteId?: number | null;
  pacienteNome?: string;
  prontuario?: string;
  status?: string;
  laboratorioId?: number | null;
  laboratorioNome?: string;
  statusAtualizadoPor?: string;
  statusAtualizadoEm?: string;
  movimentacoes?: GuiaMovimentacaoApi[];
};

export type GuiaMovimentacaoApi = {
  id: number;
  statusAnterior?: string;
  statusNovo: string;
  laboratorioId?: number | null;
  laboratorioNome?: string;
  observacao?: string;
  criadoPor?: string;
  criadoEm?: string;
};

export type GuiaLaboratorioApi = { id: number; nome: string; ativo: boolean };

export type OrdemServicoPayload = {
  procedimento_id: number;
  procedimento_nome?: string;
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
  jaFoiAprovado?: boolean;
  tipoMovimentoVenda?: string;
  valorVendaConsiderado?: number | null;
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
  historicoCobranca?: RecebivelHistoricoItemApi[];
};

export type RecebivelHistoricoItemApi = {
  id: number;
  status?: string;
  observacao?: string;
  cobrado?: boolean;
  criadoPor?: string;
  criadoEm?: string;
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
  cobranca_realizada?: boolean;
  observacao_cobranca?: string;
};

export type RecebivelLotePayload = {
  paciente_id?: number | null;
  paciente_nome: string;
  prontuario: string;
  forma_pagamento: string;
  status: string;
  observacao: string;
  primeiro_vencimento: string;
  novas_parcelas?: RecebivelRenegociacaoParcelaPayload[];
  suspender_anteriores?: boolean;
  observacao_renegociacao?: string;
};

export type RecebivelRenegociacaoParcelaPayload = {
  vencimento: string;
  valor: number;
  forma_pagamento: string;
  observacao?: string;
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

export type ImagemDocumentoPayloadApi = {
  nome: string;
  conteudo_base64: string;
};

export type RecebimentoBoletosPayloadApi = {
  imagens: ImagemDocumentoPayloadApi[];
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
  detalhamentos?: Array<{
    titulo: string;
    subtitulo?: string;
    meta?: string;
    valor?: string;
    status?: string;
  }>;
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

export type DashboardCalendarioPagamentoItemApi = {
  data?: string;
  total?: string;
  quantidade?: number;
  pagamentos?: ContaPagarResumoApi[];
};

export type DashboardDevedorResumoItemApi = {
  recebivelId: number;
  pacienteId?: number | null;
  nome: string;
  vencimento?: string;
  valor?: string;
  observacao?: string;
  status?: string;
};

export type DashboardVendaResumoItemApi = {
  contratoId: number;
  pacienteId?: number | null;
  nome: string;
  valor?: string;
  formaPagamento?: string;
  data?: string;
  incluirTotalVendido?: boolean;
};

export type DashboardFunilApi = {
  leads: number;
  agendou: number;
  compareceu: number;
  fechou: number;
  resgates?: number;
  resgatesSemOrcamento?: number;
  resgatesOrcamentoAntigo?: number;
  resgatesAte30Dias?: number;
  resgatesMais30Dias?: number;
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
  funilReal?: DashboardFunilApi;
  agendaHoje: DashboardAgendaHojeItemApi[];
  calendarioPagamentos?: DashboardCalendarioPagamentoItemApi[];
  devedoresResumo?: DashboardDevedorResumoItemApi[];
  vendasResumo?: DashboardVendaResumoItemApi[];
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
  nova_observacao?: string;
  tabela: string;
  desconto_percentual?: number;
  desconto_valor?: number;
  validade_orcamento?: string;
  data_retorno_crm?: string;
  forma_pagamento?: string;
  parcelas?: number;
  entrada?: boolean;
  plano_pagamento?: ParcelaPagamentoApi[];
  itens: OrcamentoItemPayload[];
};

export type OrcamentoCriadoApi = {
  contrato_id: number;
};

export type OrcamentoHistoricoItemApi = {
  id: number;
  tipo?: string;
  observacao?: string;
  criadoPor?: string;
  criadoEm?: string;
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
  dataRetornoCrm?: string;
  formaPagamento?: string;
  parcelas?: number;
  entrada?: boolean;
  planoPagamento?: ParcelaPagamentoApi[];
  itens: OrcamentoItemPayload[];
  historico?: OrcamentoHistoricoItemApi[];
  crmStatus?: string;
  crmObservacaoContato?: string;
  crmUltimoContatoEm?: string;
  crmUltimoContatoPor?: string;
  crmHistorico?: CrmResgateHistoricoItemApi[];
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
  cancelado?: boolean;
  avaliacao?: boolean;
  etapaFunil?: string;
  campanha?: string;
  canal?: string;
  ultimaAvaliacaoEm?: string;
  finalizadoEm?: string;
  canceladoEm?: string;
};

export type CrmPacienteItemApi = {
  id: number;
  pacienteId: number;
  nome: string;
  prontuario?: string;
  telefone?: string;
  origemFinalizado?: boolean;
  origemCancelado?: boolean;
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
  canceladoEm?: string;
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
  origemAvaliacao?: boolean;
  orcamentos?: Array<{
    contratoId: number;
    valorTotal?: string;
    observacao?: string;
    data?: string;
    status?: string;
    procedimentos?: string[];
  }>;
};

export type CrmPrimeiraAvaliacaoPerdidaItemApi = {
  pacienteId: number;
  nome: string;
  prontuario?: string;
  telefone?: string;
  dataAvaliacao?: string;
  profissional?: string;
  status?: string;
  procedimento?: string;
  motivo?: string;
  usuario?: string;
};

export type CrmResgateHistoricoItemApi = {
  id: number;
  status?: string;
  observacao?: string;
  proximoContato?: string;
  criadoPor?: string;
  criadoEm?: string;
  automatico?: boolean;
};

export type CrmResgateItemApi = {
  crmId?: number | null;
  contratoId: number;
  pacienteId: number;
  nome: string;
  cpf?: string;
  idadeAtual?: number | null;
  prontuario?: string;
  telefone?: string;
  dataOrcamento?: string;
  dataRetorno?: string;
  statusResgate?: string;
  observacaoContato?: string;
  observacaoAvaliacao?: string;
  observacaoOrcamento?: string;
  valorTotal?: string;
  procedimentos?: string[];
  ultimoContatoEm?: string;
  ultimoContatoPor?: string;
  historico?: CrmResgateHistoricoItemApi[];
};

export type CrmPainelApi = {
  pipeline: CrmPacienteItemApi[];
  finalizados: CrmPacienteItemApi[];
  cancelados: CrmPacienteItemApi[];
  avaliacoes: CrmAvaliacaoItemApi[];
  avaliacoesPrimeiraConsultaPerdida?: CrmPrimeiraAvaliacaoPerdidaItemApi[];
  resgates: CrmResgateItemApi[];
};

export type RelatorioComissoesApi = {
  inicio: string;
  fim: string;
  totalVendido: number;
  totalComissao: number;
  vendas: Array<{
    contratoId: number; pacienteId?: number | null; paciente: string; dataFechamento: string; valorContrato: number;
    formaPagamento: string; primeiroAgendamento: string; primeiroAgendador: string; avaliacaoComparecida: string;
    agendadorAvaliacao: string; agendadorFechamento: string; pagamentoConfirmado: boolean; comissaoTotal: number;
    comissaoCaptacao: number; comissaoResgate: number; status: string;
  }>;
  avaliacoes: Array<{
    agendamentoId: number; pacienteId?: number | null; paciente: string; data: string; hora: string; status: string;
    agendadoPor: string; agendadoEm: string; procedimentos: string;
  }>;
};

export type PlanoTratamentoPassoApi = {
  id: number;
  titulo: string;
  ordem: number;
  status: "Pendente" | "Agendado" | "Concluido" | "Cancelado";
  dataPrevista?: string;
  dataRealizacao?: string;
  observacao?: string;
};

export type PlanoTratamentoProcedimentoApi = {
  id: number;
  procedimentoId?: number | null;
  nome: string;
  contratoId?: number | null;
  origem: "Contrato" | "Manual";
  status: "Planejado" | "Em andamento" | "Concluido" | "Suspenso" | "Cancelado";
  observacao?: string;
  passos: PlanoTratamentoPassoApi[];
};

export type CrmConversaMensagemApi = {
  id: number;
  conversaId: number;
  canal?: string;
  direcao?: string;
  remetenteTipo?: string;
  remetenteExternoId?: string;
  tipoMensagem?: string;
  conteudo?: string;
  midiaUrl?: string;
  statusEnvio?: string;
  erroEnvio?: string;
  criadoEm?: string;
  mensagemExternaId?: string;
};

export type CrmConversaResumoApi = {
  id: number;
  crmId?: number | null;
  pacienteId?: number | null;
  pacienteNome?: string;
  prontuario?: string;
  canal?: string;
  contatoNome?: string;
  contatoTelefone?: string;
  contatoInstagram?: string;
  externoUsuarioId?: string;
  externoConversaId?: string;
  etapaFunil?: string;
  responsavel?: string;
  ultimaMensagem?: string;
  ultimaMensagemEm?: string;
  ultimaMensagemSentido?: string;
  naoLidas?: number;
  status?: string;
};

export type CrmConversaDetalheApi = CrmConversaResumoApi & {
  mensagens: CrmConversaMensagemApi[];
};

export type CrmConversaEnvioPayloadApi = {
  conteudo: string;
};

export type MetaConfiguracaoApi = {
  webhookVerifyTokenConfigurado: boolean;
  appSecretConfigurado: boolean;
  whatsappPhoneNumberIdConfigurado: boolean;
  whatsappAccessTokenConfigurado: boolean;
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

export type CrmNovoLeadPayloadApi = {
  nome: string;
  telefone: string;
};

export type CrmResgateAtualizacaoPayloadApi = {
  status: string;
  observacao: string;
  proximo_contato: string;
};

export type ChecklistUsuarioItemApi = {
  id: number;
  titulo: string;
  descricao?: string;
  tipoMeta: string;
  metaDiaria: number;
  progressoAtual: number;
  progressoManual: number;
  progressoAutomatico: number;
  concluido: boolean;
  concluidoManual: boolean;
  ativo: boolean;
  ordem: number;
  atualizadoEm?: string;
};

export type ChecklistUsuarioResumoApi = {
  total: number;
  concluidos: number;
  pendentes: number;
  progressoPercentual: number;
};

export type ChecklistUsuarioPainelApi = {
  dataReferencia: string;
  itens: ChecklistUsuarioItemApi[];
  resumo: ChecklistUsuarioResumoApi;
  tiposAutomaticos: Array<{ id: string; label: string }>;
};

export type ChecklistUsuarioItemPayloadApi = {
  titulo: string;
  descricao?: string;
  tipo_meta: string;
  meta_diaria: number;
  ativo?: boolean;
};

export type ChecklistUsuarioItemAtualizacaoPayloadApi = {
  titulo?: string;
  descricao?: string;
  tipo_meta?: string;
  meta_diaria?: number;
  ativo?: boolean;
  ordem?: number;
};

export type ChecklistUsuarioRegistroPayloadApi = {
  progresso_manual?: number;
  concluido_manual?: boolean;
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
  const metodo = String(init?.method || "GET").toUpperCase();
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  // The user header is used to authorize/audit mutations. Omitting it from
  // read-only requests keeps GETs simple (no CORS preflight) and avoids a
  // burst of competing preflights when React mounts a data-heavy page.
  if (usuario && !["GET", "HEAD", "OPTIONS"].includes(metodo) && !headers.has("x-usuario")) {
    headers.set("x-usuario", usuario);
  }
  if ((url.includes("/api/educacao/") || url.includes("/edu-api/")) && !url.endsWith("/auth/login")) {
    const tokenEducacao = localStorage.getItem("soulsul_educacao_token");
    if (tokenEducacao) {
      headers.set("Authorization", `Bearer ${tokenEducacao}`);
      headers.set("x-educacao-token", tokenEducacao);
    }
  }

  const requestInit: RequestInit = {
    ...init,
    cache: init?.cache ?? (metodo === "GET" ? "no-store" : undefined),
    headers
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
    if (response.status === 401 && (url.includes("/api/educacao/") || url.includes("/edu-api/")) && !url.endsWith("/auth/login")) {
      localStorage.removeItem("soulsul_educacao_token");
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/educacao")) {
        window.location.reload();
      }
    }
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

export const loginEducacaoApi = (usuario: string, senha: string) => fetchJson<{token:string;usuario:{id:number;nome:string;usuario:string;perfil:string;permissoes:Record<string,boolean>;precisaTrocarSenha:boolean}}>(`${EDUCACAO_API_BASE_URL}/auth/login`, { method: "POST", body: JSON.stringify({usuario, senha}) });
export const buscarRecursoEducacaoApi = <T,>(recurso: string) => fetchJson<T>(`${EDUCACAO_API_BASE_URL}/${recurso}`);
export type GuiaEducacaoApi={id:number;paciente_modelo_id:number;procedimento_id?:number;procedimento_nome_snapshot:string;cor?:string;escala?:string;elemento_arcada:string;carga_imediata?:number;retorno_solicitado:string;documento_nome?:string;observacoes?:string;criado_por?:string;criado_em?:string;etapas:Array<{etapa:string;descricao_outro?:string}>};
export const listarGuiasEducacaoApi=(pacienteId:number)=>fetchJson<GuiaEducacaoApi[]>(`${EDUCACAO_API_BASE_URL}/guias?paciente_modelo_id=${pacienteId}`);
export const criarGuiaEducacaoApi=(payload:Record<string,unknown>)=>fetchJson<GuiaEducacaoApi>(`${EDUCACAO_API_BASE_URL}/guias`,{method:"POST",body:JSON.stringify(payload)});
export async function baixarGuiaEducacaoApi(id:number,nome:string){const headers=new Headers();const token=localStorage.getItem("soulsul_educacao_token");if(token)headers.set("x-educacao-token",token);const response=await fetch(`${EDUCACAO_API_BASE_URL}/guias/${id}/documento`,{headers});if(!response.ok)throw new Error(`Não foi possível abrir a guia (${response.status}).`);const url=URL.createObjectURL(await response.blob());const a=document.createElement("a");a.href=url;a.download=nome||`GUIA_${id}.docx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export const criarRecursoEducacaoApi = <T,>(recurso: string, payload: Record<string, unknown>) => fetchJson<T>(`${EDUCACAO_API_BASE_URL}/${recurso}`, { method: "POST", body: JSON.stringify(payload) });
export const atualizarRecursoEducacaoApi = <T,>(recurso: string, id: number, payload: Record<string, unknown>) => fetchJson<T>(`${EDUCACAO_API_BASE_URL}/${recurso}/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const baixarLancamentoFinanceiroEducacaoApi = <T,>(id:number,payload:Record<string,unknown>) => fetchJson<T>(`${EDUCACAO_API_BASE_URL}/financeiro/${id}/baixar`,{method:"PUT",body:JSON.stringify(payload)});
export const buscarConfiguracoesFinanceiroEducacaoApi=()=>fetchJson<any>(`${EDUCACAO_API_BASE_URL}/financeiro/configuracoes`);
export const salvarConfiguracoesFinanceiroEducacaoApi=(payload:Record<string,unknown>)=>fetchJson<any>(`${EDUCACAO_API_BASE_URL}/financeiro/configuracoes`,{method:"PUT",body:JSON.stringify(payload)});
export const alterarStatusOrcamentoEducacaoApi = (id:number,status:string) => fetchJson<{ok:boolean;documento?:string}>(`${EDUCACAO_API_BASE_URL}/orcamentos/${id}/status`, { method:"PUT", body:JSON.stringify({status}) });
export const resetarSenhaUsuarioEducacaoApi = (id:number) => fetchJson<{ok:boolean;senhaPadrao:string}>(`${EDUCACAO_API_BASE_URL}/usuarios/${id}/resetar-senha`, { method:"POST" });
export const trocarSenhaEducacaoApi = (nova_senha:string) => fetchJson<{ok:boolean}>(`${EDUCACAO_API_BASE_URL}/auth/trocar-senha`, { method:"POST", body:JSON.stringify({nova_senha}) });
export async function baixarContratoEducacaoApi(id:number,nome:string) {
  const headers=new Headers(); const token=localStorage.getItem("soulsul_educacao_token"); if(token)headers.set("x-educacao-token",token);
  const response=await fetch(`${EDUCACAO_API_BASE_URL}/orcamentos/${id}/contrato`,{headers});
  if(!response.ok)throw new Error(`Não foi possível baixar o contrato (${response.status}).`);
  const url=URL.createObjectURL(await response.blob()); const link=document.createElement("a");link.href=url;link.download=nome;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export const listarAlunosApi = (q = "") => fetchJson<AlunoApi[]>(`${EDUCACAO_API_BASE_URL}/alunos?q=${encodeURIComponent(q)}`);
export const criarAlunoApi = (payload: AlunoPayloadApi) => fetchJson<AlunoApi>(`${EDUCACAO_API_BASE_URL}/alunos`, { method: "POST", body: JSON.stringify(payload) });
export const atualizarAlunoApi = (id: number, payload: AlunoPayloadApi) => fetchJson<AlunoApi>(`${EDUCACAO_API_BASE_URL}/alunos/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const excluirAlunoApi = (id: number, payload: { senha_gerencial: string; justificativa: string }) => fetchJson<{ ok: true }>(`${EDUCACAO_API_BASE_URL}/alunos/${id}/desativar`, { method: "POST", body: JSON.stringify(payload) });
export const listarAlunosExcluidosApi = () => fetchJson<Record<string, any>[]>(`${EDUCACAO_API_BASE_URL}/alunos-excluidos`);
export const desativarPacienteModeloEducacaoApi = (id: number, payload: { senha_gerencial: string; justificativa: string }) => fetchJson<{ ok: true }>(`${EDUCACAO_API_BASE_URL}/pacientes-modelo/${id}/desativar`, { method: "POST", body: JSON.stringify(payload) });
export const listarPacientesModeloExcluidosApi = () => fetchJson<Record<string, any>[]>(`${EDUCACAO_API_BASE_URL}/pacientes-modelo-excluidos`);
export const listarTreinamentosApi = () => fetchJson<TreinamentoApi[]>(`${EDUCACAO_API_BASE_URL}/treinamentos`);
export const criarTreinamentoApi = (payload: TreinamentoPayloadApi) => fetchJson<TreinamentoApi>(`${EDUCACAO_API_BASE_URL}/treinamentos`, { method: "POST", body: JSON.stringify(payload) });
export const atualizarTreinamentoApi = (id: number, payload: TreinamentoPayloadApi) => fetchJson<TreinamentoApi>(`${EDUCACAO_API_BASE_URL}/treinamentos/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const excluirTreinamentoApi = (id: number) => fetchJson<{ ok: true }>(`${EDUCACAO_API_BASE_URL}/treinamentos/${id}`, { method: "DELETE" });
export const listarTurmasTreinamentoApi = () => fetchJson<TurmaTreinamentoApi[]>(`${EDUCACAO_API_BASE_URL}/turmas`);
export const criarTurmaTreinamentoApi = (payload: TurmaTreinamentoPayloadApi) => fetchJson<TurmaTreinamentoApi>(`${EDUCACAO_API_BASE_URL}/turmas`, { method: "POST", body: JSON.stringify(payload) });
export const atualizarTurmaTreinamentoApi = (id: number, payload: TurmaTreinamentoPayloadApi) => fetchJson<TurmaTreinamentoApi>(`${EDUCACAO_API_BASE_URL}/turmas/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const alterarStatusTurmaEducacaoApi = (id: number, status: string) => fetchJson<{ ok: true }>(`${EDUCACAO_API_BASE_URL}/turmas/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
export const excluirTurmaTreinamentoApi = (id: number) => fetchJson<{ ok: true }>(`${EDUCACAO_API_BASE_URL}/turmas/${id}`, { method: "DELETE" });
export const listarMatriculasTreinamentoApi = () => fetchJson<MatriculaTreinamentoApi[]>(`${EDUCACAO_API_BASE_URL}/matriculas`);
export const criarMatriculaTreinamentoApi = (payload:Record<string,unknown>) => fetchJson<MatriculaTreinamentoApi>(`${EDUCACAO_API_BASE_URL}/matriculas`, { method: "POST", body: JSON.stringify(payload) });
export const excluirMatriculaTreinamentoApi = (id: number) => fetchJson<{ ok: true }>(`${EDUCACAO_API_BASE_URL}/matriculas/${id}`, { method: "DELETE" });
export const cancelarMatriculaTreinamentoApi = (id:number,payload:Record<string,unknown>) => fetchJson<{ok:true}>(`${EDUCACAO_API_BASE_URL}/matriculas/${id}/cancelar`,{method:"POST",body:JSON.stringify(payload)});
export async function baixarContratoMatriculaEducacaoApi(id:number,nome:string){const headers=new Headers();const token=localStorage.getItem("soulsul_educacao_token");if(token)headers.set("x-educacao-token",token);const response=await fetch(`${EDUCACAO_API_BASE_URL}/matriculas/${id}/contrato`,{headers});if(!response.ok)throw new Error(`Não foi possível gerar o contrato (${response.status}).`);const url=URL.createObjectURL(await response.blob());const a=document.createElement("a");a.href=url;a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

export async function listarPacientesApi(busca: string, limit = 50) {
  const params = new URLSearchParams();
  if (busca.trim()) params.set("q", busca.trim());
  params.set("limit", String(limit));
  return fetchJson<PacienteResumoApi[]>(`${API_BASE_URL}/api/pacientes?${params.toString()}`);
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

export async function listarControleGuiasApi() {
  return fetchJson<OrdemServicoResumoApi[]>(`${API_BASE_URL}/api/guias/controle`);
}

export async function listarLaboratoriosGuiasApi() {
  return fetchJson<GuiaLaboratorioApi[]>(`${API_BASE_URL}/api/guias/laboratorios`);
}

export async function criarLaboratorioGuiasApi(nome: string) {
  return fetchJson<GuiaLaboratorioApi>(`${API_BASE_URL}/api/guias/laboratorios`, { method: "POST", body: JSON.stringify({ nome, ativo: true }) });
}

export async function atualizarLaboratorioGuiasApi(id: number, nome: string, ativo: boolean) {
  return fetchJson<GuiaLaboratorioApi>(`${API_BASE_URL}/api/guias/laboratorios/${id}`, { method: "PUT", body: JSON.stringify({ nome, ativo }) });
}

export async function movimentarGuiaApi(id: number, payload: { status: string; laboratorio_id: number; observacao: string }) {
  return fetchJson<OrdemServicoResumoApi>(`${API_BASE_URL}/api/guias/${id}/movimentar`, { method: "PUT", body: JSON.stringify(payload) });
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

export async function marcarPacienteCanceladoCrmApi(pacienteId: number) {
  return fetchJson<CrmPacienteItemApi>(`${API_BASE_URL}/api/crm/pacientes/${pacienteId}/cancelado`, {
    method: "POST"
  });
}

export async function reativarPacienteCrmApi(pacienteId: number) {
  return fetchJson<CrmPacienteItemApi>(`${API_BASE_URL}/api/crm/pacientes/${pacienteId}/reativar`, {
    method: "POST"
  });
}

export async function removerPacienteCanceladoCrmApi(pacienteId: number) {
  return fetchJson<CrmPacienteItemApi>(`${API_BASE_URL}/api/crm/pacientes/${pacienteId}/cancelado/remover`, {
    method: "POST"
  });
}

export async function adicionarPacienteAvaliacaoCrmApi(pacienteId: number) {
  return fetchJson<CrmPacienteItemApi>(`${API_BASE_URL}/api/crm/pacientes/${pacienteId}/avaliacao`, {
    method: "POST"
  });
}

export async function removerPacienteAvaliacaoCrmApi(pacienteId: number) {
  return fetchJson<CrmPacienteItemApi>(`${API_BASE_URL}/api/crm/pacientes/${pacienteId}/avaliacao/remover`, {
    method: "POST"
  });
}

export async function adicionarPacienteManualCrmApi(payload: CrmNovoLeadPayloadApi) {
  return fetchJson<CrmPacienteItemApi>(`${API_BASE_URL}/api/crm/manual`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function atualizarCrmApi(crmId: number, payload: CrmAtualizacaoPayloadApi) {
  return fetchJson<CrmPacienteItemApi>(`${API_BASE_URL}/api/crm/${crmId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function atualizarCrmResgateApi(contratoId: number, payload: CrmResgateAtualizacaoPayloadApi) {
  return fetchJson<CrmResgateItemApi>(`${API_BASE_URL}/api/crm/resgates/${contratoId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function listarPlanoTratamentoApi(pacienteId: number) {
  return fetchJson<PlanoTratamentoProcedimentoApi[]>(`${API_BASE_URL}/api/pacientes/${pacienteId}/plano-tratamento`);
}

export async function adicionarProcedimentoPlanoApi(pacienteId: number, payload: { procedimento_id?: number; procedimento_nome?: string; observacao?: string; incluir_passos_padrao?: boolean }) {
  return fetchJson<PlanoTratamentoProcedimentoApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/plano-tratamento`, { method: "POST", body: JSON.stringify(payload) });
}

export async function adicionarPassoPlanoApi(planoId: number, payload: { titulo: string; data_prevista?: string; observacao?: string }) {
  return fetchJson<PlanoTratamentoPassoApi>(`${API_BASE_URL}/api/plano-tratamento/${planoId}/passos`, { method: "POST", body: JSON.stringify(payload) });
}

export async function atualizarProcedimentoPlanoApi(planoId: number, status: PlanoTratamentoProcedimentoApi["status"]) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/plano-tratamento/procedimentos/${planoId}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function atualizarPassoPlanoApi(passo: PlanoTratamentoPassoApi) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/plano-tratamento/passos/${passo.id}`, { method: "PATCH", body: JSON.stringify({ titulo: passo.titulo, status: passo.status, data_prevista: passo.dataPrevista || "", data_realizacao: passo.dataRealizacao || "", observacao: passo.observacao || "" }) });
}

export async function excluirPassoPlanoApi(passoId: number) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/plano-tratamento/passos/${passoId}`, { method: "DELETE" });
}

export async function buscarMetaConfiguracaoApi() {
  return fetchJson<MetaConfiguracaoApi>(`${API_BASE_URL}/api/meta/config`);
}

export async function listarCrmConversasApi(params?: { canal?: string; abertas_apenas?: boolean; busca?: string }) {
  const query = new URLSearchParams();
  if (params?.canal?.trim()) query.set("canal", params.canal.trim());
  if (params?.abertas_apenas) query.set("abertas_apenas", "true");
  if (params?.busca?.trim()) query.set("busca", params.busca.trim());
  const sufixo = query.toString() ? `?${query.toString()}` : "";
  return fetchJson<CrmConversaResumoApi[]>(`${API_BASE_URL}/api/crm/conversas${sufixo}`);
}

export async function buscarCrmConversaApi(conversaId: number) {
  return fetchJson<CrmConversaDetalheApi>(`${API_BASE_URL}/api/crm/conversas/${conversaId}`);
}

export async function enviarMensagemCrmConversaApi(conversaId: number, payload: CrmConversaEnvioPayloadApi) {
  return fetchJson<CrmConversaMensagemApi>(`${API_BASE_URL}/api/crm/conversas/${conversaId}/mensagens`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function buscarChecklistMeuApi() {
  return fetchJson<ChecklistUsuarioPainelApi>(`${API_BASE_URL}/api/checklist/me`);
}

export async function criarChecklistMeuApi(payload: ChecklistUsuarioItemPayloadApi) {
  return fetchJson<ChecklistUsuarioItemApi>(`${API_BASE_URL}/api/checklist/me`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function atualizarChecklistApi(checklistId: number, payload: ChecklistUsuarioItemAtualizacaoPayloadApi) {
  return fetchJson<ChecklistUsuarioItemApi>(`${API_BASE_URL}/api/checklist/${checklistId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function atualizarRegistroChecklistApi(checklistId: number, payload: ChecklistUsuarioRegistroPayloadApi) {
  return fetchJson<ChecklistUsuarioItemApi>(`${API_BASE_URL}/api/checklist/${checklistId}/registro`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function arquivarChecklistApi(checklistId: number) {
  return fetchJson<ChecklistUsuarioItemApi>(`${API_BASE_URL}/api/checklist/${checklistId}`, {
    method: "DELETE"
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

export async function buscarProximoProntuarioApi() {
  return fetchJson<{ prontuario: string }>(`${API_BASE_URL}/api/pacientes/proximo-prontuario`);
}

export async function atualizarPacienteApi(pacienteId: number, payload: PacienteApiPayload) {
  return fetchJson<PacienteDetalheApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function atualizarSuspensaoTratamentoPacienteApi(
  pacienteId: number,
  payload: TratamentoSuspensaoPayloadApi
) {
  return fetchJson<PacienteDetalheApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/tratamento-suspensao`, {
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

export async function redefinirSenhaUsuarioApi(usuarioId: number) {
  return fetchJson<LoginResposta>(`${API_BASE_URL}/api/usuarios/${usuarioId}/redefinir-senha`, {
    method: "POST"
  });
}

export async function listarUsuariosApi() {
  return fetchJson<UsuarioResumoApi[]>(`${API_BASE_URL}/api/usuarios`);
}

export type AgendaAtividadeApi = {
  id: number;
  titulo: string;
  descricao: string;
  responsavelId: number;
  responsavelNome: string;
  responsaveisIds: number[];
  responsaveisNomes: string[];
  dataAtividade: string;
  horaInicio: string;
  horaFim: string;
  prioridade: "Baixa" | "Normal" | "Alta" | "Urgente" | string;
  status: "Pendente" | "Em andamento" | "Concluída" | "Cancelada" | string;
  criadoPor: string;
  criadoEm: string;
  atualizadoPor: string;
  atualizadoEm: string;
  cor: string;
  secreta: boolean;
  confirmacoesLeitura: Array<{ usuarioId: number; nome: string; lida: boolean; lidaEm: string }>;
};

export type AgendaAtividadePayloadApi = {
  titulo: string;
  descricao: string;
  responsavel_id: number;
  responsaveis_ids: number[];
  data_atividade: string;
  hora_inicio: string;
  hora_fim: string;
  prioridade: string;
  status: string;
  cor: string;
  secreta: boolean;
};

export type ResponsavelAtividadeApi = { id: number; nome: string; cor?: string };
export type AtividadeNotificacaoApi = { id: number; atividadeId?: number | null; tipo: string; mensagem: string; lida: boolean; criadoEm: string };

function cabecalhoUsuarioAtividades(identificadorUsuario: string) {
  return { "X-Usuario": identificadorUsuario.trim() };
}

export async function listarResponsaveisAtividadesApi(identificadorUsuario: string) {
  return fetchJson<ResponsavelAtividadeApi[]>(`${API_BASE_URL}/api/atividades/responsaveis`, { headers: cabecalhoUsuarioAtividades(identificadorUsuario) });
}

export async function atualizarCorResponsavelAtividadesApi(usuarioId: number, cor: string, identificadorUsuario: string) {
  return fetchJson<ResponsavelAtividadeApi>(`${API_BASE_URL}/api/atividades/responsaveis/${usuarioId}/cor`, { method: "PATCH", headers: cabecalhoUsuarioAtividades(identificadorUsuario), body: JSON.stringify({ cor }) });
}

export async function listarAtividadesApi(dataInicio: string, dataFim: string, identificadorUsuario: string) {
  return fetchJson<AgendaAtividadeApi[]>(`${API_BASE_URL}/api/atividades?data_inicio=${encodeURIComponent(dataInicio)}&data_fim=${encodeURIComponent(dataFim)}`, { headers: cabecalhoUsuarioAtividades(identificadorUsuario) });
}

export async function criarAtividadeApi(payload: AgendaAtividadePayloadApi, identificadorUsuario: string) {
  return fetchJson<AgendaAtividadeApi>(`${API_BASE_URL}/api/atividades`, { method: "POST", headers: cabecalhoUsuarioAtividades(identificadorUsuario), body: JSON.stringify(payload) });
}

export async function atualizarAtividadeApi(id: number, payload: AgendaAtividadePayloadApi, identificadorUsuario: string) {
  return fetchJson<AgendaAtividadeApi>(`${API_BASE_URL}/api/atividades/${id}`, { method: "PUT", headers: cabecalhoUsuarioAtividades(identificadorUsuario), body: JSON.stringify(payload) });
}

export async function excluirAtividadeApi(id: number, identificadorUsuario: string) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/atividades/${id}`, { method: "DELETE", headers: cabecalhoUsuarioAtividades(identificadorUsuario) });
}

export async function listarNotificacoesAtividadesApi(identificadorUsuario: string) {
  return fetchJson<AtividadeNotificacaoApi[]>(`${API_BASE_URL}/api/atividades/notificacoes`, { headers: cabecalhoUsuarioAtividades(identificadorUsuario) });
}

export async function marcarNotificacaoAtividadeLidaApi(id: number, identificadorUsuario: string) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/atividades/notificacoes/${id}/lida`, { method: "PATCH", headers: cabecalhoUsuarioAtividades(identificadorUsuario) });
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

export async function atualizarControlesAtividadesUsuarioApi(usuarioId: number, payload: { atividades_acesso: boolean; atividades_agenda_disponivel: boolean; atividades_escopo: string }) {
  return fetchJson<UsuarioResumoApi>(`${API_BASE_URL}/api/usuarios/${usuarioId}/atividades`, {
    method: "PATCH",
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

export async function excluirOrcamentoPacienteApi(pacienteId: number, contratoId: number) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/pacientes/${pacienteId}/orcamentos/${contratoId}`, {
    method: "DELETE"
  });
}

export async function atualizarRecebivelPacienteApi(pacienteId: number, recebivelId: number, payload: RecebivelAtualizacaoPayload) {
  return fetchJson<RecebivelResumoApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/recebiveis/${recebivelId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function atualizarRecebiveisLoteApi(loteId: number | string, payload: RecebivelLotePayload) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/financeiro/recebiveis/lote/${encodeURIComponent(String(loteId))}`, {
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
  aprovadoPor = nomeUsuarioCabecalho() || "JULIANA",
  reaprovacao?: { tipo: "ALTERACAO" | "NOVA" | "ACRESCIMO"; valorAcrescimo?: number }
) {
  return fetchJson<{ ok: true }>(`${API_BASE_URL}/api/pacientes/${pacienteId}/orcamentos/${contratoId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, aprovado_por: aprovadoPor, tipo_reaprovacao: reaprovacao?.tipo || "", valor_acrescimo: reaprovacao?.valorAcrescimo || 0 })
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

export async function gerarRecebimentoBoletosPacienteApi(pacienteId: number, payload: RecebimentoBoletosPayloadApi) {
  return fetchJson<ArquivoPacienteItemApi>(`${API_BASE_URL}/api/pacientes/${pacienteId}/documentos/recebimento-boletos`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
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

export async function relatorioComissoesApi(inicio: string, fim: string) {
  const params = new URLSearchParams({ inicio, fim });
  return fetchJson<RelatorioComissoesApi>(`${API_BASE_URL}/api/relatorios/comissoes?${params.toString()}`);
}

export function urlExportarRelatorioComissoes(inicio: string, fim: string) {
  const params = new URLSearchParams({ inicio, fim });
  return `${API_BASE_URL}/api/relatorios/comissoes/export.xlsx?${params.toString()}`;
}

export async function painelDashboardApi() {
  return fetchJson<DashboardPainelApi>(`${API_BASE_URL}/api/dashboard`);
}

export async function atualizarInclusaoVendaDashboardApi(contratoId: number, incluir: boolean) {
  return fetchJson<{ ok: true; contratoId: number; incluirTotalVendido: boolean }>(
    `${API_BASE_URL}/api/dashboard/vendas/${contratoId}/inclusao-total`,
    { method: "PUT", body: JSON.stringify({ incluir }) }
  );
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
