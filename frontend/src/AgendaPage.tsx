import {
  Ban,
  CalendarX2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Plus,
  Printer,
  RefreshCcw,
  Settings,
  UserRoundPlus,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  adicionarMinutos,
  atualizarAgendamentoAgenda,
  buscarConfiguracaoAgendaApi,
  buscarContextoPacienteAgenda,
  buscarDetalhesAgendamentoAgenda,
  buscarDisponibilidadeAgenda,
  gerarSlotsQuinzeMinutos,
  listarAgendamentosAgenda,
  paraMinutos,
  salvarConfiguracaoAgendaApi,
  salvarAgendamentoAgenda,
  type AgendaApiAgendamento,
  type AgendaConfiguracaoApi,
  type AgendaPacienteBuscaItem,
  type AgendaProcedimentoContrato,
  type AgendaProcedimentoPayload,
  type AgendaSalvarPayload
} from "./agendaApi";
import { criarPacienteApi, listarPacientesApi, listarUsuariosApi, type PacienteApiPayload, type UsuarioResumoApi } from "./pacientesApi";
import { tiposAtendimentoAgenda } from "./mockData";
import type { UsuarioSessao } from "./auth";

type AgendaView = "Dia" | "Semana" | "Mês";
type AgendaTab = "Nova Consulta" | "Compromisso" | "Evento";

type AgendaEventoUI = AgendaApiAgendamento & {
  agendadoPor?: string;
  marcadores?: string[];
};

type ModalFormState = {
  data: string;
  profissionalId: number;
  tipoAtendimentoId: number;
  status: AgendaEventoUI["status"];
  pacienteId: number | null;
  pacienteBusca: string;
  nomePaciente: string;
  prontuario: string;
  celular: string;
  observacoes: string;
  agendadoPor: string;
  agendadoEm: string;
  horarioInicio: string;
  horarioFim: string;
  duracaoMinutos: number;
  trabalhoTipo: string;
  ordemServicoId: number | null;
  ordemServicoDocumentoNome: string;
  elementoArcada: string;
};

type ProcedimentoSelecionado = {
  chave: string;
  nome: string;
  origem: "contrato" | "manual";
  contratoId?: number | null;
  duracaoMinutos: number;
};

type SlotRascunho = {
  data: string;
  hora: string;
  profissionalId: number;
};

type DetalhePopoverPosicao = {
  top: number;
  left: number;
  placement: "left" | "right";
};

type DesmarqueConsultaForm = {
  aberto: boolean;
  motivo: string;
  responsavel: "Paciente" | "Profissional";
};

const SLOT_HEIGHT = 24;
const HORARIOS = gerarSlotsQuinzeMinutos("07:00", "20:00");
const MINUTO_INICIAL_AGENDA = paraMinutos("07:00");
const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const NOMES_DIAS_LONGOS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const CORES_AGENDA = ["#f4b2be", "#f6e88f", "#ff8d0a", "#ff2f2f", "#ef10ff", "#8ce07a", "#9f92f0", "#7ccfd8", "#f7a9b8"];
const NOMES_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

type AgendaPageProps = {
  usuarioLogado?: UsuarioSessao | null;
  onAbrirPaciente?: (pacienteId: number, destino: "cadastro" | "financeiro" | "orcamentos" | "ordem_servico") => void;
  onAbrirNovoPaciente?: () => void;
};

function statusOcultoNaAgenda(status?: string) {
  return String(status || "").trim().toLowerCase() === "desmarcado";
}

type ConfigProfissionalAgenda = {
  id: number;
  nomeAgenda: string;
  usuarioVinculado: string;
  mostrar: boolean;
  cor: string;
  corSuave: string;
  maxAgendamentosPorHorario: number;
  configuracaoDias: Record<number, { ativo: boolean; inicio: string; fim: string; almocoInicio: string; almocoFim: string; consultorio?: string }>;
};

type AgendaConfiguracaoPersistida = {
  totalConsultorios?: number;
  salas: string[];
  ordemProfissionais: number[];
  configClinicaDias: Record<number, { ativo: boolean; inicio: string; fim: string; almocoInicio: string; almocoFim: string }>;
  configProfissionais: ConfigProfissionalAgenda[];
};

const SALAS_PADRAO_AGENDA = [
  "CONSULTÓRIO 1",
  "CONSULTÓRIO 2",
  "CONSULTÓRIO 3",
  "AVALIAÇÃO",
  "FINANCEIRO",
  "T.O. FISIOTERAPIA",
  "FONO"
];

function normalizarNomeSala(valor: string) {
  return valor
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizarListaSalas(salas?: string[]) {
  const vistos = new Set<string>();
  const resultado = (salas || [])
    .map((item) => normalizarNomeSala(item))
    .filter((item) => {
      if (!item || vistos.has(item)) return false;
      vistos.add(item);
      return true;
    });
  return resultado.length ? resultado : [...SALAS_PADRAO_AGENDA];
}

function isoParaBr(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-");
  if (!ano || !mes || !dia) return dataIso;
  return `${dia}/${mes}/${ano}`;
}

function brParaIso(dataBr: string) {
  const [dia, mes, ano] = dataBr.split("/");
  if (!ano || !mes || !dia) return dataBr;
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function descricaoGuiaAgenda(guia: {
  procedimentoNome: string;
  etapasResumo?: string;
  dataEmissao?: string;
  elementoArcada?: string;
}) {
  const partes = [
    guia.etapasResumo || guia.procedimentoNome || "Guia",
    guia.dataEmissao ? `Emissão ${guia.dataEmissao}` : "",
    guia.elementoArcada ? `Elementos ${guia.elementoArcada}` : ""
  ].filter((item) => String(item || "").trim());
  return partes.join(" · ");
}

function formatarAgoraBr() {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const ano = agora.getFullYear();
  const horas = String(agora.getHours()).padStart(2, "0");
  const minutos = String(agora.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
}

function formatarCabecalhoData(dataIso: string) {
  const data = new Date(`${dataIso}T12:00:00`);
  const diaSemana = NOMES_DIAS_LONGOS[data.getDay()];
  const dia = data.getDate();
  const mes = NOMES_MESES[data.getMonth()];
  const ano = data.getFullYear();
  return `${diaSemana}, ${dia} de ${mes} ${ano}`;
}

function formatarMesAno(dataIso: string) {
  const data = new Date(`${dataIso}T12:00:00`);
  return { mes: NOMES_MESES[data.getMonth()].toUpperCase(), ano: String(data.getFullYear()) };
}

function inicioDaSemana(dataIso: string) {
  const data = new Date(`${dataIso}T12:00:00`);
  const deslocamento = data.getDay();
  data.setDate(data.getDate() - deslocamento);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function adicionarDias(dataIso: string, dias: number) {
  const data = new Date(`${dataIso}T12:00:00`);
  data.setDate(data.getDate() + dias);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function gerarDiasDaSemana(dataIso: string) {
  const inicio = inicioDaSemana(dataIso);
  return Array.from({ length: 7 }, (_, indice) => adicionarDias(inicio, indice));
}

function montarDiasDoMes(dataIso: string) {
  const data = new Date(`${dataIso}T12:00:00`);
  const primeiro = new Date(data.getFullYear(), data.getMonth(), 1);
  const ultimo = new Date(data.getFullYear(), data.getMonth() + 1, 0);
  const inicio = new Date(primeiro);
  inicio.setDate(primeiro.getDate() - primeiro.getDay());
  const fim = new Date(ultimo);
  fim.setDate(ultimo.getDate() + (6 - ultimo.getDay()));

  const dias: string[] = [];
  const cursor = new Date(inicio);
  while (cursor <= fim) {
    dias.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

function construirEventosIniciais(): AgendaEventoUI[] {
  return [];
}

function hexParaRgba(hex: string, alpha: number) {
  const limpo = hex.replace("#", "");
  const expandido = limpo.length === 3 ? limpo.split("").map((parte) => `${parte}${parte}`).join("") : limpo;
  const numero = Number.parseInt(expandido, 16);
  const r = (numero >> 16) & 255;
  const g = (numero >> 8) & 255;
  const b = numero & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function suavizarCor(hex: string) {
  return hexParaRgba(hex, 0.18);
}

function construirProfissionaisBase(usuarios: UsuarioResumoApi[]) {
  return usuarios
    .filter((usuario) => usuario.status === "Ativo" && usuario.modulos?.Agenda !== "Sem acesso" && usuario.agendaDisponivel !== false)
    .map((usuario, indice) => ({
      id: usuario.id,
      nome: usuario.nomeAgenda || usuario.nome || usuario.usuario,
      usuarioVinculado: usuario.usuario || usuario.nome,
      cor: CORES_AGENDA[indice % CORES_AGENDA.length],
      corSuave: suavizarCor(CORES_AGENDA[indice % CORES_AGENDA.length])
    }));
}

function construirProfissionalImportado(nome: string, indice: number) {
  const nomeLimpo = nome.trim() || "Profissional";
  return {
    id: idProfissionalImportado(nomeLimpo),
    nome: nomeLimpo,
    usuarioVinculado: nomeLimpo,
    cor: CORES_AGENDA[indice % CORES_AGENDA.length],
    corSuave: suavizarCor(CORES_AGENDA[indice % CORES_AGENDA.length])
  };
}

function normalizarTextoAgenda(valor: string) {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizarEscopoAgenda(valor?: string) {
  return normalizarTextoAgenda(String(valor || ""))
    .replace("á", "a");
}

function idProfissionalImportado(nome: string) {
  const texto = normalizarTextoAgenda(nome);
  let hash = 0;
  for (let indice = 0; indice < texto.length; indice += 1) {
    hash = (hash * 31 + texto.charCodeAt(indice)) >>> 0;
  }
  return 100000 + (hash % 900000);
}

function construirProfissionaisImportados(
  eventos: AgendaApiAgendamento[],
  profissionaisBase: Array<{ id: number; nome: string; usuarioVinculado: string; cor: string; corSuave: string }>
) {
  const nomesExistentes = new Set(
    profissionaisBase.flatMap((item) => [normalizarTextoAgenda(item.nome), normalizarTextoAgenda(item.usuarioVinculado)])
  );
  const nomesImportados = Array.from(
    new Set(
      eventos
        .map((evento) => String(evento.profissional || "").trim())
        .filter(Boolean)
        .filter((nome) => !nomesExistentes.has(normalizarTextoAgenda(nome)))
    )
  );

  return nomesImportados.map((nome, indice) => {
    const cor = CORES_AGENDA[(profissionaisBase.length + indice) % CORES_AGENDA.length];
    return {
      id: idProfissionalImportado(nome),
      nome,
      usuarioVinculado: nome,
      cor,
      corSuave: suavizarCor(cor)
    };
  });
}

function criarConfiguracaoDiasPadrao() {
  return Object.fromEntries(
    Array.from({ length: 7 }, (_, indice) => [
      indice,
      {
        ativo: indice >= 1 && indice <= 5,
        inicio: "08:00",
        fim: indice === 4 ? "18:00" : "19:00",
        almocoInicio: "12:00",
        almocoFim: "13:00",
        consultorio: ""
      }
    ])
  ) as Record<number, { ativo: boolean; inicio: string; fim: string; almocoInicio: string; almocoFim: string; consultorio?: string }>;
}

function criarConfigProfissionaisPadrao(profissionaisBase: Array<{ id: number; nome: string; usuarioVinculado: string; cor: string; corSuave: string }>) {
  return profissionaisBase.map((item) => ({
    id: item.id,
    nomeAgenda: item.nome,
    usuarioVinculado: item.usuarioVinculado,
    mostrar: true,
    cor: item.cor,
    corSuave: item.corSuave,
    maxAgendamentosPorHorario: 1,
    configuracaoDias: criarConfiguracaoDiasPadrao()
  }));
}

function carregarConfiguracaoAgenda(
  profissionaisBase: Array<{ id: number; nome: string; usuarioVinculado: string; cor: string; corSuave: string }>,
  salvo?: Partial<AgendaConfiguracaoApi> | null
): AgendaConfiguracaoPersistida {
  const configClinicaDiasPadrao = criarConfiguracaoDiasPadrao();
  const configProfissionaisPadrao = criarConfigProfissionaisPadrao(profissionaisBase);
  const ordemPadrao = profissionaisBase.map((item) => item.id);
  const ordemSalva = Array.isArray(salvo?.ordemProfissionais) ? salvo?.ordemProfissionais : [];
  const ordemProfissionais = [
    ...ordemSalva.filter((id) => ordemPadrao.includes(id)),
    ...ordemPadrao.filter((id) => !ordemSalva.includes(id))
  ];
  const configClinicaDias = { ...configClinicaDiasPadrao, ...(salvo?.configClinicaDias || {}) };
  const mapaSalvo = new Map((salvo?.configProfissionais || []).map((item) => [item.id, item]));
  const configProfissionais = configProfissionaisPadrao.map((item) => {
    const atual = mapaSalvo.get(item.id);
    if (!atual) return item;
    return {
      ...item,
      ...atual,
      nomeAgenda: String(atual.nomeAgenda || item.nomeAgenda),
      usuarioVinculado: String(atual.usuarioVinculado || item.usuarioVinculado),
      corSuave: atual.cor ? suavizarCor(atual.cor) : item.corSuave,
      configuracaoDias: {
        ...item.configuracaoDias,
        ...(atual.configuracaoDias || {})
      }
    };
  });
  return {
    salas: normalizarListaSalas(salvo?.salas),
    ordemProfissionais,
    configClinicaDias,
    configProfissionais
  };
}

function nomeTipoAtendimento(tipoId: number) {
  return tiposAtendimentoAgenda.find((item) => item.id === tipoId)?.nome ?? "Consulta";
}

function corStatusAgendamento(status: AgendaEventoUI["status"]) {
  switch (status) {
    case "Agendado":
      return "#94a3b8";
    case "Confirmado":
      return "#0f9d8f";
    case "Em espera":
      return "#f4c430";
    case "Em atendimento":
      return "#2f80ed";
    case "Atendido":
      return "#66bb6a";
    case "Atrasado":
      return "#d64545";
    case "Faltou":
      return "#4b5563";
    case "Desmarcado":
      return "#9b8f7a";
    case "Cancelado":
      return "#8b5cf6";
    default:
      return "#94a3b8";
  }
}

function classeStatusAgendamento(status: AgendaEventoUI["status"]) {
  return status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function classeFinanceiroAgenda(valor?: string) {
  const texto = (valor ?? "").toLowerCase();
  if (texto.includes("ok")) return "ok";
  if (texto.includes("pendente") || texto.includes("devendo") || texto.includes("atras")) return "devedor";
  return "neutro";
}

function corTipo(tipoId: number) {
  const nome = (tiposAtendimentoAgenda.find((item) => item.id === tipoId)?.nome ?? "").toLowerCase();
  if (nome.includes("comprom")) return "#c8ccd3";
  if (nome.includes("cirurg")) return "#d8c0f4";
  if (nome.includes("consulta")) return "#c9e9d5";
  return tiposAtendimentoAgenda.find((item) => item.id === tipoId)?.cor ?? "#c9e9d5";
}

function resumoEventoAgenda(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.slice(0, 3).toUpperCase())
    .join(" ");
}

function calcularColunasSobrepostas(eventosDia: AgendaEventoUI[]) {
  const ordenados = [...eventosDia].sort((a, b) => {
    const inicio = paraMinutos(a.inicio) - paraMinutos(b.inicio);
    if (inicio !== 0) return inicio;
    return paraMinutos(a.fim) - paraMinutos(b.fim);
  });

  const ativos: { id: number; fim: number; coluna: number }[] = [];
  const mapa = new Map<number, { coluna: number; totalColunas: number }>();

  for (const evento of ordenados) {
    const inicioEvento = paraMinutos(evento.inicio);
    const fimEvento = paraMinutos(evento.fim);

    for (let indice = ativos.length - 1; indice >= 0; indice -= 1) {
      if (ativos[indice].fim <= inicioEvento) {
        ativos.splice(indice, 1);
      }
    }

    let coluna = 0;
    while (ativos.some((ativo) => ativo.coluna === coluna)) {
      coluna += 1;
    }

    ativos.push({ id: evento.id, fim: fimEvento, coluna });
    const totalColunas = Math.max(...ativos.map((ativo) => ativo.coluna)) + 1;

    ativos.forEach((ativo) => {
      mapa.set(ativo.id, {
        coluna: ativo.coluna,
        totalColunas: Math.max(totalColunas, mapa.get(ativo.id)?.totalColunas ?? 1)
      });
    });
  }

  return mapa;
}

function criarFormulario(slot: SlotRascunho, usuarioAtual: string): ModalFormState {
  return {
    data: slot.data,
    profissionalId: slot.profissionalId,
    tipoAtendimentoId: tiposAtendimentoAgenda[0]?.id ?? 1,
    status: "Agendado",
    pacienteId: null,
    pacienteBusca: "",
    nomePaciente: "",
    prontuario: "",
    celular: "",
    observacoes: "",
    agendadoPor: usuarioAtual,
    agendadoEm: formatarAgoraBr(),
    horarioInicio: slot.hora,
    horarioFim: adicionarMinutos(slot.hora, 15),
    duracaoMinutos: 15,
    trabalhoTipo: "",
    ordemServicoId: null,
    ordemServicoDocumentoNome: "",
    elementoArcada: ""
  };
}

function criarGradeSelecao(slotsDisponiveis: string[], ocupados: Set<string>, ancora: string, alvo: string) {
  const inicio = Math.min(paraMinutos(ancora), paraMinutos(alvo));
  const fim = Math.max(paraMinutos(ancora), paraMinutos(alvo));
  const faixa = slotsDisponiveis.filter((slot) => {
    const minuto = paraMinutos(slot);
    return minuto >= inicio && minuto <= fim;
  });
  if (faixa.some((slot) => ocupados.has(slot) && slot !== ancora)) return [ancora];
  return faixa;
}

function fimSelecao(slots: string[]) {
  if (!slots.length) return "";
  return adicionarMinutos(slots[slots.length - 1], 15);
}

function duracaoSelecao(slots: string[]) {
  return slots.length * 15;
}

function ajustarSelecaoParaDuracao(inicio: string, minutosDesejados: number, ocupados: string[]) {
  const blocosNecessarios = Math.max(1, Math.ceil(minutosDesejados / 15));
  const ocupadosSet = new Set(ocupados);
  const selecionados: string[] = [];

  for (let indice = 0; indice < blocosNecessarios; indice += 1) {
    const slot = adicionarMinutos(inicio, indice * 15);
    if (ocupadosSet.has(slot) && slot !== inicio) break;
    selecionados.push(slot);
  }

  return selecionados.length ? selecionados : [inicio];
}

function ProcedimentoBadge({
  item,
  onRemove
}: {
  item: ProcedimentoSelecionado;
  onRemove: (chave: string) => void;
}) {
  return (
    <div className="agenda-procedimento-chip">
      <div className="agenda-procedimento-chip-copy">
        <strong>{item.nome}</strong>
        <span>{item.origem === "contrato" ? "Contrato" : "Manual"} · {item.duracaoMinutos} min</span>
      </div>
      <button type="button" onClick={() => onRemove(item.chave)} aria-label={`Remover ${item.nome}`}>
        <X size={14} />
      </button>
    </div>
  );
}

export function AgendaPage({ usuarioLogado, onAbrirPaciente, onAbrirNovoPaciente }: AgendaPageProps) {
  const usuarioAtual = (usuarioLogado?.nome || "Usuário").trim() || "Usuário";
  const [usuariosAgenda, setUsuariosAgenda] = useState<UsuarioResumoApi[]>([]);
  const [profissionaisImportados, setProfissionaisImportados] = useState<Array<{ id: number; nome: string; usuarioVinculado: string; cor: string; corSuave: string }>>([]);
  const profissionaisUsuariosBase = useMemo(() => construirProfissionaisBase(usuariosAgenda), [usuariosAgenda]);
  const profissionaisBase = useMemo(() => {
    const mapa = new Map<number, { id: number; nome: string; usuarioVinculado: string; cor: string; corSuave: string }>();
    profissionaisUsuariosBase.forEach((item) => mapa.set(item.id, item));
    profissionaisImportados.forEach((item) => {
      if (!mapa.has(item.id)) mapa.set(item.id, item);
    });
    return Array.from(mapa.values());
  }, [profissionaisImportados, profissionaisUsuariosBase]);
  const usuariosAgendaDisponiveis = useMemo(() => profissionaisBase.map((item) => item.nome), [profissionaisBase]);
  const dataInicialHoje = hojeIso();
  const [visao, setVisao] = useState<AgendaView>("Dia");
  const [dataSelecionada, setDataSelecionada] = useState(dataInicialHoje);
  const [profissionaisSelecionados, setProfissionaisSelecionados] = useState<number[]>([]);
  const [ordemProfissionais, setOrdemProfissionais] = useState<number[]>([]);
  const [eventos, setEventos] = useState<AgendaEventoUI[]>(() => construirEventosIniciais());
  const [eventoAtivoId, setEventoAtivoId] = useState<number | null>(null);
  const [detalhePosicao, setDetalhePosicao] = useState<DetalhePopoverPosicao | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [agendamentoEditandoId, setAgendamentoEditandoId] = useState<number | null>(null);
  const [abaModal, setAbaModal] = useState<AgendaTab>("Nova Consulta");
  const [rascunhoSlot, setRascunhoSlot] = useState<SlotRascunho>({
    data: dataInicialHoje,
    hora: "10:00",
    profissionalId: profissionaisBase[0]?.id ?? 1
  });
  const [form, setForm] = useState<ModalFormState>(() =>
    criarFormulario({ data: dataInicialHoje, hora: "10:00", profissionalId: profissionaisBase[0]?.id ?? 1 }, usuarioAtual)
  );
  const [sugestoesPaciente, setSugestoesPaciente] = useState<AgendaPacienteBuscaItem[]>([]);
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [contextoPaciente, setContextoPaciente] = useState<AgendaProcedimentoContrato[]>([]);
  const [guiasEmitidasPaciente, setGuiasEmitidasPaciente] = useState<Array<{ id: number; procedimentoNome: string; retornoSolicitado?: string; documentoNome: string; elementoArcada?: string; dataEmissao?: string; etapasResumo?: string }>>([]);
  const [procedimentosSelecionados, setProcedimentosSelecionados] = useState<ProcedimentoSelecionado[]>([]);
  const [procedimentoContratoSelecionado, setProcedimentoContratoSelecionado] = useState("");
  const [procedimentoManual, setProcedimentoManual] = useState("");
  const [duracaoManual, setDuracaoManual] = useState(45);
  const [erroAgendaModal, setErroAgendaModal] = useState<string | null>(null);
  const [modoNovoPacienteRapido, setModoNovoPacienteRapido] = useState(false);
  const [eventoTodaEquipe, setEventoTodaEquipe] = useState(false);
  const [slotsOcupados, setSlotsOcupados] = useState<string[]>([]);
  const [slotsSelecionados, setSlotsSelecionados] = useState<string[]>(["10:00"]);
  const [modoSelecaoSlots, setModoSelecaoSlots] = useState<"preselecionado" | "ancora" | "intervalo">("preselecionado");
  const [carregandoDisponibilidade, setCarregandoDisponibilidade] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modalConfiguracaoAberto, setModalConfiguracaoAberto] = useState(false);
  const [diaConfiguracaoSelecionado, setDiaConfiguracaoSelecionado] = useState<number>(1);
  const [desmarqueConsulta, setDesmarqueConsulta] = useState<DesmarqueConsultaForm>({
    aberto: false,
    motivo: "",
    responsavel: "Paciente"
  });
  const [confirmarCancelamentoAberto, setConfirmarCancelamentoAberto] = useState(false);
  const [configClinicaDias, setConfigClinicaDias] = useState<Record<number, { ativo: boolean; inicio: string; fim: string; almocoInicio: string; almocoFim: string }>>(
    () => criarConfiguracaoDiasPadrao()
  );
  const [configProfissionais, setConfigProfissionais] = useState<ConfigProfissionalAgenda[]>([]);
  const [salasAgenda, setSalasAgenda] = useState<string[]>([...SALAS_PADRAO_AGENDA]);
  const [profissionalArrastandoId, setProfissionalArrastandoId] = useState<number | null>(null);
  const cliqueDetalheTimer = useRef<number | null>(null);
  const configuracaoAgendaCarregada = useRef(false);
  const usuarioEhAdministrador =
    normalizarTextoAgenda(String(usuarioLogado?.perfil || "")) === "administrador"
    || normalizarTextoAgenda(String(usuarioLogado?.cargo || "")) === "administrador";
  const agendaSomentePropria = normalizarEscopoAgenda(usuarioLogado?.agendaEscopo) === "somente a propria"
    || normalizarEscopoAgenda(usuarioLogado?.agendaEscopo) === "somente propria"
    || normalizarEscopoAgenda(usuarioLogado?.agendaEscopo) === "somente_propria";

  const configProfissionaisMap = useMemo(() => new Map(configProfissionais.map((item) => [item.id, item])), [configProfissionais]);
  const profissionaisOrdenados = useMemo(
    () =>
      ordemProfissionais
        .map((id) => {
          const base = profissionaisBase.find((item) => item.id === id);
          const config = configProfissionaisMap.get(id);
          if (!base || !config) return null;
          return {
            id,
            nome: base.nome,
            usuarioVinculado: config.usuarioVinculado,
            mostrar: config.mostrar,
            cor: config.cor,
            corSuave: config.corSuave,
            nomeAgenda: config.nomeAgenda
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [configProfissionaisMap, ordemProfissionais, profissionaisBase]
  );
  const profissionaisDisponiveis = useMemo(
    () => {
      const base = profissionaisOrdenados.filter((item) => item.mostrar);
      if (usuarioEhAdministrador || !agendaSomentePropria) return base;
      const usuarioAtual = normalizarTextoAgenda(String(usuarioLogado?.usuario || ""));
      const nomeAtual = normalizarTextoAgenda(String(usuarioLogado?.nome || ""));
      const nomeAgendaAtual = normalizarTextoAgenda(String(usuarioLogado?.nomeAgenda || ""));
      return base.filter((item) => {
        const vinculo = normalizarTextoAgenda(item.usuarioVinculado || "");
        const nomeColuna = normalizarTextoAgenda(item.nomeAgenda || item.nome || "");
        return vinculo === usuarioAtual
          || vinculo === nomeAtual
          || nomeColuna === nomeAgendaAtual
          || nomeColuna === nomeAtual;
      });
    },
    [agendaSomentePropria, profissionaisOrdenados, usuarioEhAdministrador, usuarioLogado?.nome, usuarioLogado?.nomeAgenda, usuarioLogado?.usuario]
  );
  const profissionaisVisiveis = useMemo(
    () => profissionaisDisponiveis.filter((item) => profissionaisSelecionados.includes(item.id)),
    [profissionaisDisponiveis, profissionaisSelecionados]
  );
  const diaSemanaSelecionado = useMemo(() => new Date(`${dataSelecionada}T12:00:00`).getDay(), [dataSelecionada]);
  const clinicaDiaAtual = configClinicaDias[diaSemanaSelecionado] ?? configClinicaDias[1];
  const horariosAgenda = useMemo(
    () => gerarSlotsQuinzeMinutos(clinicaDiaAtual.inicio, adicionarMinutos(clinicaDiaAtual.fim, 15)),
    [clinicaDiaAtual.fim, clinicaDiaAtual.inicio]
  );
  const minutoInicialAgenda = useMemo(() => paraMinutos(clinicaDiaAtual.inicio), [clinicaDiaAtual.inicio]);
  const mesesInfo = useMemo(() => formatarMesAno(dataSelecionada), [dataSelecionada]);
  const guiasDisponiveisPaciente = useMemo(() => guiasEmitidasPaciente, [guiasEmitidasPaciente]);
  const mensagemTrabalhoProt = useMemo(() => {
    if (!form.pacienteId && !form.pacienteBusca.trim() && !form.nomePaciente.trim()) return "Selecione um paciente para consultar as guias emitidas.";
    if (!guiasEmitidasPaciente.length) return "Este paciente ainda não tem guia emitida.";
    return "Selecione qualquer guia do paciente. O local do trabalho pode ser informado agora ou deixado em branco para consultar depois.";
  }, [form.nomePaciente, form.pacienteBusca, form.pacienteId, guiasEmitidasPaciente]);

  useEffect(() => {
    if (abaModal !== "Nova Consulta") return;
    if (!guiasDisponiveisPaciente.length) {
      setForm((atual) => (
        atual.ordemServicoId || atual.ordemServicoDocumentoNome || atual.trabalhoTipo || atual.elementoArcada
          ? {
              ...atual,
              ordemServicoId: null,
              ordemServicoDocumentoNome: "",
              trabalhoTipo: "",
              elementoArcada: ""
            }
          : atual
      ));
      return;
    }
  }, [abaModal, guiasDisponiveisPaciente]);

  useEffect(() => {
    if (abaModal !== "Nova Consulta") return;
    if (!form.pacienteId || modoNovoPacienteRapido) return;
    let cancelado = false;
    void (async () => {
      try {
        const contexto = await buscarContextoPacienteAgenda(form.pacienteId!);
        if (cancelado) return;
        setContextoPaciente(contexto.procedimentosContratados);
        setGuiasEmitidasPaciente(contexto.guiasEmitidas);
        setForm((atual) => ({
          ...atual,
          nomePaciente: atual.nomePaciente || contexto.nome,
          pacienteBusca: atual.pacienteBusca || contexto.nome,
          prontuario: contexto.prontuario,
          celular: contexto.celular
        }));
      } catch {
        if (cancelado) return;
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [abaModal, form.pacienteId, modoNovoPacienteRapido]);
  const dataTitulo = useMemo(() => formatarCabecalhoData(dataSelecionada), [dataSelecionada]);
  const diasSemana = useMemo(() => gerarDiasDaSemana(dataSelecionada), [dataSelecionada]);
  const diasMes = useMemo(() => montarDiasDoMes(dataSelecionada), [dataSelecionada]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const [usuarios, configuracao] = await Promise.all([
          listarUsuariosApi(),
          buscarConfiguracaoAgendaApi().catch(() => null)
        ]);
        if (cancelado) return;
        const usuariosAtivos = usuarios.filter(
          (usuario) => usuario.status === "Ativo" && usuario.modulos?.Agenda !== "Sem acesso"
        );
        const usuariosFiltrados = usuariosAtivos.some((usuario) => usuario.agendaDisponivel !== false)
          ? usuariosAtivos.filter((usuario) => usuario.agendaDisponivel !== false)
          : usuariosAtivos.filter((usuario) => usuario.cargo === "Profissional" || usuario.cargo === "Administrador");
        setUsuariosAgenda(usuariosFiltrados);
        const base = construirProfissionaisBase(usuariosFiltrados);
        const carregada = carregarConfiguracaoAgenda(base, configuracao);
        setConfigClinicaDias(carregada.configClinicaDias);
        setConfigProfissionais(carregada.configProfissionais);
        setSalasAgenda(carregada.salas);
        setOrdemProfissionais(carregada.ordemProfissionais);
        setProfissionaisSelecionados(base.map((item) => item.id));
      } catch {
        if (cancelado) return;
        setUsuariosAgenda([]);
        setConfigClinicaDias(criarConfiguracaoDiasPadrao());
        setConfigProfissionais([]);
        setSalasAgenda([...SALAS_PADRAO_AGENDA]);
        setOrdemProfissionais([]);
        setProfissionaisSelecionados([]);
      } finally {
        configuracaoAgendaCarregada.current = true;
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!usuarioEhAdministrador && modalConfiguracaoAberto) {
      setModalConfiguracaoAberto(false);
    }
  }, [modalConfiguracaoAberto, usuarioEhAdministrador]);

  useEffect(() => {
    setProfissionaisSelecionados((atual) => {
      const idsVisiveis = profissionaisDisponiveis.map((item) => item.id);
      const filtrados = atual.filter((id) => idsVisiveis.includes(id));
      return filtrados.length ? filtrados : idsVisiveis;
    });
  }, [profissionaisDisponiveis]);
  useEffect(() => {
    const idsBase = profissionaisBase.map((item) => item.id);
    setOrdemProfissionais((atual) => {
      const filtrados = atual.filter((id) => idsBase.includes(id));
      const faltantes = idsBase.filter((id) => !filtrados.includes(id));
      return [...filtrados, ...faltantes];
    });
    setConfigProfissionais((atual) => {
      const mapaAtual = new Map(atual.map((item) => [item.id, item]));
      return profissionaisBase.map((item) => {
        const existente = mapaAtual.get(item.id);
        if (!existente) {
          return {
            id: item.id,
            nomeAgenda: item.nome,
            usuarioVinculado: item.usuarioVinculado,
            mostrar: true,
            cor: item.cor,
            corSuave: item.corSuave,
            maxAgendamentosPorHorario: 1,
            configuracaoDias: criarConfiguracaoDiasPadrao()
          };
        }
        return {
          ...existente,
          nomeAgenda: existente.nomeAgenda || item.nome,
          usuarioVinculado: existente.usuarioVinculado || item.usuarioVinculado,
          cor: existente.cor || item.cor,
          corSuave: existente.cor ? suavizarCor(existente.cor) : item.corSuave
        };
      });
    });
  }, [profissionaisBase]);
  useEffect(() => {
    if (!configuracaoAgendaCarregada.current || !profissionaisBase.length) return;
    const timer = window.setTimeout(() => {
      void salvarConfiguracaoAgendaApi({
        salas: salasAgenda,
        ordemProfissionais,
        configClinicaDias,
        configProfissionais
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [configClinicaDias, configProfissionais, ordemProfissionais, salasAgenda]);
  const eventosVisiveis = useMemo(
    () => eventos.filter((evento) => !statusOcultoNaAgenda(evento.status)),
    [eventos]
  );
  const eventosDia = useMemo(
    () => eventosVisiveis.filter((evento) => evento.data === isoParaBr(dataSelecionada)),
    [eventosVisiveis, dataSelecionada]
  );
  const detalheAtivo = useMemo(
    () => eventos.find((item) => item.id === eventoAtivoId) ?? null,
    [eventos, eventoAtivoId]
  );
  const eventosDaSemana = useMemo(
    () => eventosVisiveis.filter((evento) => diasSemana.map(isoParaBr).includes(evento.data)),
    [eventosVisiveis, diasSemana]
  );
  function nomeProfissionalPorId(profissionalId: number) {
    return profissionaisBase.find((item) => item.id === profissionalId)?.nome ?? "Profissional";
  }

  function nomeAgendaProfissional(profissionalId: number) {
    return configProfissionais.find((item) => item.id === profissionalId)?.nomeAgenda || nomeProfissionalPorId(profissionalId);
  }

  function corProfissionalPorId(profissionalId: number) {
    return configProfissionais.find((item) => item.id === profissionalId)?.cor ?? "#c7aa78";
  }

  function corSuaveProfissionalPorId(profissionalId: number) {
    return configProfissionais.find((item) => item.id === profissionalId)?.corSuave ?? "#f7f0e4";
  }

  function configuracaoProfissionalNoDia(profissionalId: number, dataIso: string) {
    const diaSemana = new Date(`${dataIso}T12:00:00`).getDay();
    return configProfissionais.find((item) => item.id === profissionalId)?.configuracaoDias[diaSemana] ?? null;
  }

  function profissionalAtivoNoDia(profissionalId: number, dataIso: string) {
    const diaSemana = new Date(`${dataIso}T12:00:00`).getDay();
    const configClinica = configClinicaDias[diaSemana];
    const configProfissional = configuracaoProfissionalNoDia(profissionalId, dataIso);
    return Boolean(configClinica?.ativo && configProfissional?.ativo);
  }

  function slotDisponivelNaAgenda(profissionalId: number, dataIso: string, slot: string) {
    const diaSemana = new Date(`${dataIso}T12:00:00`).getDay();
    const configClinica = configClinicaDias[diaSemana];
    const configProfissional = configuracaoProfissionalNoDia(profissionalId, dataIso);
    if (!configClinica?.ativo || !configProfissional?.ativo) return false;
    const minuto = paraMinutos(slot);
    const inicio = Math.max(paraMinutos(configClinica.inicio), paraMinutos(configProfissional.inicio));
    const fim = Math.min(paraMinutos(configClinica.fim), paraMinutos(configProfissional.fim));
    if (minuto < inicio || minuto >= fim) return false;
    const almocoInicioClinica = paraMinutos(configClinica.almocoInicio);
    const almocoFimClinica = paraMinutos(configClinica.almocoFim);
    const almocoInicioProfissional = paraMinutos(configProfissional.almocoInicio);
    const almocoFimProfissional = paraMinutos(configProfissional.almocoFim);
    const almocoInicio = Math.min(almocoInicioClinica, almocoInicioProfissional);
    const almocoFim = Math.max(almocoFimClinica, almocoFimProfissional);
    if (almocoFim > almocoInicio && minuto >= almocoInicio && minuto < almocoFim) return false;
    return true;
  }

  function primeiroSlotDisponivel(profissionalId: number, dataIso: string) {
    return HORARIOS.find((slot) => slotDisponivelNaAgenda(profissionalId, dataIso, slot)) ?? null;
  }

  function moverProfissionalOrdem(profissionalId: number, direcao: -1 | 1) {
    setOrdemProfissionais((atual) => {
      const indiceAtual = atual.indexOf(profissionalId);
      if (indiceAtual < 0) return atual;
      const novoIndice = indiceAtual + direcao;
      if (novoIndice < 0 || novoIndice >= atual.length) return atual;
      const copia = [...atual];
      const [item] = copia.splice(indiceAtual, 1);
      copia.splice(novoIndice, 0, item);
      return copia;
    });
  }

  function moverProfissionalParaPosicao(origemId: number, destinoId: number) {
    if (origemId === destinoId) return;
    setOrdemProfissionais((atual) => {
      const origem = atual.indexOf(origemId);
      const destino = atual.indexOf(destinoId);
      if (origem < 0 || destino < 0) return atual;
      const copia = [...atual];
      const [item] = copia.splice(origem, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  }
  const linhaHorarioAtual = useMemo(() => {
    if (dataSelecionada !== hojeIso()) return null;
    const agora = new Date();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    const minutoFinalAgenda = minutoInicialAgenda + horariosAgenda.length * 15;
    if (minutosAgora < minutoInicialAgenda || minutosAgora > minutoFinalAgenda) return null;
    return {
      top: ((minutosAgora - minutoInicialAgenda) / 15) * SLOT_HEIGHT,
      hora: `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`
    };
  }, [dataSelecionada, horariosAgenda.length, minutoInicialAgenda]);

  useEffect(() => {
    if (!modalAberto || abaModal !== "Nova Consulta") return;
    let cancelado = false;
    setCarregandoDisponibilidade(true);
    buscarDisponibilidadeAgenda(form.profissionalId, isoParaBr(form.data))
      .then((resultado) => {
        if (cancelado) return;
        const maximoPorHorario = configProfissionais.find((item) => item.id === form.profissionalId)?.maxAgendamentosPorHorario ?? 1;
        const locais = eventos
          .filter((evento) => evento.profissionalId === form.profissionalId && evento.data === isoParaBr(form.data))
          .flatMap((evento) =>
            horariosAgenda.filter((slot) => {
              const minuto = paraMinutos(slot);
              return minuto >= paraMinutos(evento.inicio) && minuto < paraMinutos(evento.fim);
            })
          );
        const contagemSlots = [...resultado.ocupados, ...locais].reduce<Record<string, number>>((acc, slot) => {
          acc[slot] = (acc[slot] ?? 0) + 1;
          return acc;
        }, {});
        const ocupadosUnicos = Object.entries(contagemSlots)
          .filter(([, total]) => total >= maximoPorHorario)
          .map(([slot]) => slot);
        setSlotsOcupados(ocupadosUnicos);
        setSlotsSelecionados((atual) => {
          const horariosPermitidos = horariosAgenda.filter((slot) => slotDisponivelNaAgenda(form.profissionalId, form.data, slot));
          const ancoraBase = atual[0] ?? form.horarioInicio;
          const ancora = horariosPermitidos.includes(ancoraBase) ? ancoraBase : horariosPermitidos[0] ?? ancoraBase;
          return criarGradeSelecao(horariosPermitidos, new Set(ocupadosUnicos), ancora, atual[atual.length - 1] ?? ancora);
        });
      })
      .finally(() => {
        if (!cancelado) setCarregandoDisponibilidade(false);
      });
    return () => {
      cancelado = true;
    };
  }, [abaModal, configProfissionais, eventos, form.data, form.horarioInicio, form.profissionalId, horariosAgenda, modalAberto]);

  useEffect(() => {
    if (!modalAberto || abaModal !== "Nova Consulta") return;
    if (!form.pacienteBusca.trim() || form.pacienteId) {
      setSugestoesPaciente([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setCarregandoSugestoes(true);
      listarPacientesApi(form.pacienteBusca)
        .then((resultado) =>
          setSugestoesPaciente(
            resultado.slice(0, 8).map((item) => ({
              id: item.id,
              nome: item.nome,
              prontuario: String(item.prontuario ?? ""),
              celular: item.telefone ?? ""
            }))
          )
        )
        .catch(() => setSugestoesPaciente([]))
        .finally(() => setCarregandoSugestoes(false));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [abaModal, form.pacienteBusca, form.pacienteId, modalAberto]);

  useEffect(() => {
    setForm((atual) => ({
      ...atual,
      horarioInicio: slotsSelecionados[0] ?? atual.horarioInicio,
      horarioFim: fimSelecao(slotsSelecionados),
      duracaoMinutos: duracaoSelecao(slotsSelecionados)
    }));
  }, [slotsSelecionados]);

  useEffect(() => {
    setEventoAtivoId(null);
    setDetalhePosicao(null);
  }, [dataSelecionada, visao]);

  useEffect(() => {
    return () => {
      if (cliqueDetalheTimer.current) {
        window.clearTimeout(cliqueDetalheTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (confirmarCancelamentoAberto) {
        setConfirmarCancelamentoAberto(false);
        return;
      }
      if (desmarqueConsulta.aberto) {
        setDesmarqueConsulta((atual) => ({ ...atual, aberto: false }));
        return;
      }
      if (modalConfiguracaoAberto) {
        setModalConfiguracaoAberto(false);
        return;
      }
      if (modalAberto) {
        setAgendamentoEditandoId(null);
        setModalAberto(false);
        return;
      }
      if (eventoAtivoId || detalhePosicao) {
        setEventoAtivoId(null);
        setDetalhePosicao(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmarCancelamentoAberto, desmarqueConsulta.aberto, detalhePosicao, eventoAtivoId, modalAberto, modalConfiguracaoAberto]);

  function selecionarDataAgenda(novaData: string) {
    setDataSelecionada(novaData);
    setEventoAtivoId(null);
    setDetalhePosicao(null);
  }

  function navegar(delta: number) {
    if (visao === "Semana") {
      selecionarDataAgenda(adicionarDias(dataSelecionada, delta * 7));
      return;
    }
    if (visao === "Mês") {
      const data = new Date(`${dataSelecionada}T12:00:00`);
      data.setMonth(data.getMonth() + delta);
      selecionarDataAgenda(`${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`);
      return;
    }
    selecionarDataAgenda(adicionarDias(dataSelecionada, delta));
  }

  function toggleProfissional(profissionalId: number) {
    setProfissionaisSelecionados((atual) =>
      atual.includes(profissionalId) ? atual.filter((id) => id !== profissionalId) : [...atual, profissionalId]
    );
  }

  function selecionarSomenteProfissional(profissionalId: number) {
    setProfissionaisSelecionados([profissionalId]);
  }

  function abrirNovoAgendamento(slot: SlotRascunho) {
    const horarioValido = slotDisponivelNaAgenda(slot.profissionalId, slot.data, slot.hora)
      ? slot.hora
      : primeiroSlotDisponivel(slot.profissionalId, slot.data);
    if (!horarioValido) return;
    const slotAjustado = { ...slot, hora: horarioValido };
    setRascunhoSlot(slot);
    setRascunhoSlot(slotAjustado);
    setForm(criarFormulario(slotAjustado, usuarioAtual));
    setAgendamentoEditandoId(null);
    setEventoTodaEquipe(false);
    setSlotsSelecionados([horarioValido]);
    setModoSelecaoSlots("preselecionado");
    setSugestoesPaciente([]);
    setContextoPaciente([]);
    setGuiasEmitidasPaciente([]);
    setProcedimentosSelecionados([]);
    setProcedimentoContratoSelecionado("");
    setProcedimentoManual("");
    setDuracaoManual(45);
    setErroAgendaModal(null);
    setModoNovoPacienteRapido(false);
    setAbaModal("Nova Consulta");
    setEventoAtivoId(null);
    setDetalhePosicao(null);
    setModalAberto(true);
  }

  function slotsDoIntervalo(inicio: string, fim: string) {
    return horariosAgenda.filter((slot) => {
      const minuto = paraMinutos(slot);
      return minuto >= paraMinutos(inicio) && minuto < paraMinutos(fim);
    });
  }

  async function abrirEdicaoAgendamento(evento: AgendaEventoUI) {
    let detalhe = evento;
    try {
      const detalheApi = await buscarDetalhesAgendamentoAgenda(evento.id);
      detalhe = {
        ...evento,
        ...detalheApi,
        procedimentos: detalheApi.procedimentos.length ? detalheApi.procedimentos : evento.procedimentos
      };
      setEventos((atual) =>
        atual.map((item) =>
          item.id === evento.id
            ? {
                ...item,
                ...detalhe,
                procedimentos: detalhe.procedimentos
              }
            : item
        )
      );
    } catch {
      // mantém os dados locais quando a API não responder
    }

    const slot: SlotRascunho = {
      data: brParaIso(detalhe.data),
      hora: detalhe.inicio,
      profissionalId: detalhe.profissionalId
    };

    setRascunhoSlot(slot);
    setAgendamentoEditandoId(detalhe.id);
    setForm({
      data: brParaIso(detalhe.data),
      profissionalId: detalhe.profissionalId,
      tipoAtendimentoId: detalhe.tipoAtendimentoId,
      status: detalhe.status,
      pacienteId: detalhe.pacienteId ?? null,
      pacienteBusca: detalhe.paciente,
      nomePaciente: detalhe.paciente,
      prontuario: detalhe.prontuario ?? "",
      celular: detalhe.telefone ?? "",
      observacoes: detalhe.observacoes ?? "",
      agendadoPor: detalhe.agendadoPor ?? usuarioAtual,
      agendadoEm: detalhe.agendadoEm ?? formatarAgoraBr(),
      horarioInicio: detalhe.inicio,
      horarioFim: detalhe.fim,
      duracaoMinutos: Math.max(15, paraMinutos(detalhe.fim) - paraMinutos(detalhe.inicio)),
      trabalhoTipo: detalhe.trabalhoTipo ?? "",
      ordemServicoId: detalhe.ordemServicoId ?? null,
      ordemServicoDocumentoNome: detalhe.ordemServicoDocumentoNome ?? "",
      elementoArcada: detalhe.elementoArcada ?? ""
    });
    setSlotsSelecionados(slotsDoIntervalo(detalhe.inicio, detalhe.fim));
    setModoSelecaoSlots("intervalo");
    setSugestoesPaciente([]);
    setProcedimentoContratoSelecionado("");
    setProcedimentoManual("");
    setDuracaoManual(45);
    setErroAgendaModal(null);
    setModoNovoPacienteRapido(false);
    setAbaModal(
      !detalhe.pacienteId && (detalhe.tipoAtendimento === "Evento" || detalhe.tipoAtendimento === "Compromisso")
        ? (detalhe.tipoAtendimento as AgendaTab)
        : "Nova Consulta"
    );
    setEventoTodaEquipe(detalhe.profissionalId === 0 || detalhe.profissional === "Toda equipe");
    setEventoAtivoId(null);
    setDetalhePosicao(null);
    if (detalhe.pacienteId) {
      const contexto = await buscarContextoPacienteAgenda(detalhe.pacienteId);
      setContextoPaciente(contexto.procedimentosContratados);
      setGuiasEmitidasPaciente(contexto.guiasEmitidas);
      setProcedimentoContratoSelecionado("");
      setForm((atual) => ({
        ...atual,
        prontuario: contexto.prontuario,
        celular: contexto.celular,
        ordemServicoId: atual.ordemServicoId ?? detalhe.ordemServicoId ?? null,
        ordemServicoDocumentoNome: atual.ordemServicoDocumentoNome || detalhe.ordemServicoDocumentoNome || "",
        elementoArcada: atual.elementoArcada || detalhe.elementoArcada || ""
      }));
    } else {
      setContextoPaciente([]);
      setGuiasEmitidasPaciente([]);
      setProcedimentoContratoSelecionado("");
    }
    setProcedimentosSelecionados(
      detalhe.procedimentos.map((nome, indice) => ({
        chave: `edit-${detalhe.id}-${indice}-${nome.toLowerCase().replace(/\s+/g, "-")}`,
        nome,
        origem: detalhe.contratoId ? "contrato" : "manual",
        contratoId: detalhe.contratoId ?? null,
        duracaoMinutos: Math.max(
          15,
          Math.round((Math.max(15, paraMinutos(detalhe.fim) - paraMinutos(detalhe.inicio)) / Math.max(detalhe.procedimentos.length, 1)) / 15) * 15
        )
      }))
    );
    setModalAberto(true);
  }

  async function selecionarPaciente(item: AgendaPacienteBuscaItem) {
    setForm((atual) => ({
      ...atual,
      pacienteId: item.id,
      pacienteBusca: item.nome,
      nomePaciente: item.nome,
      prontuario: item.prontuario,
      celular: item.celular
    }));
    setSugestoesPaciente([]);
    setModoNovoPacienteRapido(false);
    const contexto = await buscarContextoPacienteAgenda(item.id);
    setContextoPaciente(contexto.procedimentosContratados);
    setGuiasEmitidasPaciente(contexto.guiasEmitidas);
    setProcedimentoContratoSelecionado("");
    setForm((atual) => ({
      ...atual,
      prontuario: contexto.prontuario,
      celular: contexto.celular,
      ordemServicoId: null,
      ordemServicoDocumentoNome: "",
      trabalhoTipo: "",
      elementoArcada: ""
    }));
  }

  function escolherNaoEncontrado() {
    setForm((atual) => ({
      ...atual,
      pacienteId: null,
      pacienteBusca: atual.pacienteBusca.trim(),
      nomePaciente: atual.pacienteBusca,
      trabalhoTipo: "",
      ordemServicoId: null,
      ordemServicoDocumentoNome: "",
      elementoArcada: ""
    }));
    setSugestoesPaciente([]);
    setContextoPaciente([]);
    setGuiasEmitidasPaciente([]);
    setProcedimentoContratoSelecionado("");
    setModoNovoPacienteRapido(true);
  }

  async function criarPacienteRapidoAgenda() {
    const nome = form.pacienteBusca.trim();
    const celular = form.celular.trim();
    if (!nome || !celular) return null;
    const pacientes = await listarPacientesApi("");
    const maiorProntuario = pacientes.reduce((maior, paciente) => {
      const numero = Number(String(paciente.prontuario ?? "").replace(/\D/g, ""));
      return Number.isFinite(numero) ? Math.max(maior, numero) : maior;
    }, 0);
    const payload: PacienteApiPayload = {
      nome,
      apelido: "",
      sexo: "",
      prontuario: String(maiorProntuario + 1),
      cpf: "",
      rg: "",
      data_nascimento: "",
      telefone: celular,
      email: "",
      cep: "",
      endereco: "",
      complemento: "",
      numero: "",
      bairro: "",
      cidade: "",
      estado: "",
      estado_civil: "",
      profissao: "",
      origem: "Agenda",
      observacoes: "Cadastro rápido criado pela agenda.",
      menor_idade: false,
      responsavel: "",
      cpf_responsavel: ""
    };
    return criarPacienteApi(payload);
  }

  function adicionarProcedimentoContrato(procedimento: AgendaProcedimentoContrato) {
    setErroAgendaModal(null);
    setProcedimentosSelecionados((atual) => {
      if (atual.some((item) => item.chave === procedimento.chave)) return atual;
      return [
        ...atual,
        {
          chave: procedimento.chave,
          nome: procedimento.nome,
          origem: "contrato",
          contratoId: procedimento.contratoId,
          duracaoMinutos: procedimento.duracaoMinutos
        }
      ];
    });
    setSlotsSelecionados((atual) =>
      ajustarSelecaoParaDuracao(atual[0] ?? form.horarioInicio, procedimento.duracaoMinutos, slotsOcupados)
    );
    setModoSelecaoSlots("intervalo");
  }

  function adicionarProcedimentoContratoSelecionado() {
    const procedimento = contextoPaciente.find((item) => item.chave === procedimentoContratoSelecionado);
    if (!procedimento) return;
    adicionarProcedimentoContrato(procedimento);
    setProcedimentoContratoSelecionado("");
  }

  function adicionarProcedimentoManual() {
    const nome = procedimentoManual.trim();
    if (!nome) return;
    setErroAgendaModal(null);
    setProcedimentosSelecionados((atual) => [
      ...atual,
      {
        chave: `manual-${Date.now()}-${nome.toLowerCase()}`,
        nome,
        origem: "manual",
        duracaoMinutos: duracaoManual
      }
    ]);
    setSlotsSelecionados((atual) =>
      ajustarSelecaoParaDuracao(atual[0] ?? form.horarioInicio, duracaoManual, slotsOcupados)
    );
    setModoSelecaoSlots("intervalo");
    setProcedimentoManual("");
  }

  function removerProcedimento(chave: string) {
    setProcedimentosSelecionados((atual) => atual.filter((item) => item.chave !== chave));
  }

  function atualizarConfigClinicaDia(
    diaSemana: number,
    campo: "inicio" | "fim" | "almocoInicio" | "almocoFim",
    valor: string
  ) {
    setConfigClinicaDias((atual) => ({
      ...atual,
      [diaSemana]: {
        ...atual[diaSemana],
        [campo]: valor
      }
    }));
    setConfigProfissionais((atual) =>
      atual.map((item) => ({
        ...item,
        configuracaoDias: {
          ...item.configuracaoDias,
          [diaSemana]: {
            ...item.configuracaoDias[diaSemana],
            [campo]: valor
          }
        }
      }))
    );
  }

  function alternarDiaProfissional(profissionalId: number, diaSemana: number) {
    setConfigProfissionais((atual) =>
      atual.map((item) =>
        item.id === profissionalId
          ? {
              ...item,
              configuracaoDias: {
                ...item.configuracaoDias,
                [diaSemana]: {
                  ...item.configuracaoDias[diaSemana],
                  ativo: !item.configuracaoDias[diaSemana].ativo
                }
              }
            }
          : item
      )
    );
  }

function atualizarConfigProfissionalDia(
    profissionalId: number,
    diaSemana: number,
    campo: "inicio" | "fim" | "almocoInicio" | "almocoFim" | "consultorio",
    valor: string
  ) {
    setConfigProfissionais((atual) =>
      atual.map((item) =>
        item.id === profissionalId
          ? {
              ...item,
              configuracaoDias: {
                ...item.configuracaoDias,
                [diaSemana]: {
                  ...item.configuracaoDias[diaSemana],
                  [campo]: valor
                }
              }
            }
          : item
      )
    );
  }

  function selecionarSlot(slot: string) {
    if (slotsOcupados.includes(slot) && !slotsSelecionados.includes(slot)) return;
    if (modoSelecaoSlots === "preselecionado" || modoSelecaoSlots === "intervalo") {
      setSlotsSelecionados([slot]);
      setModoSelecaoSlots("ancora");
      return;
    }
    const ancora = slotsSelecionados[0] ?? slot;
    setSlotsSelecionados(criarGradeSelecao(horariosAgenda, new Set(slotsOcupados), ancora, slot));
    setModoSelecaoSlots("intervalo");
  }

  async function salvarAgendamento() {
    const nomePrincipal = (form.pacienteId ? form.nomePaciente : form.nomePaciente || form.pacienteBusca).trim();
    const ehConsulta = abaModal === "Nova Consulta";
    if (!nomePrincipal || !slotsSelecionados.length || (ehConsulta && !form.celular.trim())) return;
    if (ehConsulta && !procedimentosSelecionados.length) {
      setErroAgendaModal("Selecione ao menos um procedimento antes de agendar.");
      return;
    }
    if (ehConsulta && (form.ordemServicoId || form.trabalhoTipo) && !form.elementoArcada.trim()) {
      setErroAgendaModal("Informe o dente ou arcada antes de salvar o agendamento.");
      return;
    }
    setErroAgendaModal(null);
    setSalvando(true);
    try {
      let pacienteIdAtual = form.pacienteId;
      let prontuarioAtual = form.prontuario;
      let celularAtual = form.celular;
      let nomePacienteAtual = nomePrincipal;

      if (ehConsulta && !pacienteIdAtual && modoNovoPacienteRapido) {
        const novoPaciente = await criarPacienteRapidoAgenda();
        if (novoPaciente) {
          pacienteIdAtual = novoPaciente.id;
          prontuarioAtual = novoPaciente.prontuario;
          celularAtual = novoPaciente.telefone ?? form.celular;
          nomePacienteAtual = novoPaciente.nome;
          setForm((atual) => ({
            ...atual,
            pacienteId: novoPaciente.id,
            pacienteBusca: novoPaciente.nome,
            nomePaciente: novoPaciente.nome,
            prontuario: novoPaciente.prontuario,
            celular: novoPaciente.telefone ?? atual.celular
          }));
        }
      }

      const profissionaisDestino =
        !ehConsulta && eventoTodaEquipe
          ? profissionaisDisponiveis.map((item) => item.id)
          : [form.profissionalId];

      const payloadBase = {
        data: isoParaBr(form.data),
        horaInicio: slotsSelecionados[0],
        horaFim: fimSelecao(slotsSelecionados),
        duracaoMinutos: duracaoSelecao(slotsSelecionados),
        status: form.status,
        agendadoPor: form.agendadoPor,
        agendadoEm: form.agendadoEm,
        observacoes: form.observacoes,
        trabalhoTipo: form.trabalhoTipo,
        ordemServicoId: form.ordemServicoId,
        ordemServicoDocumentoNome: form.ordemServicoDocumentoNome,
        elementoArcada: form.elementoArcada
      };

      const itensProcedimento = ehConsulta
        ? procedimentosSelecionados.map<AgendaProcedimentoPayload>((item) => ({
            nome: item.nome,
            origem: item.origem,
            contratoId: item.contratoId ?? null,
            duracaoMinutos: item.duracaoMinutos
          }))
        : [{ nome: nomePrincipal, origem: "manual" as const, duracaoMinutos: duracaoSelecao(slotsSelecionados) }];

      const persistidos = await Promise.all(
        profissionaisDestino.map(async (profissionalId, indice) => {
          const payload: AgendaSalvarPayload = {
            pacienteId: ehConsulta ? pacienteIdAtual : null,
            nomePaciente: nomePacienteAtual,
            prontuario: ehConsulta ? prontuarioAtual : "",
            telefone: ehConsulta ? celularAtual : "",
            profissionalId,
            profissionalNome: !ehConsulta && eventoTodaEquipe ? "Toda equipe" : nomeAgendaProfissional(profissionalId),
            tipoAtendimentoId: ehConsulta ? form.tipoAtendimentoId : 0,
            tipoAtendimentoNome: ehConsulta ? nomeTipoAtendimento(form.tipoAtendimentoId) : abaModal,
            ...payloadBase,
            procedimentos: itensProcedimento
          };
          if (agendamentoEditandoId && indice === 0) {
            return atualizarAgendamentoAgenda(agendamentoEditandoId, payload);
          }
          return salvarAgendamentoAgenda(payload);
        })
      );

      const eventosPersistidos: AgendaEventoUI[] = persistidos.map((salvo, indice) => {
        const profissionalId = profissionaisDestino[indice];
        return {
          ...salvo,
          id: agendamentoEditandoId && indice === 0 ? agendamentoEditandoId : salvo.id,
          pacienteId: ehConsulta ? (salvo.pacienteId ?? pacienteIdAtual ?? null) : null,
          paciente: nomePacienteAtual,
          prontuario: ehConsulta ? prontuarioAtual : "",
          telefone: ehConsulta ? celularAtual : "",
          profissionalId,
          profissional: !ehConsulta && eventoTodaEquipe ? "Toda equipe" : nomeAgendaProfissional(profissionalId),
          tipoAtendimentoId: ehConsulta ? form.tipoAtendimentoId : 0,
          tipoAtendimento: ehConsulta ? nomeTipoAtendimento(form.tipoAtendimentoId) : abaModal,
          data: isoParaBr(form.data),
          inicio: slotsSelecionados[0],
          fim: fimSelecao(slotsSelecionados),
          procedimentos: ehConsulta ? procedimentosSelecionados.map((item) => item.nome) : [nomePrincipal],
          observacoes: form.observacoes,
          agendadoEm: form.agendadoEm,
          agendadoPor: form.agendadoPor,
          status: form.status,
          contratoId: ehConsulta ? procedimentosSelecionados.find((item) => item.contratoId)?.contratoId ?? null : null,
          financeiro: ehConsulta && procedimentosSelecionados.some((item) => item.contratoId) ? "Financeiro Ok" : "Sem vínculo",
          trabalhoTipo: form.trabalhoTipo,
          ordemServicoId: form.ordemServicoId,
          ordemServicoDocumentoNome: form.ordemServicoDocumentoNome,
          elementoArcada: form.elementoArcada,
          marcadores: []
        };
      });

      setEventos((atual) => {
        const semEditado = agendamentoEditandoId ? atual.filter((item) => item.id !== agendamentoEditandoId) : atual;
        return [...semEditado, ...eventosPersistidos];
      });
      setAgendamentoEditandoId(null);
      setEventoAtivoId(null);
      setDetalhePosicao(null);
      setModalAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  function payloadProcedimentosDoEvento(evento: AgendaEventoUI): AgendaProcedimentoPayload[] {
    return (evento.procedimentos || [])
      .filter((nome) => nome.trim())
      .map((nome) => ({
        nome,
        origem: evento.contratoId ? "contrato" : "manual",
        contratoId: evento.contratoId ?? null,
        duracaoMinutos: Math.max(15, Math.round((paraMinutos(evento.fim) - paraMinutos(evento.inicio)) / Math.max(evento.procedimentos.length, 1)))
      }));
  }

  async function persistirAtualizacaoRapidaAgendamento(
    evento: AgendaEventoUI,
    overrides: Partial<AgendaSalvarPayload>,
    overridesLocais?: Partial<AgendaEventoUI>
  ) {
    const payload: AgendaSalvarPayload = {
      pacienteId: evento.pacienteId ?? null,
      nomePaciente: evento.paciente,
      prontuario: evento.prontuario,
      telefone: evento.telefone,
      profissionalId: evento.profissionalId,
      profissionalNome: evento.profissional,
      tipoAtendimentoId: evento.tipoAtendimentoId,
      tipoAtendimentoNome: evento.tipoAtendimento,
      data: evento.data,
      horaInicio: evento.inicio,
      horaFim: evento.fim,
      duracaoMinutos: Math.max(15, paraMinutos(evento.fim) - paraMinutos(evento.inicio)),
      status: evento.status,
      agendadoPor: evento.agendadoPor || usuarioAtual,
      agendadoEm: evento.agendadoEm || formatarAgoraBr(),
      observacoes: evento.observacoes || "",
      trabalhoTipo: evento.trabalhoTipo || "",
      ordemServicoId: evento.ordemServicoId ?? null,
      ordemServicoDocumentoNome: evento.ordemServicoDocumentoNome || "",
      elementoArcada: evento.elementoArcada || "",
      procedimentos: payloadProcedimentosDoEvento(evento),
      ...overrides
    };

    const atualizado = await atualizarAgendamentoAgenda(evento.id, payload);
    setEventos((atual) =>
      atual.map((item) =>
        item.id === evento.id
          ? {
              ...item,
              ...atualizado,
              ...overridesLocais,
              procedimentos: atualizado.procedimentos.length ? atualizado.procedimentos : item.procedimentos
            }
          : item
      )
    );
    return atualizado;
  }

  function calcularPosicaoDetalhe(elemento: HTMLElement): DetalhePopoverPosicao {
    const rect = elemento.getBoundingClientRect();
    const larguraPopover = 340;
    const alturaPopover = 430;
    const gap = 14;
    const cabeNoLadoDireito = rect.right + larguraPopover + gap < window.innerWidth - 12;
    const left = cabeNoLadoDireito ? rect.right + gap : Math.max(12, rect.left - larguraPopover - gap);
    const top = Math.max(12, Math.min(rect.top - 12, window.innerHeight - alturaPopover - 24));
    return { top, left, placement: cabeNoLadoDireito ? "right" : "left" };
  }

  async function abrirDetalhesAgendamento(evento: AgendaEventoUI, elemento: HTMLElement) {
    if (eventoAtivoId === evento.id) {
      setEventoAtivoId(null);
      setDetalhePosicao(null);
      return;
    }
    try {
      const detalhe = await buscarDetalhesAgendamentoAgenda(evento.id);
      setEventos((atual) =>
        atual.map((item) =>
          item.id === evento.id
            ? { ...item, ...detalhe, procedimentos: detalhe.procedimentos.length ? detalhe.procedimentos : item.procedimentos }
            : item
        )
      );
    } catch {
      // mantém o detalhe local
    }
    setEventoAtivoId(evento.id);
    setDetalhePosicao(calcularPosicaoDetalhe(elemento));
  }

  function agendarAberturaDetalhes(evento: AgendaEventoUI, elemento: HTMLElement) {
    if (cliqueDetalheTimer.current) {
      window.clearTimeout(cliqueDetalheTimer.current);
    }
    cliqueDetalheTimer.current = window.setTimeout(() => {
      void abrirDetalhesAgendamento(evento, elemento);
      cliqueDetalheTimer.current = null;
    }, 180);
  }

  async function atualizarStatusAgendamento(id: number, status: AgendaEventoUI["status"]) {
    const evento = eventos.find((item) => item.id === id);
    if (!evento) return;
    try {
      await persistirAtualizacaoRapidaAgendamento(evento, { status }, { status });
      if (statusOcultoNaAgenda(status)) {
        setEventoAtivoId(null);
        setDetalhePosicao(null);
      }
    } catch {
      // mantém estado anterior se a API falhar
    }
  }

  async function aplicarDesmarqueConsulta() {
    if (!detalheAtivo) return;
    const complemento = `Desmarcado por ${desmarqueConsulta.responsavel}${desmarqueConsulta.motivo.trim() ? ` · ${desmarqueConsulta.motivo.trim()}` : ""}`;
    const observacoesAtualizadas = detalheAtivo.observacoes ? `${detalheAtivo.observacoes}\n${complemento}` : complemento;
    try {
      await persistirAtualizacaoRapidaAgendamento(
        detalheAtivo,
        {
          status: "Desmarcado",
          observacoes: observacoesAtualizadas
        },
        {
          status: "Desmarcado",
          observacoes: observacoesAtualizadas
        }
      );
    } catch {
      return;
    }
    setDesmarqueConsulta({ aberto: false, motivo: "", responsavel: "Paciente" });
    setEventoAtivoId(null);
    setDetalhePosicao(null);
  }

  async function aplicarCancelamentoConsulta() {
    if (!detalheAtivo) return;
    try {
      await persistirAtualizacaoRapidaAgendamento(
        detalheAtivo,
        { status: "Cancelado" },
        { status: "Cancelado" }
      );
    } catch {
      return;
    }
    setConfirmarCancelamentoAberto(false);
    setEventoAtivoId(null);
    setDetalhePosicao(null);
  }

  async function recarregarAgenda() {
    const dataInicio =
      visao === "Dia"
        ? isoParaBr(dataSelecionada)
        : visao === "Semana"
          ? isoParaBr(diasSemana[0])
          : isoParaBr(diasMes[0]);
    const dataFim =
      visao === "Dia"
        ? isoParaBr(dataSelecionada)
        : visao === "Semana"
          ? isoParaBr(diasSemana[diasSemana.length - 1])
          : isoParaBr(diasMes[diasMes.length - 1]);

    let carregados: AgendaApiAgendamento[] = [];
    try {
      carregados = await listarAgendamentosAgenda(dataInicio, dataFim);
    } catch {
      carregados = [];
    }

    const mapaProfissionais = new Map(
      profissionaisUsuariosBase.flatMap((profissional) => [
        [normalizarTextoAgenda(profissional.nome), profissional.id],
        [normalizarTextoAgenda(profissional.usuarioVinculado), profissional.id]
      ])
    );

    const importadosMap = new Map<number, { id: number; nome: string; usuarioVinculado: string; cor: string; corSuave: string }>();
    const ajustados: AgendaEventoUI[] = carregados.map((evento) => {
      const profissionalIdResolvido =
        evento.profissionalId && evento.profissionalId > 0
          ? evento.profissionalId
          : mapaProfissionais.get(normalizarTextoAgenda(evento.profissional)) ?? idProfissionalImportado(evento.profissional);

      if (!mapaProfissionais.has(normalizarTextoAgenda(evento.profissional)) && evento.profissional.trim()) {
        importadosMap.set(
          profissionalIdResolvido,
          construirProfissionalImportado(evento.profissional, importadosMap.size + profissionaisUsuariosBase.length)
        );
      }

      return { ...evento, profissionalId: profissionalIdResolvido, marcadores: [] };
    });

    const idsImportados = Array.from(importadosMap.keys());
    setProfissionaisImportados(Array.from(importadosMap.values()));
    setProfissionaisSelecionados((atual) => [...new Set([...atual, ...idsImportados])]);
    setEventos(ajustados);
  }

  useEffect(() => {
    void recarregarAgenda();
  }, [dataSelecionada, visao]);

  function imprimirAgendaAtual() {
    const janela = window.open("", "_blank", "width=1200,height=900");
    if (!janela) return;
    const extrairDataGuiaImpressao = (valor?: string) => {
      const texto = String(valor || "").trim();
      if (!texto) return "";
      const dataBr = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dataBr) return `${dataBr[1]}/${dataBr[2]}/${dataBr[3]}`;
      const dataCompacta = texto.match(/(20\d{2})(\d{2})(\d{2})/);
      if (dataCompacta) return `${dataCompacta[3]}/${dataCompacta[2]}/${dataCompacta[1]}`;
      return "";
    };
    const colunaProcedimentoImpressao = (evento: AgendaEventoUI) => {
      const procedimento = evento.procedimentos.join(", ") || "-";
      const dataGuia = extrairDataGuiaImpressao(evento.ordemServicoDocumentoNome);
      const trabalho = evento.trabalhoTipo || "A consultar";
      const partes = [`<div class="agenda-print-main">${procedimento}</div>`];
      if (dataGuia) partes.push(`<div class="agenda-print-meta">Data da guia: ${dataGuia}</div>`);
      partes.push(`<div class="agenda-print-meta">Trabalho: ${trabalho}</div>`);
      if (evento.elementoArcada) partes.push(`<div class="agenda-print-meta">Dente / arcada: ${evento.elementoArcada}</div>`);
      return partes.join("");
    };
    const linhas =
      visao === "Dia"
        ? eventosDia
            .sort((a, b) => paraMinutos(a.inicio) - paraMinutos(b.inicio))
            .map((evento) => `<tr><td>${evento.inicio}</td><td>${evento.fim}</td><td>${evento.profissional}</td><td>${evento.paciente}</td><td>${colunaProcedimentoImpressao(evento)}</td></tr>`)
            .join("")
        : visao === "Semana"
          ? eventosDaSemana
              .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio))
              .map((evento) => `<tr><td>${evento.data}</td><td>${evento.inicio}</td><td>${evento.fim}</td><td>${evento.profissional}</td><td>${evento.paciente}</td><td>${colunaProcedimentoImpressao(evento)}</td></tr>`)
              .join("")
          : diasMes
              .map((diaIso) => {
                const eventosDiaMes = eventosVisiveis.filter((evento) => evento.data === isoParaBr(diaIso));
                if (!eventosDiaMes.length) return "";
                return eventosDiaMes
                  .map((evento) => `<tr><td>${evento.data}</td><td>${evento.inicio}</td><td>${evento.profissional}</td><td>${evento.paciente}</td><td>${colunaProcedimentoImpressao(evento)}</td></tr>`)
                  .join("");
              })
              .join("");

    janela.document.write(`
      <html><head><title>Agenda</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#222}
        h1{font-size:22px;margin:0 0 6px}
        h2{font-size:14px;font-weight:400;margin:0 0 18px;color:#555}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #d4d4d4;padding:8px 10px;font-size:12px;text-align:left;vertical-align:top}
        th{background:#efefef}
        .agenda-print-main{font-weight:600;line-height:1.35;margin-bottom:4px}
        .agenda-print-meta{line-height:1.35;color:#555}
      </style></head><body>
      <h1>Agenda</h1>
      <h2>${dataTitulo} · ${visao}</h2>
      <table>
        <thead>
          <tr>${visao === "Dia" ? "<th>Inicio</th><th>Fim</th>" : "<th>Data</th><th>Inicio</th>"}${visao === "Dia" ? "" : "<th>Fim</th>"}<th>Profissional</th><th>${visao === "Dia" ? "Paciente / Evento" : "Paciente / Evento"}</th><th>Procedimento</th></tr>
        </thead>
        <tbody>${linhas || "<tr><td colspan='6'>Sem registros.</td></tr>"}</tbody>
      </table>
      </body></html>
    `);
    janela.document.close();
    janela.focus();
    janela.print();
  }


  function abrirPacientePorDestino(destino: "cadastro" | "financeiro" | "orcamentos" | "ordem_servico") {
    if (!detalheAtivo?.pacienteId || !onAbrirPaciente) return;
    onAbrirPaciente(detalheAtivo.pacienteId, destino);
    setEventoAtivoId(null);
    setDetalhePosicao(null);
  }

  function renderCalendarioLateral() {
    const dias = montarDiasDoMes(dataSelecionada).slice(0, 35);
    const mesAtual = new Date(`${dataSelecionada}T12:00:00`).getMonth();
    return (
      <div className="agenda-mini-calendar">
        <div className="agenda-mini-header">
          <button type="button" onClick={() => navegar(-1)}><ChevronLeft size={18} /></button>
          <div><strong>{mesesInfo.mes}</strong><span>{mesesInfo.ano}</span></div>
          <button type="button" onClick={() => navegar(1)}><ChevronRight size={18} /></button>
        </div>
        <div className="agenda-mini-weekdays">
          {NOMES_DIAS.map((dia) => <span key={dia}>{dia}</span>)}
        </div>
        <div className="agenda-mini-days">
          {dias.map((diaIso) => {
            const data = new Date(`${diaIso}T12:00:00`);
            return (
              <button
                key={diaIso}
                type="button"
                className={`agenda-mini-day${diaIso === dataSelecionada ? " active" : ""}${data.getMonth() !== mesAtual ? " muted" : ""}`}
                onClick={() => selecionarDataAgenda(diaIso)}
              >
                {data.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDia() {
    return (
      <div className="agenda-day-layout">
        <div className="agenda-time-column">
          <div className="agenda-column-header agenda-time-head">Horário</div>
          <div className="agenda-time-list">
            {horariosAgenda.map((slot) => <div key={slot} className="agenda-time-slot">{slot}</div>)}
          </div>
        </div>
        <div className="agenda-day-grid" style={{ gridTemplateColumns: `repeat(${Math.max(profissionaisVisiveis.length, 1)}, minmax(0, 1fr))` }}>
          {linhaHorarioAtual ? (
            <div className="agenda-now-line" style={{ top: `${linhaHorarioAtual.top}px` }}>
              <span className="agenda-now-line-label">{linhaHorarioAtual.hora}</span>
            </div>
          ) : null}
          {profissionaisVisiveis.map((profissional) => {
            const eventosProfissional = eventosDia.filter((evento) => evento.profissionalId === profissional.id);
            const configProfissional = configProfissionais.find((item) => item.id === profissional.id);
            const configDiaProfissional = configProfissional?.configuracaoDias[diaSemanaSelecionado];
            const profissionalBloqueado = !profissionalAtivoNoDia(profissional.id, dataSelecionada);
            const almocoInicioEfetivo = configDiaProfissional
              ? Math.min(
                  paraMinutos(clinicaDiaAtual.almocoInicio),
                  paraMinutos(configDiaProfissional.almocoInicio)
                )
              : paraMinutos(clinicaDiaAtual.almocoInicio);
            const almocoFimEfetivo = configDiaProfissional
              ? Math.max(
                  paraMinutos(clinicaDiaAtual.almocoFim),
                  paraMinutos(configDiaProfissional.almocoFim)
                )
              : paraMinutos(clinicaDiaAtual.almocoFim);
            const almocoTop =
              configDiaProfissional
                ? ((almocoInicioEfetivo - minutoInicialAgenda) / 15) * SLOT_HEIGHT
                : 0;
            const almocoHeight =
              configDiaProfissional
                ? ((almocoFimEfetivo - almocoInicioEfetivo) / 15) * SLOT_HEIGHT
                : 0;
            return (
              <div className="agenda-day-column" key={profissional.id}>
                <div className="agenda-day-column-head">
                  <div className="agenda-prof-chip" style={{ background: profissional.corSuave }}>
                    <span className="agenda-prof-dot" style={{ background: profissional.cor }} />
                    {nomeAgendaProfissional(profissional.id)}
                  </div>
                </div>
                <div className="agenda-day-column-body" style={{ background: profissional.corSuave }}>
                  {profissionalBloqueado ? <div className="agenda-day-unavailable"><span>Indisponível no dia</span></div> : null}
                  {configDiaProfissional ? (
                    <div className="agenda-lunch-block" style={{ top: `${almocoTop}px`, height: `${almocoHeight}px` }}>
                      <span>Almoço</span>
                    </div>
                  ) : null}
                  {horariosAgenda.map((slot) => {
                    const slotDisponivel = slotDisponivelNaAgenda(profissional.id, dataSelecionada, slot);
                    return (
                      <button
                        key={`${profissional.id}-${slot}`}
                        type="button"
                        className={`agenda-slot${slotDisponivel ? "" : " unavailable"}`}
                        disabled={!slotDisponivel}
                        onDoubleClick={() => abrirNovoAgendamento({ data: dataSelecionada, hora: slot, profissionalId: profissional.id })}
                      />
                    );
                  })}
                  {eventosProfissional.map((evento) => {
                    const topo = ((paraMinutos(evento.inicio) - minutoInicialAgenda) / 15) * SLOT_HEIGHT;
                    const altura = ((paraMinutos(evento.fim) - paraMinutos(evento.inicio)) / 15) * SLOT_HEIGHT;
                    return (
                      <button
                        key={evento.id}
                        type="button"
                        className="agenda-event-card"
                        style={{ top: `${topo}px`, height: `${altura}px`, background: corTipo(evento.tipoAtendimentoId) }}
                        onClick={(event) => agendarAberturaDetalhes(evento, event.currentTarget)}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          if (cliqueDetalheTimer.current) {
                            window.clearTimeout(cliqueDetalheTimer.current);
                            cliqueDetalheTimer.current = null;
                          }
                          void abrirEdicaoAgendamento(evento);
                        }}
                      >
                        <span className="agenda-event-dot" style={{ background: corStatusAgendamento(evento.status) }} />
                        <strong>{evento.paciente}</strong>
                        <span>{evento.procedimentos[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderSemana() {
    const eventosPorDia = new Map<string, AgendaEventoUI[]>();
    diasSemana.forEach((diaIso) => {
      eventosPorDia.set(
        diaIso,
        eventosDaSemana.filter((evento) => evento.data === isoParaBr(diaIso))
      );
    });

    return (
      <div className="agenda-week-shell">
        <div className="agenda-week-head">
          <span></span>
          {diasSemana.map((diaIso) => {
            const data = new Date(`${diaIso}T12:00:00`);
            return (
              <span key={diaIso} className={diaIso === dataSelecionada ? "active" : ""}>
                {data.getDate()} - {NOMES_DIAS_LONGOS[data.getDay()]}
              </span>
            );
          })}
        </div>
        <div className="agenda-week-grid-visual">
          <div className="agenda-week-times-visual">
            {horariosAgenda.map((slot) => (
              <div key={slot} className="agenda-week-time-visual">{slot}</div>
            ))}
          </div>
          {diasSemana.map((diaIso) => {
            const eventosDiaSemana = eventosPorDia.get(diaIso) ?? [];
            const colunas = calcularColunasSobrepostas(eventosDiaSemana);
            return (
              <div
                key={diaIso}
                className={`agenda-week-day-column${diaIso === dataSelecionada ? " current" : ""}`}
                onDoubleClick={() => abrirNovoAgendamento({ data: diaIso, hora: horariosAgenda[0] ?? "08:00", profissionalId: profissionaisVisiveis[0]?.id ?? profissionaisBase[0].id })}
              >
                {horariosAgenda.map((slot) => (
                  <div key={`${diaIso}-${slot}`} className="agenda-week-slot-line" />
                ))}
                {eventosDiaSemana.map((evento) => {
                  const layout = colunas.get(evento.id) ?? { coluna: 0, totalColunas: 1 };
                  const topo = ((paraMinutos(evento.inicio) - minutoInicialAgenda) / 15) * SLOT_HEIGHT;
                  const altura = ((paraMinutos(evento.fim) - paraMinutos(evento.inicio)) / 15) * SLOT_HEIGHT;
                  const largura = `calc((100% - 8px) / ${layout.totalColunas})`;
                  const esquerda = `calc(${layout.coluna} * ((100% - 8px) / ${layout.totalColunas}))`;
                  return (
                    <button
                      key={evento.id}
                      type="button"
                      className="agenda-week-event-block"
                      style={{
                        top: `${topo}px`,
                        height: `${Math.max(altura, 18)}px`,
                        width: largura,
                        left: esquerda,
                        background: corProfissionalPorId(evento.profissionalId)
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        agendarAberturaDetalhes(evento, event.currentTarget);
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        if (cliqueDetalheTimer.current) {
                          window.clearTimeout(cliqueDetalheTimer.current);
                          cliqueDetalheTimer.current = null;
                        }
                        void abrirEdicaoAgendamento(evento);
                      }}
                    >
                      <span>{resumoEventoAgenda(evento.paciente)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderMes() {
    return (
      <div className="agenda-month-shell">
        <div className="agenda-month-head">
          {NOMES_DIAS_LONGOS.map((dia) => <div key={dia}>{dia}</div>)}
        </div>
        <div className="agenda-month-grid">
          {diasMes.map((diaIso) => {
            const data = new Date(`${diaIso}T12:00:00`);
            const eventosDiaMes = eventosVisiveis.filter((evento) => evento.data === isoParaBr(diaIso));
            const foraDoMes = data.getMonth() !== new Date(`${dataSelecionada}T12:00:00`).getMonth();
            return (
              <button
                key={diaIso}
                type="button"
                className={`agenda-month-cell${diaIso === dataSelecionada ? " active" : ""}${foraDoMes ? " muted" : ""}`}
                onClick={() => selecionarDataAgenda(diaIso)}
              >
                <div className="agenda-month-day-number">{data.getDate()}</div>
                <div className="agenda-month-markers">
                  {eventosDiaMes.slice(0, 12).map((evento) => (
                    <span
                      key={evento.id}
                      className="agenda-month-marker"
                      style={{ background: corProfissionalPorId(evento.profissionalId) }}
                      onClick={(event) => {
                        event.stopPropagation();
                        agendarAberturaDetalhes(evento, event.currentTarget as HTMLElement);
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        if (cliqueDetalheTimer.current) {
                          window.clearTimeout(cliqueDetalheTimer.current);
                          cliqueDetalheTimer.current = null;
                        }
                        void abrirEdicaoAgendamento(evento);
                      }}
                      title={`${evento.inicio} · ${evento.paciente}`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="agenda-shell">
        <aside className="panel agenda-leftbar">
          {renderCalendarioLateral()}
          <div className="agenda-profissionais-panel">
            <div className="section-title-row">
              <div><span className="panel-kicker">Equipe</span><h2>Profissionais</h2></div>
            </div>
            <div className="agenda-profissionais-list">
              {profissionaisDisponiveis.map((profissional) => (
                <div
                  key={profissional.id}
                  className={`agenda-prof-option${profissionaisSelecionados.includes(profissional.id) ? " active" : ""}`}
                >
                  <button
                    type="button"
                    className="agenda-prof-option-dot-button"
                    onClick={() => selecionarSomenteProfissional(profissional.id)}
                    title="Mostrar somente este profissional"
                    aria-label={`Mostrar somente ${nomeAgendaProfissional(profissional.id)}`}
                  >
                    <span className="agenda-prof-option-dot" style={{ background: profissional.cor }} />
                  </button>
                  <button
                    type="button"
                    className="agenda-prof-option-label"
                    onClick={() => toggleProfissional(profissional.id)}
                    title="Adicionar ou remover da seleção"
                  >
                    {nomeAgendaProfissional(profissional.id)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="panel agenda-main">
          <div className="agenda-toolbar">
            <div className="agenda-toolbar-actions">
              <button type="button" className="icon-action agenda-toolbar-btn" onClick={() => abrirNovoAgendamento(rascunhoSlot)} title="Novo agendamento"><Plus size={18} /></button>
              <button type="button" className="icon-action agenda-toolbar-btn" onClick={() => onAbrirNovoPaciente?.()} title="Novo paciente"><UserRoundPlus size={18} /></button>
              <button type="button" className="icon-action agenda-toolbar-btn" onClick={() => void recarregarAgenda()} title="Atualizar agenda"><RefreshCcw size={18} /></button>
              <button type="button" className="icon-action agenda-toolbar-btn" onClick={imprimirAgendaAtual} title="Imprimir agenda"><Printer size={18} /></button>
              <button type="button" className="ghost-action" onClick={() => selecionarDataAgenda(hojeIso())}>Hoje</button>
              <button type="button" className="icon-action agenda-toolbar-btn" onClick={() => navegar(-1)} title="Anterior"><ChevronLeft size={18} /></button>
              <button type="button" className="icon-action agenda-toolbar-btn" onClick={() => navegar(1)} title="Próximo"><ChevronRight size={18} /></button>
            </div>
            <div className="agenda-toolbar-title">{dataTitulo}</div>
            <div className="agenda-toolbar-views">
              {(["Mês", "Semana", "Dia"] as AgendaView[]).map((item) => (
                <button key={item} type="button" className={`ghost-action${visao === item ? " active" : ""}`} onClick={() => setVisao(item)}>
                  {item}
                </button>
              ))}
              {usuarioEhAdministrador ? (
                <button type="button" className="icon-action agenda-toolbar-btn" onClick={() => setModalConfiguracaoAberto(true)} title="Configuração da agenda"><Settings size={18} /></button>
              ) : null}
            </div>
          </div>
          {visao === "Dia" ? renderDia() : null}
          {visao === "Semana" ? renderSemana() : null}
          {visao === "Mês" ? renderMes() : null}
        </section>
      </section>

      {detalheAtivo && detalhePosicao ? (
        <>
        <button
          type="button"
          className="agenda-detail-backdrop"
          aria-label="Fechar visualização"
          onClick={() => {
            setEventoAtivoId(null);
            setDetalhePosicao(null);
          }}
        />
        <aside
          className={`panel agenda-detail-popover ${detalhePosicao.placement}`}
          style={{ top: detalhePosicao.top, left: detalhePosicao.left }}
        >
          <div className="agenda-detail-header">
            <div className="agenda-detail-title">Detalhes do agendamento</div>
            <button type="button" className="icon-action" onClick={() => { setEventoAtivoId(null); setDetalhePosicao(null); }}><X size={16} /></button>
          </div>
          <div className="agenda-detail-actions">
            <button type="button" className="agenda-detail-action" onClick={() => abrirPacientePorDestino("cadastro")} title="Abrir paciente">
              <UserRound size={16} />
            </button>
            <button type="button" className="agenda-detail-action" onClick={() => abrirPacientePorDestino("orcamentos")} title="Abrir orçamentos">
              <FileText size={16} />
            </button>
            {detalheAtivo?.ordemServicoDocumentoNome || detalheAtivo?.trabalhoTipo ? (
              <button type="button" className="agenda-detail-action" onClick={() => abrirPacientePorDestino("ordem_servico")} title="Abrir ordem de serviço">
                <ClipboardList size={16} />
              </button>
            ) : null}
            <button type="button" className="agenda-detail-action" onClick={() => abrirPacientePorDestino("financeiro")} title="Abrir financeiro">
              <CircleDollarSign size={16} />
            </button>
            <button type="button" className="agenda-detail-action" onClick={() => setDesmarqueConsulta({ aberto: true, motivo: "", responsavel: "Paciente" })} title="Desmarcar consulta">
              <CalendarX2 size={16} />
            </button>
            <button type="button" className="agenda-detail-action" onClick={() => setConfirmarCancelamentoAberto(true)} title="Cancelar consulta">
              <Ban size={16} />
            </button>
          </div>
          <div className="agenda-detail-list">
            <label>
              <span>Status</span>
              <div className="agenda-status-select-row">
                <span className={`agenda-event-status-dot ${classeStatusAgendamento(detalheAtivo.status)}`} style={{ background: corStatusAgendamento(detalheAtivo.status) }} />
                <select value={detalheAtivo.status} onChange={(event) => void atualizarStatusAgendamento(detalheAtivo.id, event.target.value as AgendaEventoUI["status"])}>
                  {["Agendado", "Confirmado", "Em espera", "Em atendimento", "Atendido", "Atrasado", "Faltou", "Desmarcado", "Cancelado"].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </label>
            <div><strong>Agendado por:</strong> {detalheAtivo.agendadoPor || "Sistema"}</div>
            <div><strong>Agendado em:</strong> {detalheAtivo.agendadoEm ?? "Agora"}</div>
            <div><strong>Profissional:</strong> {detalheAtivo.profissional}</div>
            <div><strong>Sala:</strong> {detalheAtivo.consultorio || "Não definida"}</div>
            <div><strong>Prontuário:</strong> {detalheAtivo.paciente} ({detalheAtivo.prontuario})</div>
            <div><strong>Telefone:</strong> {detalheAtivo.telefone}</div>
            <div><strong>Horário:</strong> {detalheAtivo.inicio} - {detalheAtivo.fim}</div>
            <div><strong>Procedimentos:</strong> {detalheAtivo.procedimentos.join(", ")}</div>
            <div><strong>Trabalho:</strong> {detalheAtivo.trabalhoTipo || "Não informado"}</div>
            <div><strong>Guia emitida:</strong> {detalheAtivo.ordemServicoDocumentoNome || "Sem guia vinculada"}</div>
            <div><strong>Dente / arcada:</strong> {detalheAtivo.elementoArcada || "Não informado"}</div>
            <div><strong>Marcadores:</strong> {(detalheAtivo.marcadores ?? []).join(", ") || "Sem marcadores"}</div>
            <div><strong>Observações:</strong> {detalheAtivo.observacoes || "Sem observações"}</div>
            <div className="agenda-history-block">
              <strong>Histórico</strong>
              <div className="agenda-history-list">
                {detalheAtivo.historico?.length
                  ? detalheAtivo.historico.map((item, indice) => (
                      <div key={`${item.criadoEm}-${indice}`} className="agenda-history-item">
                        {item.acao === "MODIFICADO"
                          ? `Modificado (${item.descricao}) em ${item.criadoEm} por ${item.criadoPor}`
                          : `Agendado em ${item.criadoEm} por ${item.criadoPor}`}
                      </div>
                    ))
                  : <div className="agenda-history-item">Sem alterações registradas.</div>}
              </div>
            </div>
            <div className="agenda-finance-row">
              <strong>Indicador financeiro:</strong>
              <span className={`agenda-finance-pill ${classeFinanceiroAgenda(detalheAtivo.financeiro)}`}>
                {detalheAtivo.financeiro || "Sem vínculo"}
              </span>
            </div>
          </div>
        </aside>
        </>
      ) : null}

      {modalAberto ? (
        <div className="modal-backdrop">
          <div className="agenda-modal-shell agenda-modal-shell-compact">
            <div className="agenda-modal-header">
              <div className="agenda-modal-title-wrap">
                {(["Nova Consulta", "Compromisso", "Evento"] as AgendaTab[]).map((tab) => (
                  <button key={tab} type="button" className={`agenda-tab-trigger${abaModal === tab ? " active" : ""}`} onClick={() => setAbaModal(tab)}>
                    {tab}
                  </button>
                ))}
              </div>
              <button type="button" className="icon-action" onClick={() => { setAgendamentoEditandoId(null); setModalAberto(false); }}><X size={18} /></button>
            </div>
            <div className="agenda-modal-body agenda-modal-body-tight">
              <>
                <div className="agenda-modal-grid agenda-consulta-top-grid">
                  {abaModal === "Nova Consulta" ? (
                    <>
                      <label className="agenda-paciente-field agenda-span-2">
                        <span>Paciente</span>
                        <input value={form.pacienteBusca} onChange={(event) => {
                          const valor = event.target.value;
                          setModoNovoPacienteRapido(false);
                          setGuiasEmitidasPaciente([]);
                          setForm((atual) => ({
                            ...atual,
                            pacienteId: null,
                            pacienteBusca: valor,
                            nomePaciente: valor,
                            trabalhoTipo: "",
                            ordemServicoId: null,
                            ordemServicoDocumentoNome: "",
                            elementoArcada: ""
                          }));
                        }} placeholder="Digite o nome do paciente" />
                        {carregandoSugestoes ? <div className="agenda-dropdown">Buscando...</div> : null}
                        {!carregandoSugestoes && !form.pacienteId && !modoNovoPacienteRapido && (sugestoesPaciente.length > 0 || form.pacienteBusca.trim()) ? (
                          <div className="agenda-dropdown">
                            {sugestoesPaciente.map((item) => (
                              <button key={item.id} type="button" onClick={() => void selecionarPaciente(item)}>
                                <strong>{item.nome}</strong>
                                <span>Prontuário {item.prontuario} · {item.celular}</span>
                              </button>
                            ))}
                            {!sugestoesPaciente.length ? (
                              <button type="button" onClick={escolherNaoEncontrado}>
                                <strong>Não encontrado - Novo</strong>
                                <span>Cadastro inicial com nome e celular</span>
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        {modoNovoPacienteRapido ? <div className="agenda-inline-hint">Cadastro rápido ativado. Informe o celular e clique em Agendar.</div> : null}
                      </label>
                      <label><span>Celular</span><input value={form.celular} onChange={(event) => setForm((atual) => ({ ...atual, celular: event.target.value }))} /></label>
                      <label><span>Prontuário</span><input value={form.prontuario} readOnly /></label>
                    </>
                  ) : (
                    <>
                      <label className="agenda-span-2">
                        <span>{abaModal}</span>
                        <input value={form.nomePaciente} onChange={(event) => setForm((atual) => ({ ...atual, nomePaciente: event.target.value, pacienteBusca: event.target.value }))} placeholder={abaModal === "Evento" ? "Ex.: Reunião da equipe" : "Ex.: Compromisso interno"} />
                      </label>
                      <label className="agenda-check-field">
                        <span>Toda a equipe</span>
                        <input type="checkbox" checked={eventoTodaEquipe} onChange={(event) => setEventoTodaEquipe(event.target.checked)} />
                      </label>
                    </>
                  )}
                  <label><span>Data</span><input type="date" value={form.data} onChange={(event) => setForm((atual) => ({ ...atual, data: event.target.value }))} /></label>
                  <label>
                    <span>Profissional</span>
                    <select value={String(form.profissionalId)} disabled={abaModal !== "Nova Consulta" && eventoTodaEquipe} onChange={(event) => setForm((atual) => ({ ...atual, profissionalId: Number(event.target.value) }))}>
                      {profissionaisDisponiveis.map((item) => <option key={item.id} value={item.id}>{nomeAgendaProfissional(item.id)}</option>)}
                    </select>
                  </label>
                  {abaModal === "Nova Consulta" ? (
                    <label>
                      <span>Tipo de atendimento</span>
                      <select value={String(form.tipoAtendimentoId)} onChange={(event) => setForm((atual) => ({ ...atual, tipoAtendimentoId: Number(event.target.value) }))}>
                        {tiposAtendimentoAgenda.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                        <option value="999">Adicionar...</option>
                      </select>
                    </label>
                  ) : null}
                  <label>
                    <span>Status</span>
                    <select value={form.status} onChange={(event) => setForm((atual) => ({ ...atual, status: event.target.value as AgendaEventoUI["status"] }))}>
                      {["Agendado", "Confirmado", "Em espera", "Em atendimento", "Atendido", "Atrasado", "Faltou", "Desmarcado", "Cancelado"].map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label><span>Agendado por</span><input value={form.agendadoPor} readOnly /></label>
                  <label><span>Agendado em</span><input value={form.agendadoEm} readOnly /></label>
                  <label className="agenda-resumo-horario agenda-span-2"><span>Horário</span><input value={`${form.horarioInicio} - ${form.horarioFim} · ${form.duracaoMinutos} min`} readOnly /></label>
                </div>

                <div className="agenda-message-row agenda-message-row-compact">
                  <label className="agenda-message-card"><span>Confirmação</span><select defaultValue="Enviar agora"><option>Enviar agora</option><option>Não enviar</option></select></label>
                  <label className="agenda-message-card"><span>Alerta</span><select defaultValue="Um dia antes"><option>Um dia antes</option><option>No mesmo dia</option><option>Não enviar</option></select></label>
                </div>

                <div className="agenda-horarios-block agenda-horarios-block-tight">
                  <div className="agenda-horarios-title-wrap">
                    <strong>Horários</strong>
                    <span>{carregandoDisponibilidade ? "Atualizando disponibilidade..." : "Vermelho = ocupado · Branco = livre · Azul = seleção"}</span>
                  </div>
                  <div className="agenda-timeline-picker compact">
                    {horariosAgenda.map((slot) => {
                      const foraDisponibilidade = !slotDisponivelNaAgenda(form.profissionalId, form.data, slot);
                      const ocupado = slotsOcupados.includes(slot) && !slotsSelecionados.includes(slot);
                      const selecionado = slotsSelecionados.includes(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={foraDisponibilidade}
                          className={`timeline-slot${ocupado ? " ocupado" : ""}${selecionado ? " selecionado" : ""}${foraDisponibilidade ? " unavailable" : ""}`}
                          onClick={() => selecionarSlot(slot)}
                        >
                          <span>{slot}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="agenda-consulta-main-grid">
                  <div className="agenda-procedimentos-stack">
                    {abaModal === "Nova Consulta" ? (
                      <>
                        {contextoPaciente.length ? (
                          <section className="agenda-procedimentos-section">
                            <div className="agenda-procedimentos-section-label">Procedimento contratado</div>
                            <div className="agenda-procedimentos-box compact">
                              <div className="agenda-procedimentos-header">
                                <strong>Selecionar do contrato</strong>
                                <span>Escolha o procedimento contratado que será usado neste atendimento.</span>
                              </div>
                              <div className="agenda-manual-row compact">
                                <label className="agenda-span-2">
                                  <span>Procedimento do contrato</span>
                                  <select value={procedimentoContratoSelecionado} onChange={(event) => setProcedimentoContratoSelecionado(event.target.value)}>
                                    <option value="">Selecione</option>
                                    {contextoPaciente.map((procedimento) => (
                                      <option key={procedimento.chave} value={procedimento.chave}>
                                        {`${procedimento.nome} · Sessões ${procedimento.sessoesRestantes}/${procedimento.sessoesTotal}`}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <button
                                  type="button"
                                  className="primary-action compact agenda-add-procedimento"
                                  onClick={adicionarProcedimentoContratoSelecionado}
                                  disabled={!procedimentoContratoSelecionado}
                                >
                                  <Check size={15} />
                                  Usar no agendamento
                                </button>
                              </div>
                            </div>
                          </section>
                        ) : null}

                        <section className="agenda-procedimentos-section">
                          <div className="agenda-procedimentos-section-label">Complemento manual</div>
                            <div className="agenda-procedimentos-box compact">
                            <div className="agenda-procedimentos-header">
                              <strong>Adicionar procedimento manual</strong>
                              <span>Use esta área apenas quando precisar complementar o atendimento com um procedimento fora do contrato.</span>
                            </div>
                            <div className="agenda-manual-row compact">
                              <label>
                                <span>Procedimento manual</span>
                                <input value={procedimentoManual} onChange={(event) => setProcedimentoManual(event.target.value)} placeholder="Ex.: Moldagem" />
                              </label>
                              <label className="small">
                                <span>Duração</span>
                                <select value={String(duracaoManual)} onChange={(event) => setDuracaoManual(Number(event.target.value))}>
                                  {[15, 30, 45, 60, 75, 90].map((tempo) => <option key={tempo} value={tempo}>{tempo} min</option>)}
                                </select>
                              </label>
                              <button type="button" className="primary-action compact agenda-add-procedimento" onClick={adicionarProcedimentoManual}><Plus size={15} />Adicionar</button>
                            </div>
                          </div>
                        </section>

                        <section className="agenda-procedimentos-section">
                          <div className="agenda-procedimentos-section-label">Trabalho protético</div>
                          <div className="agenda-procedimentos-box compact">
                            <div className="agenda-procedimentos-header">
                              <strong>Guia e localização do trabalho</strong>
                              <span>Selecione livremente uma guia emitida do paciente e informe onde o trabalho está.</span>
                            </div>
                            <div className="agenda-manual-row compact">
                              <label className="agenda-span-2">
                                <span>Guia emitida</span>
                                <select
                                  value={String(form.ordemServicoId ?? "")}
                                  onChange={(event) => {
                                    const guia = guiasDisponiveisPaciente.find((item) => item.id === Number(event.target.value));
                                    setForm((atual) => ({
                                      ...atual,
                                      ordemServicoId: guia?.id ?? null,
                                      ordemServicoDocumentoNome: guia?.documentoNome || "",
                                      elementoArcada: atual.elementoArcada || guia?.elementoArcada || ""
                                    }));
                                  }}
                                  disabled={!guiasDisponiveisPaciente.length}
                                >
                                  <option value="">{guiasDisponiveisPaciente.length ? "Selecione a guia" : "Sem guia emitida"}</option>
                                  {guiasDisponiveisPaciente.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {descricaoGuiaAgenda(item)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span>Local do trabalho</span>
                                <select
                                  value={form.trabalhoTipo}
                                  onChange={(event) => setForm((atual) => ({ ...atual, trabalhoTipo: event.target.value }))}
                                >
                                  <option value="">Deixar em branco</option>
                                  <option value="Trabalho na Clínica">Trabalho na Clínica</option>
                                  <option value="Trabalho no Laboratório">Trabalho no Laboratório</option>
                                </select>
                              </label>
                              <label>
                                <span>Dente ou arcada</span>
                                <input
                                  value={form.elementoArcada}
                                  onChange={(event) => setForm((atual) => ({ ...atual, elementoArcada: event.target.value }))}
                                  placeholder="Ex.: 11, 21 ou arcada superior"
                                />
                              </label>
                            </div>
                            <small className="agenda-inline-hint">{mensagemTrabalhoProt}</small>
                          </div>
                        </section>

                        <section className="agenda-procedimentos-section">
                          <div className="agenda-procedimentos-section-label">Composição final</div>
                          <div className="agenda-procedimentos-box compact">
                            <div className="agenda-procedimentos-header">
                              <div className="agenda-procedimentos-title-row">
                                <strong>Procedimentos deste agendamento</strong>
                                <span className="agenda-procedimentos-count">{procedimentosSelecionados.length} item(ns)</span>
                              </div>
                              <span>Todos os itens abaixo serão salvos no atendimento, vindos do contrato ou inseridos manualmente.</span>
                            </div>
                            <div className="agenda-selected-procedures">
                              {procedimentosSelecionados.length ? procedimentosSelecionados.map((item) => <ProcedimentoBadge key={item.chave} item={item} onRemove={removerProcedimento} />) : <span className="empty-inline">Nenhum procedimento selecionado para este agendamento.</span>}
                            </div>
                            {erroAgendaModal ? <div className="agenda-inline-error">{erroAgendaModal}</div> : null}
                            <label className="agenda-observacao-field">
                              <span>Observações</span>
                              <textarea rows={2} value={form.observacoes} onChange={(event) => setForm((atual) => ({ ...atual, observacoes: event.target.value }))} />
                            </label>
                          </div>
                        </section>
                      </>
                    ) : (
                      <section className="agenda-procedimentos-section">
                        <div className="agenda-procedimentos-section-label">Descrição</div>
                        <div className="agenda-procedimentos-box compact">
                          <div className="agenda-procedimentos-header">
                            <strong>{abaModal}</strong>
                            <span>Campo livre para registrar reuniões, bloqueios e compromissos internos.</span>
                          </div>
                          <label className="agenda-observacao-field">
                            <span>Observações</span>
                            <textarea rows={8} value={form.observacoes} onChange={(event) => setForm((atual) => ({ ...atual, observacoes: event.target.value }))} />
                          </label>
                        </div>
                      </section>
                    )}

                  </div>

                  <div className="agenda-modal-footer">
                    <button type="button" className="ghost-action" onClick={() => { setAgendamentoEditandoId(null); setModalAberto(false); }}>Cancelar</button>
                    <button type="button" className="primary-action" onClick={() => void salvarAgendamento()} disabled={salvando}>
                      {salvando ? "Salvando..." : agendamentoEditandoId ? "Salvar alterações" : abaModal === "Nova Consulta" ? "Agendar" : "Salvar"}
                    </button>
                  </div>
                </div>
              </>
            </div>
          </div>
        </div>
      ) : null}

      {modalConfiguracaoAberto && usuarioEhAdministrador ? (
        <div className="modal-backdrop">
          <div className="agenda-modal-shell agenda-modal-shell-compact agenda-config-shell">
            <div className="agenda-modal-header">
              <div className="agenda-modal-title-wrap">
                <button type="button" className="agenda-tab-trigger active">Configuração da agenda</button>
              </div>
              <button type="button" className="icon-action" onClick={() => setModalConfiguracaoAberto(false)}><X size={18} /></button>
            </div>
            <div className="agenda-modal-body agenda-modal-body-tight">
              <fieldset className="agenda-config-fieldset" disabled={!usuarioEhAdministrador}>
              <div className="agenda-modal-grid agenda-consulta-top-grid">
                <label>
                  <span>Dia da semana</span>
                  <select value={String(diaConfiguracaoSelecionado)} onChange={(event) => setDiaConfiguracaoSelecionado(Number(event.target.value))}>
                    {NOMES_DIAS_LONGOS.map((dia, indice) => (
                      <option key={dia} value={indice}>{dia}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Clínica abre</span>
                  <input type="time" value={configClinicaDias[diaConfiguracaoSelecionado].inicio} onChange={(event) => atualizarConfigClinicaDia(diaConfiguracaoSelecionado, "inicio", event.target.value)} />
                </label>
                <label>
                  <span>Clínica fecha</span>
                  <input type="time" value={configClinicaDias[diaConfiguracaoSelecionado].fim} onChange={(event) => atualizarConfigClinicaDia(diaConfiguracaoSelecionado, "fim", event.target.value)} />
                </label>
                <label>
                  <span>Almoço início</span>
                  <input type="time" value={configClinicaDias[diaConfiguracaoSelecionado].almocoInicio} onChange={(event) => atualizarConfigClinicaDia(diaConfiguracaoSelecionado, "almocoInicio", event.target.value)} />
                </label>
                <label>
                  <span>Almoço fim</span>
                  <input type="time" value={configClinicaDias[diaConfiguracaoSelecionado].almocoFim} onChange={(event) => atualizarConfigClinicaDia(diaConfiguracaoSelecionado, "almocoFim", event.target.value)} />
                </label>
              </div>

              <div className="agenda-config-list">
                {profissionaisOrdenados.map((profissional, indice) => {
                  const config = configProfissionais.find((item) => item.id === profissional.id);
                  if (!config) return null;
                  return (
                    <div
                      key={profissional.id}
                      className={`agenda-config-card${profissionalArrastandoId === profissional.id ? " dragging" : ""}`}
                      draggable={usuarioEhAdministrador}
                      onDragStart={() => setProfissionalArrastandoId(profissional.id)}
                      onDragEnd={() => setProfissionalArrastandoId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (profissionalArrastandoId) {
                          moverProfissionalParaPosicao(profissionalArrastandoId, profissional.id);
                        }
                        setProfissionalArrastandoId(null);
                      }}
                    >
                      <div className="agenda-config-card-head">
                        <div className="agenda-config-card-head-main">
                          <strong>{nomeAgendaProfissional(profissional.id)}</strong>
                          <div className="agenda-config-card-actions">
                            <button type="button" className="agenda-order-button" onClick={() => moverProfissionalOrdem(profissional.id, -1)} disabled={indice === 0} aria-label="Subir profissional"><ChevronUp size={14} /></button>
                            <button type="button" className="agenda-order-button" onClick={() => moverProfissionalOrdem(profissional.id, 1)} disabled={indice === profissionaisOrdenados.length - 1} aria-label="Descer profissional"><ChevronDown size={14} /></button>
                          </div>
                        </div>
                        <label className="agenda-check-field inline">
                          <span>Mostrar na agenda</span>
                          <input
                            type="checkbox"
                            checked={config.mostrar}
                            onChange={(event) =>
                              setConfigProfissionais((atual) =>
                                atual.map((item) => item.id === profissional.id ? { ...item, mostrar: event.target.checked } : item)
                              )
                            }
                          />
                        </label>
                      </div>
                      <div className="agenda-config-grid">
                        <label>
                          <span>Nome na agenda</span>
                          <input
                            value={config.nomeAgenda}
                            onChange={(event) =>
                              setConfigProfissionais((atual) =>
                                atual.map((item) => item.id === profissional.id ? { ...item, nomeAgenda: event.target.value } : item)
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>Usuário vinculado</span>
                          <select
                            value={config.usuarioVinculado}
                            onChange={(event) =>
                              setConfigProfissionais((atual) =>
                                atual.map((item) => item.id === profissional.id ? { ...item, usuarioVinculado: event.target.value } : item)
                              )
                            }
                          >
                            {usuariosAgendaDisponiveis.map((nome) => (
                              <option key={nome} value={nome}>{nome}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Cor do profissional</span>
                          <input
                            type="color"
                            value={config.cor}
                            className="agenda-color-input"
                            onChange={(event) =>
                              setConfigProfissionais((atual) =>
                                atual.map((item) => item.id === profissional.id ? { ...item, cor: event.target.value, corSuave: suavizarCor(event.target.value) } : item)
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>Atende de</span>
                          <input
                            type="time"
                            value={config.configuracaoDias[diaConfiguracaoSelecionado].inicio}
                            onChange={(event) => atualizarConfigProfissionalDia(profissional.id, diaConfiguracaoSelecionado, "inicio", event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Até</span>
                          <input
                            type="time"
                            value={config.configuracaoDias[diaConfiguracaoSelecionado].fim}
                            onChange={(event) => atualizarConfigProfissionalDia(profissional.id, diaConfiguracaoSelecionado, "fim", event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Almoço início</span>
                          <input
                            type="time"
                            value={config.configuracaoDias[diaConfiguracaoSelecionado].almocoInicio}
                            onChange={(event) => atualizarConfigProfissionalDia(profissional.id, diaConfiguracaoSelecionado, "almocoInicio", event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Almoço fim</span>
                          <input
                            type="time"
                            value={config.configuracaoDias[diaConfiguracaoSelecionado].almocoFim}
                            onChange={(event) => atualizarConfigProfissionalDia(profissional.id, diaConfiguracaoSelecionado, "almocoFim", event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Sala / consultório</span>
                          <select
                            value={config.configuracaoDias[diaConfiguracaoSelecionado].consultorio || ""}
                            onChange={(event) => atualizarConfigProfissionalDia(profissional.id, diaConfiguracaoSelecionado, "consultorio", event.target.value)}
                          >
                            <option value="">Automático / primeira livre</option>
                            {salasAgenda.map((sala) => (
                              <option key={sala} value={sala}>{sala}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Máx. por horário</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={String(config.maxAgendamentosPorHorario)}
                            onChange={(event) =>
                              setConfigProfissionais((atual) =>
                                atual.map((item) =>
                                  item.id === profissional.id
                                    ? { ...item, maxAgendamentosPorHorario: Math.max(1, Number(event.target.value) || 1) }
                                    : item
                                )
                              )
                            }
                          />
                        </label>
                        <label className="agenda-check-field inline">
                          <span>Ativo no dia</span>
                          <input
                            type="checkbox"
                            checked={config.configuracaoDias[diaConfiguracaoSelecionado].ativo}
                            onChange={() => alternarDiaProfissional(profissional.id, diaConfiguracaoSelecionado)}
                          />
                        </label>
                      </div>
                      <div className="agenda-config-days">
                        {NOMES_DIAS_LONGOS.map((dia, indiceDia) => (
                          <button
                            key={`${profissional.id}-${dia}`}
                            type="button"
                            className={`agenda-config-day${config.configuracaoDias[indiceDia].ativo ? " active" : ""}${diaConfiguracaoSelecionado === indiceDia ? " current" : ""}`}
                            onClick={() => setDiaConfiguracaoSelecionado(indiceDia)}
                          >
                            {dia.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="agenda-modal-grid agenda-consulta-top-grid">
                <label className="agenda-span-2">
                  <span>Salas disponíveis</span>
                  <textarea
                    value={salasAgenda.join("\n")}
                    onChange={(event) => setSalasAgenda(normalizarListaSalas(event.target.value.split(/\r?\n/)))}
                    rows={7}
                    placeholder="Uma sala por linha"
                  />
                </label>
              </div>
              </fieldset>
              {!usuarioEhAdministrador ? <div className="agenda-config-readonly-note">Somente administradores podem alterar horários disponíveis e definir quem está ativo no dia.</div> : null}

              <div className="agenda-modal-footer">
                <button type="button" className="ghost-action" onClick={() => setModalConfiguracaoAberto(false)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {desmarqueConsulta.aberto ? (
        <div className="modal-backdrop">
          <div className="agenda-modal-shell agenda-modal-shell-compact agenda-config-shell">
            <div className="agenda-modal-header">
              <div className="agenda-modal-title-wrap">
                <button type="button" className="agenda-tab-trigger active">Desmarcar consulta</button>
              </div>
              <button type="button" className="icon-action" onClick={() => setDesmarqueConsulta({ aberto: false, motivo: "", responsavel: "Paciente" })}><X size={18} /></button>
            </div>
            <div className="agenda-modal-body agenda-modal-body-tight">
              <div className="agenda-modal-grid">
                <label className="agenda-span-2">
                  <span>Desmarcado por</span>
                  <div className="agenda-radio-row">
                    <label><input type="radio" checked={desmarqueConsulta.responsavel === "Paciente"} onChange={() => setDesmarqueConsulta((atual) => ({ ...atual, responsavel: "Paciente" }))} />Paciente</label>
                    <label><input type="radio" checked={desmarqueConsulta.responsavel === "Profissional"} onChange={() => setDesmarqueConsulta((atual) => ({ ...atual, responsavel: "Profissional" }))} />Profissional</label>
                  </div>
                </label>
                <label className="agenda-span-2 agenda-observacao-field">
                  <span>Motivo</span>
                  <textarea rows={5} value={desmarqueConsulta.motivo} onChange={(event) => setDesmarqueConsulta((atual) => ({ ...atual, motivo: event.target.value }))} />
                </label>
              </div>
              <div className="agenda-modal-footer">
                <button type="button" className="ghost-action" onClick={() => setDesmarqueConsulta({ aberto: false, motivo: "", responsavel: "Paciente" })}>Cancelar</button>
                <button type="button" className="primary-action" onClick={() => void aplicarDesmarqueConsulta()}>Ok</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmarCancelamentoAberto ? (
        <div className="modal-backdrop">
          <div className="agenda-modal-shell agenda-modal-shell-compact agenda-config-shell">
            <div className="agenda-modal-header">
              <div className="agenda-modal-title-wrap">
                <button type="button" className="agenda-tab-trigger active">Cancelar consulta</button>
              </div>
              <button type="button" className="icon-action" onClick={() => setConfirmarCancelamentoAberto(false)}><X size={18} /></button>
            </div>
            <div className="agenda-modal-body agenda-modal-body-tight">
              <div className="placeholder-copy"><p>Deseja realmente cancelar esta consulta?</p></div>
              <div className="agenda-modal-footer">
                <button type="button" className="ghost-action" onClick={() => setConfirmarCancelamentoAberto(false)}>Cancelar</button>
                <button type="button" className="primary-action" onClick={() => void aplicarCancelamentoConsulta()}>Ok</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}




















