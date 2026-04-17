import { eventosAgendaDia, pacientesMock, type EventoAgenda } from "./mockData";
import { nomeUsuarioCabecalho } from "./auth";
import { listarOrdensServicoPacienteApi } from "./pacientesApi";

function apiBasePadrao() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8002";
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8002`;
}

function apiBaseConfigurada() {
  const configurada = String(import.meta.env.VITE_AGENDA_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!configurada) return apiBasePadrao();
  if (typeof window === "undefined") return configurada;
  const hostAtual = window.location.hostname;
  const hostConfigurado = configurada.replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0]?.toLowerCase();
  const emAmbienteLocal = ["localhost", "127.0.0.1"].includes(hostAtual);
  const configuracaoLocal = ["localhost", "127.0.0.1"].includes(hostConfigurado || "");
  if (!emAmbienteLocal && configuracaoLocal) {
    return apiBasePadrao();
  }
  return configurada;
}

const API_BASE_URL = apiBaseConfigurada();
const API_BASE_FALLBACK_URL = apiBasePadrao();

export type AgendaApiAgendamento = {
  id: number;
  pacienteId?: number | null;
  paciente: string;
  prontuario: string;
  telefone: string;
  profissionalId: number;
  profissional: string;
  tipoAtendimentoId: number;
  tipoAtendimento: string;
  procedimentos: string[];
  status: string;
  data: string;
  inicio: string;
  fim: string;
  consultorio?: string | null;
  observacoes?: string;
  financeiro?: string;
  agendadoPor?: string;
  agendadoEm?: string;
  atualizadoPor?: string;
  atualizadoEm?: string;
  contratoId?: number | null;
  trabalhoTipo?: string;
  ordemServicoId?: number | null;
  ordemServicoDocumentoNome?: string;
  elementoArcada?: string;
  historico?: Array<{
    acao: string;
    descricao: string;
    criadoPor: string;
    criadoEm: string;
  }>;
};

export type AgendaDisponibilidadeResponse = {
  ocupados: string[];
  agendamentos: AgendaApiAgendamento[];
};

export type AgendaListaResponse = {
  agendamentos: AgendaApiAgendamento[];
};

export type AgendaPacienteBuscaItem = {
  id: number;
  nome: string;
  prontuario: string;
  celular: string;
};

export type AgendaProcedimentoContrato = {
  chave: string;
  contratoId: number;
  nome: string;
  sessoesTotal: number;
  sessoesRestantes: number;
  duracaoMinutos: number;
  valor?: string;
};

export type AgendaPacienteContexto = {
  id: number;
  nome: string;
  prontuario: string;
  celular: string;
  procedimentosContratados: AgendaProcedimentoContrato[];
  guiasEmitidas: Array<{
    id: number;
    procedimentoNome: string;
    retornoSolicitado?: string;
    documentoNome: string;
    elementoArcada?: string;
    dataEmissao?: string;
    etapasResumo?: string;
  }>;
};

export type AgendaProcedimentoPayload = {
  nome: string;
  origem: "contrato" | "manual";
  contratoId?: number | null;
  procedimentoId?: number | null;
  duracaoMinutos?: number;
};

export type AgendaSalvarPayload = {
  pacienteId?: number | null;
  nomePaciente: string;
  prontuario?: string;
  telefone?: string;
  profissionalId: number;
  profissionalNome: string;
  tipoAtendimentoId: number;
  tipoAtendimentoNome: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  duracaoMinutos: number;
  status?: string;
  agendadoPor: string;
  agendadoEm: string;
  observacoes?: string;
  trabalhoTipo?: string;
  ordemServicoId?: number | null;
  ordemServicoDocumentoNome?: string;
  elementoArcada?: string;
  procedimentos: AgendaProcedimentoPayload[];
};

export type AgendaDetalheResponse = AgendaApiAgendamento;

export type AgendaDiaConfiguracaoApi = {
  ativo: boolean;
  inicio: string;
  fim: string;
  almocoInicio: string;
  almocoFim: string;
  consultorio?: string;
};

export type AgendaProfissionalConfiguracaoApi = {
  id: number;
  nomeAgenda: string;
  usuarioVinculado: string;
  mostrar: boolean;
  cor: string;
  corSuave: string;
  maxAgendamentosPorHorario: number;
  configuracaoDias: Record<string, AgendaDiaConfiguracaoApi>;
};

export type AgendaConfiguracaoApi = {
  salas: string[];
  ordemProfissionais: number[];
  configClinicaDias: Record<string, AgendaDiaConfiguracaoApi>;
  configProfissionais: AgendaProfissionalConfiguracaoApi[];
};

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizarDataAgenda(valor: string) {
  const texto = String(valor || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return texto;
}

function paraMinutos(hora: string) {
  const [horas, minutos] = hora.split(":").map(Number);
  return horas * 60 + minutos;
}

function adicionarMinutos(hora: string, minutos: number) {
  const total = paraMinutos(hora) + minutos;
  const horas = String(Math.floor(total / 60)).padStart(2, "0");
  const mins = String(total % 60).padStart(2, "0");
  return `${horas}:${mins}`;
}

function gerarSlotsQuinzeMinutos(inicio = "07:00", fim = "20:15") {
  const slots: string[] = [];
  let atual = paraMinutos(inicio);
  const limite = paraMinutos(fim);
  while (atual < limite) {
    const horas = String(Math.floor(atual / 60)).padStart(2, "0");
    const minutos = String(atual % 60).padStart(2, "0");
    slots.push(`${horas}:${minutos}`);
    atual += 15;
  }
  return slots;
}

function mapearEventoMock(evento: EventoAgenda): AgendaApiAgendamento {
  return {
    id: evento.id,
    paciente: evento.paciente,
    prontuario: evento.prontuario,
    telefone: evento.telefone,
    profissionalId: evento.profissionalId,
    profissional: evento.profissional,
    tipoAtendimentoId: evento.tipoAtendimentoId,
    tipoAtendimento: evento.tipoAtendimento,
    procedimentos: [evento.procedimento],
    status: evento.status,
    data: evento.data,
    inicio: evento.inicio,
    fim: evento.fim,
    observacoes: evento.observacoes,
    financeiro: evento.financeiro,
    agendadoEm: "19/03/2026 18:07"
  };
}

function mapearEventoApi(evento: AgendaApiAgendamento): AgendaApiAgendamento {
  return {
    ...evento,
    data: normalizarDataAgenda(evento.data)
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const usuario = nomeUsuarioCabecalho();
  const headers = new Headers(init?.headers);
  if (usuario && !headers.has("x-usuario")) {
    headers.set("x-usuario", usuario);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
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
    throw new Error(`Falha na requisição: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function buscarDisponibilidadeAgenda(
  profissionalId: number,
  data: string
): Promise<AgendaDisponibilidadeResponse> {
  if (API_BASE_URL) {
    try {
      return await fetchJson<AgendaDisponibilidadeResponse>(
        `${API_BASE_URL}/api/agenda/disponibilidade?profissional_id=${profissionalId}&data=${encodeURIComponent(data)}`
      );
    } catch {
      // segue para fallback local
    }
  }

  const slots = gerarSlotsQuinzeMinutos();
  const eventos = eventosAgendaDia
    .map(mapearEventoMock)
    .filter((evento) => evento.profissionalId === profissionalId && evento.data === data);

  const ocupados = new Set<string>();
  eventos.forEach((evento) => {
    const inicio = paraMinutos(evento.inicio);
    const fim = paraMinutos(evento.fim);
    slots.forEach((slot) => {
      const minutoSlot = paraMinutos(slot);
      if (minutoSlot >= inicio && minutoSlot < fim) {
        ocupados.add(slot);
      }
    });
  });

  return {
    ocupados: Array.from(ocupados),
    agendamentos: eventos
  };
}

export async function listarAgendamentosAgenda(
  dataInicio: string,
  dataFim?: string
): Promise<AgendaApiAgendamento[]> {
  const dataFimReal = dataFim || dataInicio;

  if (API_BASE_URL) {
    try {
      const resposta = await fetchJson<AgendaListaResponse>(
        `${API_BASE_URL}/api/agenda/agendamentos?data_inicio=${encodeURIComponent(dataInicio)}&data_fim=${encodeURIComponent(dataFimReal)}`
      );
      return resposta.agendamentos.map(mapearEventoApi);
    } catch {
      // segue para fallback local
    }
  }

  return eventosAgendaDia
    .map(mapearEventoMock)
    .filter((evento) => evento.data >= dataInicio && evento.data <= dataFimReal);
}

export async function buscarConfiguracaoAgendaApi(): Promise<AgendaConfiguracaoApi> {
  return fetchJson<AgendaConfiguracaoApi>(`${API_BASE_URL}/api/agenda/configuracao`);
}

export async function salvarConfiguracaoAgendaApi(payload: AgendaConfiguracaoApi): Promise<AgendaConfiguracaoApi> {
  return fetchJson<AgendaConfiguracaoApi>(`${API_BASE_URL}/api/agenda/configuracao`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function buscarPacientesAgenda(texto: string): Promise<AgendaPacienteBuscaItem[]> {
  if (!texto.trim()) return [];

  if (API_BASE_URL) {
    try {
      return await fetchJson<AgendaPacienteBuscaItem[]>(
        `${API_BASE_URL}/api/agenda/pacientes/buscar?q=${encodeURIComponent(texto)}`
      );
    } catch {
      // segue para fallback local
    }
  }

  const termo = normalizarTexto(texto);
  return pacientesMock
    .filter((paciente) => {
      const alvo = `${paciente.nome} ${paciente.apelido ?? ""} ${paciente.prontuario} ${paciente.telefone}`;
      return normalizarTexto(alvo).includes(termo);
    })
    .slice(0, 8)
    .map((paciente) => ({
      id: paciente.id,
      nome: paciente.nome,
      prontuario: paciente.prontuario,
      celular: paciente.telefone
    }));
}

export async function buscarContextoPacienteAgenda(
  pacienteId: number
): Promise<AgendaPacienteContexto> {
  if (API_BASE_URL) {
    try {
      return await fetchJson<AgendaPacienteContexto>(
        `${API_BASE_URL}/api/agenda/pacientes/${pacienteId}/contexto`
      );
    } catch {
      // segue para fallback local
    }
  }

  const paciente = pacientesMock.find((item) => item.id === pacienteId);
  if (!paciente) {
    throw new Error("Paciente não encontrado.");
  }

  const procedimentosContratados = paciente.contratos.flatMap((contrato) =>
    contrato.procedimentos.reduce<AgendaProcedimentoContrato[]>((acumulador, procedimento) => {
      const utilizados = paciente.agendamentos.filter((agendamento) =>
        normalizarTexto(agendamento.procedimento) === normalizarTexto(procedimento.nome)
      ).length;

      const sessoesTotal = 1;
      const sessoesRestantes = Math.max(0, sessoesTotal - utilizados);
      if (sessoesRestantes <= 0) {
        return acumulador;
      }

      acumulador.push({
        chave: `${contrato.id}-${procedimento.nome}`,
        contratoId: contrato.id,
        nome: procedimento.nome,
        sessoesTotal,
        sessoesRestantes,
        duracaoMinutos: 45,
        valor: procedimento.valor
      });
      return acumulador;
    }, [])
  );

  let guiasEmitidas: AgendaPacienteContexto["guiasEmitidas"] = [];
  try {
    const ordens = await listarOrdensServicoPacienteApi(pacienteId);
    guiasEmitidas = ordens.map((item) => ({
      id: item.id,
      procedimentoNome: item.procedimentoNome,
      retornoSolicitado: item.retornoSolicitado,
      documentoNome: item.documentoNome || `Guia ${item.id}`,
      elementoArcada: item.elementoArcada || "",
      dataEmissao: item.criadoEm || "",
      etapasResumo: (item.etapas || [])
        .map((etapa) => etapa.etapa === "Outro" ? etapa.descricao_outro || "Outro" : etapa.etapa)
        .filter(Boolean)
        .join(" | ")
    }));
  } catch {
    guiasEmitidas = [];
  }

  return {
    id: paciente.id,
    nome: paciente.nome,
    prontuario: paciente.prontuario,
    celular: paciente.telefone,
    procedimentosContratados,
    guiasEmitidas
  };
}

export async function salvarAgendamentoAgenda(
  payload: AgendaSalvarPayload
): Promise<AgendaDetalheResponse> {
  if (API_BASE_URL) {
    return fetchJson<AgendaDetalheResponse>(`${API_BASE_URL}/api/agenda/agendamentos`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    id: Math.floor(Math.random() * 100000),
    pacienteId: payload.pacienteId ?? null,
    paciente: payload.nomePaciente,
    prontuario: payload.prontuario ?? "",
    telefone: payload.telefone ?? "",
    profissionalId: payload.profissionalId,
    profissional: payload.profissionalNome,
    tipoAtendimentoId: payload.tipoAtendimentoId,
    tipoAtendimento: payload.tipoAtendimentoNome,
    procedimentos: payload.procedimentos.map((item) => item.nome),
    status: payload.status ?? "Agendado",
    data: payload.data,
    inicio: payload.horaInicio,
    fim: payload.horaFim,
    observacoes: payload.observacoes,
    financeiro: "Sem vínculo",
    agendadoEm: payload.agendadoEm,
    contratoId: payload.procedimentos.find((item) => item.contratoId)?.contratoId ?? null,
    trabalhoTipo: payload.trabalhoTipo ?? "",
    ordemServicoId: payload.ordemServicoId ?? null,
    ordemServicoDocumentoNome: payload.ordemServicoDocumentoNome ?? ""
  };
}

export async function atualizarAgendamentoAgenda(
  agendamentoId: number,
  payload: AgendaSalvarPayload
): Promise<AgendaDetalheResponse> {
  if (API_BASE_URL) {
    return fetchJson<AgendaDetalheResponse>(`${API_BASE_URL}/api/agenda/agendamentos/${agendamentoId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }

  return {
    id: agendamentoId,
    pacienteId: payload.pacienteId ?? null,
    paciente: payload.nomePaciente,
    prontuario: payload.prontuario ?? "",
    telefone: payload.telefone ?? "",
    profissionalId: payload.profissionalId,
    profissional: payload.profissionalNome,
    tipoAtendimentoId: payload.tipoAtendimentoId,
    tipoAtendimento: payload.tipoAtendimentoNome,
    procedimentos: payload.procedimentos.map((item) => item.nome),
    status: payload.status ?? "Agendado",
    data: payload.data,
    inicio: payload.horaInicio,
    fim: payload.horaFim,
    observacoes: payload.observacoes,
    financeiro: payload.procedimentos.some((item) => item.contratoId) ? "Financeiro Ok" : "Sem vínculo",
    agendadoEm: payload.agendadoEm,
    contratoId: payload.procedimentos.find((item) => item.contratoId)?.contratoId ?? null,
    trabalhoTipo: payload.trabalhoTipo ?? "",
    ordemServicoId: payload.ordemServicoId ?? null,
    ordemServicoDocumentoNome: payload.ordemServicoDocumentoNome ?? ""
  };
}

export async function buscarDetalhesAgendamentoAgenda(
  agendamentoId: number
): Promise<AgendaDetalheResponse> {
  if (API_BASE_URL) {
    return fetchJson<AgendaDetalheResponse>(`${API_BASE_URL}/api/agenda/agendamentos/${agendamentoId}`);
  }

  const evento = eventosAgendaDia.map(mapearEventoMock).find((item) => item.id === agendamentoId);
  if (!evento) {
    throw new Error("Agendamento não encontrado.");
  }
  return evento;
}

export { adicionarMinutos, gerarSlotsQuinzeMinutos, paraMinutos };
