import { CalendarDays, CheckCircle2, Download, Megaphone, Save, Search, UserRoundPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  adicionarPacienteManualCrmApi,
  adicionarPacienteAvaliacaoCrmApi,
  removerPacienteCanceladoCrmApi,
  removerPacienteAvaliacaoCrmApi,
  atualizarCrmApi,
  atualizarCrmResgateApi,
  listarPacientesApi,
  listarCrmApi,
  type CrmAvaliacaoItemApi,
  type CrmNovoLeadPayloadApi,
  type CrmPacienteItemApi,
  type CrmResgateItemApi,
} from "./pacientesApi";
import { listarAgendamentosAgenda, type AgendaApiAgendamento } from "./agendaApi";

type CRMPageProps = {
  busca: string;
  onAbrirPaciente?: (pacienteId: number) => void;
};

type RelatorioCrmItem = {
  chave: string;
  pacienteId: number;
  nome: string;
  prontuario: string;
  telefone: string;
  detalhe: string;
  dataIso?: string;
  profissional?: string;
  tipoProcedimento?: string;
  statusOrigem?: string;
  motivo?: string;
  usuario?: string;
};

type CrmAba = "funil" | "agendados" | "finalizados" | "cancelados" | "avaliacoes" | "resgates" | "relatorios";

const AVALIACAO_PLACEHOLDER: CrmAvaliacaoItemApi = {
  pacienteId: -1,
  nome: "",
  prontuario: "",
  telefone: "",
  dataAvaliacao: "",
  profissional: "",
  status: "",
  procedimento: "",
  jaNoCrm: false,
  origemAvaliacao: false,
};

function escaparCsv(valor: unknown) {
  const texto = String(valor ?? "");
  if (!texto.includes("\"") && !texto.includes(";") && !texto.includes("\n")) return texto;
  return `"${texto.replace(/"/g, "\"\"")}"`;
}

function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: Array<Array<unknown>>) {
  const conteudo = [cabecalho, ...linhas]
    .map((linha) => linha.map(escaparCsv).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const ETAPAS_CRM = [
  "Novo lead",
  "Contato inicial",
  "Tentando contato",
  "Conversando",
  "Agendou avaliaÃ§Ã£o",
  "Em negociaÃ§Ã£o",
  "Convertido",
  "Perdido",
] as const;

const STATUS_RESGATE = [
  "Em tratativa",
  "Ligar novamente",
  "Desistente",
  "Convertido",
] as const;

const OBSERVACAO_RESGATE_AUTOMATICA = "Incluido automaticamente em Resgates a partir das avaliacoes sem orcamento aprovado.";

type ResgateSortKey =
  | "nome"
  | "prontuario"
  | "telefone"
  | "dataOrcamento"
  | "valorTotal"
  | "statusResgate"
  | "dataRetorno";

function paraDataInput(valor?: string) {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split("/");
    return `${ano}-${mes}-${dia}`;
  }
  return "";
}

function normalizarItemCrm(item: CrmPacienteItemApi): CrmPacienteItemApi {
  return {
    ...item,
    proximoContato: paraDataInput(item.proximoContato),
    ultimaInteracao: paraDataInput(item.ultimaInteracao),
  };
}

function normalizarTexto(valor: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function correspondeBusca(item: { nome?: string; prontuario?: string; telefone?: string; campanha?: string; etapaFunil?: string }, termo: string) {
  if (!termo) return true;
  const alvo = normalizarTexto([
    item.nome || "",
    item.prontuario || "",
    item.telefone || "",
    item.campanha || "",
    item.etapaFunil || "",
  ].join(" "));
  return alvo.includes(termo);
}

function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

function adicionarDias(dataIso: string, dias: number) {
  const data = new Date(`${dataIso}T12:00:00`);
  data.setDate(data.getDate() + dias);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function dataNascimentoDiaMes(valor?: string) {
  const texto = String(valor || "").trim();
  let match = texto.match(/^(\d{2})\/(\d{2})\/\d{4}$/);
  if (match) return { dia: Number(match[1]), mes: Number(match[2]) };
  match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return { dia: Number(match[3]), mes: Number(match[2]) };
  return null;
}

function extrairDataIso(valor?: string) {
  const texto = String(valor || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function numeroMoeda(valor?: string) {
  const texto = String(valor || "").trim();
  if (!texto) return 0;
  const limpo = texto
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : 0;
}

function inicialLetra(valor?: string) {
  const texto = String(valor || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const letra = texto.charAt(0).toUpperCase();
  return /[A-Z]/.test(letra) ? letra : "#";
}

function aplicarFiltroRelatorio(
  itens: RelatorioCrmItem[],
  filtros: {
    letra?: string;
    inicio?: string;
    fim?: string;
    profissional?: string;
    tipoProcedimento?: string;
    statusOrigem?: string;
  }
) {
  return itens.filter((item) => {
    if (filtros.letra && filtros.letra !== "TODAS" && inicialLetra(item.nome) !== filtros.letra) {
      return false;
    }
    if (filtros.inicio && (!item.dataIso || item.dataIso < filtros.inicio)) {
      return false;
    }
    if (filtros.fim && (!item.dataIso || item.dataIso > filtros.fim)) {
      return false;
    }
    if (filtros.profissional && normalizarTexto(item.profissional || "") !== normalizarTexto(filtros.profissional)) {
      return false;
    }
    if (filtros.tipoProcedimento && normalizarTexto(item.tipoProcedimento || "") !== normalizarTexto(filtros.tipoProcedimento)) {
      return false;
    }
    if (filtros.statusOrigem && normalizarTexto(item.statusOrigem || "") !== normalizarTexto(filtros.statusOrigem)) {
      return false;
    }
    return true;
  });
}

export function CRMPage({ busca, onAbrirPaciente }: CRMPageProps) {
  const [pipeline, setPipeline] = useState<CrmPacienteItemApi[]>([]);
  const [finalizados, setFinalizados] = useState<CrmPacienteItemApi[]>([]);
  const [cancelados, setCancelados] = useState<CrmPacienteItemApi[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<CrmAvaliacaoItemApi[]>([]);
  const [resgates, setResgates] = useState<CrmResgateItemApi[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<CrmAba>("funil");
  const [buscaLead, setBuscaLead] = useState("");
  const [leadSelecionadoId, setLeadSelecionadoId] = useState<number | null>(null);
  const [relatorioAberto, setRelatorioAberto] = useState<"sem-agendamento" | "aniversariantes" | "faltaram" | "desmarcaram">("sem-agendamento");
  const [relatorioSemAgendamento, setRelatorioSemAgendamento] = useState<RelatorioCrmItem[]>([]);
  const [relatorioAniversariantes, setRelatorioAniversariantes] = useState<RelatorioCrmItem[]>([]);
  const [relatorioFaltaram, setRelatorioFaltaram] = useState<RelatorioCrmItem[]>([]);
  const [relatorioDesmarcaram, setRelatorioDesmarcaram] = useState<RelatorioCrmItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [adicionandoAvaliacaoId, setAdicionandoAvaliacaoId] = useState<number | null>(null);
  const [criandoManual, setCriandoManual] = useState(false);
  const [periodoAvaliacaoInicio, setPeriodoAvaliacaoInicio] = useState("");
  const [periodoAvaliacaoFim, setPeriodoAvaliacaoFim] = useState("");
  const [filtroResgateData, setFiltroResgateData] = useState("");
  const [filtroResgateStatus, setFiltroResgateStatus] = useState("");
  const [filtroResgateBusca, setFiltroResgateBusca] = useState("");
  const [filtroResgateProcedimento, setFiltroResgateProcedimento] = useState("");
  const [rascunhosObservacaoResgate, setRascunhosObservacaoResgate] = useState<Record<number, string>>({});
  const [resgateSortKey, setResgateSortKey] = useState<ResgateSortKey>("nome");
  const [resgateSortDirection, setResgateSortDirection] = useState<"asc" | "desc">("asc");
  const [relatorioLetra, setRelatorioLetra] = useState("");
  const [relatorioDataInicio, setRelatorioDataInicio] = useState("");
  const [relatorioDataFim, setRelatorioDataFim] = useState("");
  const [relatorioProfissional, setRelatorioProfissional] = useState("");
  const [relatorioTipoProcedimento, setRelatorioTipoProcedimento] = useState("");
  const [relatorioStatusOrigem, setRelatorioStatusOrigem] = useState("");
  const [novoLeadManual, setNovoLeadManual] = useState<CrmNovoLeadPayloadApi>({ nome: "", telefone: "" });

  async function carregarPainel() {
    setCarregando(true);
    setErro(null);
    try {
      const hoje = hojeIso();
      const inicioHistorico = adicionarDias(hoje, -90);
      const fimFuturo = adicionarDias(hoje, 180);
      const resultados = await Promise.allSettled([
        listarCrmApi(),
        listarPacientesApi("", 5000),
        listarAgendamentosAgenda(inicioHistorico.split("-").reverse().join("/"), fimFuturo.split("-").reverse().join("/"), true),
      ]);

      const [crmResult, pacientesResult, agendamentosResult] = resultados;
      const resposta = crmResult.status === "fulfilled"
        ? crmResult.value
        : { pipeline: [], finalizados: [], cancelados: [], avaliacoes: [], resgates: [] };
      const pacientes = pacientesResult.status === "fulfilled" ? pacientesResult.value : [];
      const agendamentos = agendamentosResult.status === "fulfilled" ? agendamentosResult.value : [];

      setPipeline((resposta.pipeline || []).map(normalizarItemCrm));
      setFinalizados((resposta.finalizados || []).map(normalizarItemCrm));
      setCancelados((resposta.cancelados || []).map(normalizarItemCrm));
      setAvaliacoes(resposta.avaliacoes || []);
      setResgates(resposta.resgates || []);

      const finalizadosIds = new Set((resposta.finalizados || []).map((item) => item.pacienteId));
      const canceladosIds = new Set((resposta.cancelados || []).map((item) => item.pacienteId));
      const futurosAtivos = agendamentos.filter((item) => {
        const status = normalizarTexto(item.status || "");
        if (status === "desmarcado" || status === "cancelado" || status === "faltou") return false;
        const dataIso = (item.data || "").split("/").reverse().join("-");
        return dataIso >= hoje;
      });
      const idsComAgendaFutura = new Set(futurosAtivos.map((item) => item.pacienteId).filter((id): id is number => Boolean(id)));

      setRelatorioSemAgendamento(
        pacientes
          .filter((item) => !finalizadosIds.has(item.id) && !canceladosIds.has(item.id) && !idsComAgendaFutura.has(item.id))
          .sort((a, b) => a.nome.localeCompare(b.nome))
          .map((item) => ({
            chave: `sem-agenda-${item.id}`,
            pacienteId: item.id,
            nome: item.nome,
            prontuario: item.prontuario || "",
            telefone: item.telefone || "",
            detalhe: "Sem agendamento futuro e nÃ£o finalizado",
          }))
      );

      const mesAtual = Number(hoje.split("-")[1]);
      setRelatorioAniversariantes(
        pacientes
          .map((item) => ({ item, nascimento: dataNascimentoDiaMes(item.dataNascimento) }))
          .filter((item) => item.nascimento?.mes === mesAtual)
          .sort((a, b) => (a.nascimento?.dia || 0) - (b.nascimento?.dia || 0))
          .map(({ item, nascimento }) => ({
            chave: `aniversario-${item.id}`,
            pacienteId: item.id,
            nome: item.nome,
            prontuario: item.prontuario || "",
            telefone: item.telefone || "",
            detalhe: nascimento ? `AniversÃ¡rio em ${String(nascimento.dia).padStart(2, "0")}/${String(nascimento.mes).padStart(2, "0")}` : "Sem data vÃ¡lida",
          }))
      );

      const mapearAgendamentoRelatorio = (prefixo: string, item: AgendaApiAgendamento): RelatorioCrmItem => ({
        chave: `${prefixo}-${item.id}`,
        pacienteId: item.pacienteId || 0,
        nome: item.paciente || "Paciente",
        prontuario: item.prontuario || "",
        telefone: item.telefone || "",
        detalhe: `${item.data || "-"} Â· ${item.inicio || "-"} Â· ${item.profissional || "-"} Â· ${(item.procedimentos || []).join(", ") || "-"}`,
      });

      setRelatorioFaltaram(
        agendamentos
          .filter((item) => normalizarTexto(item.status || "") === "faltou")
          .sort((a, b) => `${b.data} ${b.inicio}`.localeCompare(`${a.data} ${a.inicio}`))
          .map((item) => ({
            ...mapearAgendamentoRelatorio("faltou", item),
            dataIso: extrairDataIso(item.data),
            profissional: item.profissional || "",
            tipoProcedimento: item.tipoAtendimento || item.procedimentos?.[0] || "",
            statusOrigem: item.statusOrigem || "",
            motivo: item.statusMotivo || "",
            usuario: item.statusUsuario || "",
          }))
      );

      setRelatorioDesmarcaram(
        agendamentos
          .filter((item) => normalizarTexto(item.status || "") === "desmarcado")
          .sort((a, b) => `${b.data} ${b.inicio}`.localeCompare(`${a.data} ${a.inicio}`))
          .map((item) => ({
            ...mapearAgendamentoRelatorio("desmarcou", item),
            dataIso: extrairDataIso(item.data),
            profissional: item.profissional || "",
            tipoProcedimento: item.tipoAtendimento || item.procedimentos?.[0] || "",
            statusOrigem: item.statusOrigem || "",
            motivo: item.statusMotivo || "",
            usuario: item.statusUsuario || "",
          }))
      );

      const fontesComFalha: string[] = [];
      if (crmResult.status === "rejected") fontesComFalha.push("painel CRM");
      if (pacientesResult.status === "rejected") fontesComFalha.push("lista de pacientes");
      if (agendamentosResult.status === "rejected") fontesComFalha.push("agendamentos");
      if (fontesComFalha.length > 0) {
        setErro(`Alguns dados do CRM nÃ£o carregaram: ${fontesComFalha.join(", ")}.`);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar o CRM.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregarPainel();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const termoBusca = "";
  const nomeLeadManual = novoLeadManual.nome.trim();
  const telefoneLeadManual = novoLeadManual.telefone.trim();
  const previewLeadManualVisivel = Boolean(nomeLeadManual || telefoneLeadManual);
  const finalizadosIds = useMemo(() => new Set(finalizados.map((item) => item.id)), [finalizados]);
  const canceladosIds = useMemo(() => new Set(cancelados.map((item) => item.id)), [cancelados]);

  const pipelineFiltrado = useMemo(
    () =>
      [...pipeline]
        .filter((item) => !item.origemFinalizado && !item.origemCancelado && !finalizadosIds.has(item.id) && !canceladosIds.has(item.id))
        .sort((a, b) => b.id - a.id),
    [canceladosIds, finalizadosIds, pipeline]
  );
  const termoBuscaLead = normalizarTexto(buscaLead);
  const leadsFunilFiltrados = useMemo(
    () => pipelineFiltrado.filter((item) => correspondeBusca(item, termoBuscaLead)),
    [pipelineFiltrado, termoBuscaLead]
  );
  const agendadosFiltrados = useMemo(
    () =>
      pipelineFiltrado
        .filter((item) => normalizarTexto(item.etapaFunil || "") === "agendou avaliacao")
        .sort((a, b) => `${a.proximoContato || ""} ${a.nome}`.localeCompare(`${b.proximoContato || ""} ${b.nome}`)),
    [pipelineFiltrado]
  );
  const leadSelecionado = useMemo(
    () => leadsFunilFiltrados.find((item) => item.id === leadSelecionadoId) || leadsFunilFiltrados[0] || null,
    [leadSelecionadoId, leadsFunilFiltrados]
  );
  const finalizadosFiltrados = useMemo(
    () => finalizados,
    [finalizados]
  );
  const canceladosFiltrados = useMemo(
    () => cancelados,
    [cancelados]
  );
  const avaliacoesFiltradas = useMemo(
    () => {
      if (!periodoAvaliacaoInicio || !periodoAvaliacaoFim) return [AVALIACAO_PLACEHOLDER];
      return avaliacoes.filter((item) => {
        const dataIso = extrairDataIso(item.dataAvaliacao);
        if (!dataIso || dataIso < periodoAvaliacaoInicio || dataIso > periodoAvaliacaoFim) return false;
        return true;
      });
    },
    [avaliacoes, periodoAvaliacaoFim, periodoAvaliacaoInicio]
  );
  const resgatesFiltrados = useMemo(
    () => resgates
      .map((item) => {
        const historicoVisivel = (item.historico || []).filter(
          (registro) => normalizarTexto(registro.observacao || "") !== normalizarTexto(OBSERVACAO_RESGATE_AUTOMATICA)
        );
        const ultimaObservacaoVisivel = normalizarTexto(item.observacaoContato || "") === normalizarTexto(OBSERVACAO_RESGATE_AUTOMATICA)
          ? ""
          : item.observacaoContato || "";
        return {
          ...item,
          historico: historicoVisivel,
          observacaoContato: ultimaObservacaoVisivel,
        };
      })
      .filter((item) => {
        const termo = normalizarTexto(busca || "");
        if (termo && !correspondeBusca({
          nome: item.nome,
          prontuario: item.prontuario,
          telefone: item.telefone,
          etapaFunil: item.statusResgate,
          campanha: (item.procedimentos || []).join(" "),
        }, termo)) {
          return false;
        }
        if (filtroResgateBusca) {
          const textoBuscaResgate = normalizarTexto([
            item.nome || "",
            item.telefone || "",
            item.prontuario || "",
          ].join(" "));
          if (!textoBuscaResgate.includes(normalizarTexto(filtroResgateBusca))) {
            return false;
          }
        }
        const dataRetorno = paraDataInput(item.dataRetorno);
        if (filtroResgateData && dataRetorno !== filtroResgateData) {
          return false;
        }
        if (filtroResgateStatus && normalizarTexto(item.statusResgate || "") !== normalizarTexto(filtroResgateStatus)) {
          return false;
        }
        if (filtroResgateProcedimento) {
          const procedimentosTexto = normalizarTexto((item.procedimentos || []).join(" "));
          if (!procedimentosTexto.includes(normalizarTexto(filtroResgateProcedimento))) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        let comparacao = 0;
        switch (resgateSortKey) {
          case "prontuario":
            comparacao = String(a.prontuario || "").localeCompare(String(b.prontuario || ""));
            break;
          case "telefone":
            comparacao = String(a.telefone || "").localeCompare(String(b.telefone || ""));
            break;
          case "dataOrcamento":
            comparacao = extrairDataIso(a.dataOrcamento).localeCompare(extrairDataIso(b.dataOrcamento));
            break;
          case "valorTotal":
            comparacao = numeroMoeda(a.valorTotal) - numeroMoeda(b.valorTotal);
            break;
          case "statusResgate":
            comparacao = String(a.statusResgate || "").localeCompare(String(b.statusResgate || ""));
            break;
          case "dataRetorno":
            comparacao = paraDataInput(a.dataRetorno).localeCompare(paraDataInput(b.dataRetorno));
            break;
          case "nome":
          default:
            comparacao = String(a.nome || "").localeCompare(String(b.nome || ""));
            break;
        }
        if (comparacao === 0) {
          comparacao = String(a.nome || "").localeCompare(String(b.nome || ""));
        }
        return resgateSortDirection === "asc" ? comparacao : -comparacao;
      }),
    [busca, filtroResgateBusca, filtroResgateData, filtroResgateProcedimento, filtroResgateStatus, resgates, resgateSortDirection, resgateSortKey]
  );
  const semAgendamentoFiltrados = useMemo(
    () => {
      if (!relatorioLetra) return [];
      return aplicarFiltroRelatorio(relatorioSemAgendamento, { letra: relatorioLetra });
    },
    [relatorioLetra, relatorioSemAgendamento]
  );
  const aniversariantesFiltrados = useMemo(
    () => relatorioAniversariantes,
    [relatorioAniversariantes]
  );
  const faltaramFiltrados = useMemo(
    () =>
      aplicarFiltroRelatorio(relatorioFaltaram, {
        inicio: relatorioDataInicio,
        fim: relatorioDataFim,
        profissional: relatorioProfissional,
        tipoProcedimento: relatorioTipoProcedimento,
      }),
    [relatorioDataFim, relatorioDataInicio, relatorioFaltaram, relatorioProfissional, relatorioTipoProcedimento]
  );
  const desmarcaramFiltrados = useMemo(
    () =>
      aplicarFiltroRelatorio(relatorioDesmarcaram, {
        inicio: relatorioDataInicio,
        fim: relatorioDataFim,
        profissional: relatorioProfissional,
        tipoProcedimento: relatorioTipoProcedimento,
        statusOrigem: relatorioStatusOrigem,
      }),
    [relatorioDataFim, relatorioDataInicio, relatorioDesmarcaram, relatorioProfissional, relatorioStatusOrigem, relatorioTipoProcedimento]
  );
  const letrasRelatorio = useMemo(() => {
    const base = relatorioSemAgendamento;
    return Array.from(new Set(base.map((item) => inicialLetra(item.nome)))).sort();
  }, [relatorioSemAgendamento]);
  const profissionaisRelatorio = useMemo(
    () =>
      Array.from(
        new Set([...relatorioFaltaram, ...relatorioDesmarcaram].map((item) => item.profissional || "").filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [relatorioDesmarcaram, relatorioFaltaram]
  );
  const tiposRelatorio = useMemo(
    () =>
      Array.from(
        new Set([...relatorioFaltaram, ...relatorioDesmarcaram].map((item) => item.tipoProcedimento || "").filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [relatorioDesmarcaram, relatorioFaltaram]
  );
  const origensDesmarcacao = useMemo(
    () => Array.from(new Set(relatorioDesmarcaram.map((item) => item.statusOrigem || "").filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [relatorioDesmarcaram]
  );

  useEffect(() => {
    if (!leadsFunilFiltrados.length) {
      if (leadSelecionadoId !== null) setLeadSelecionadoId(null);
      return;
    }
    if (!leadSelecionado || leadSelecionado.id !== leadSelecionadoId) {
      setLeadSelecionadoId(leadsFunilFiltrados[0].id);
    }
  }, [leadSelecionado, leadSelecionadoId, leadsFunilFiltrados]);

  function atualizarItemLocal(crmId: number, parcial: Partial<CrmPacienteItemApi>) {
    const aplicar = (lista: CrmPacienteItemApi[]) =>
      lista.map((item) => (item.id === crmId ? { ...item, ...parcial } : item));
    setPipeline((atual) => aplicar(atual));
    setFinalizados((atual) => aplicar(atual));
    setCancelados((atual) => aplicar(atual));
  }

  function atualizarResgateLocal(contratoId: number, parcial: Partial<CrmResgateItemApi>) {
    setResgates((atual) => atual.map((item) => (item.contratoId === contratoId ? { ...item, ...parcial } : item)));
  }

  function atualizarRascunhoObservacaoResgate(contratoId: number, valor: string) {
    setRascunhosObservacaoResgate((atual) => ({ ...atual, [contratoId]: valor }));
  }

  function alternarOrdenacaoResgate(chave: ResgateSortKey) {
    if (resgateSortKey === chave) {
      setResgateSortDirection((atual) => (atual === "asc" ? "desc" : "asc"));
      return;
    }
    setResgateSortKey(chave);
    setResgateSortDirection("asc");
  }

  function indicadorOrdenacaoResgate(chave: ResgateSortKey) {
    if (resgateSortKey !== chave) return "";
    return resgateSortDirection === "asc" ? " â†‘" : " â†“";
  }

  async function salvarItem(item: CrmPacienteItemApi) {
    setSalvandoId(item.id);
    setErro(null);
    try {
      const atualizado = await atualizarCrmApi(item.id, {
        etapa_funil: item.etapaFunil || "Novo lead",
        canal: item.canal || "Facebook",
        campanha: item.campanha || "",
        conjunto_anuncio: item.conjuntoAnuncio || "",
        anuncio: item.anuncio || "",
        responsavel: item.responsavel || "",
        proximo_contato: item.proximoContato || "",
        observacao: item.observacao || "",
        ultima_interacao: item.ultimaInteracao || "",
      });
      atualizarItemLocal(item.id, normalizarItemCrm(atualizado));
      setFeedback(`CRM salvo para ${atualizado.nome}.`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar o CRM.");
    } finally {
      setSalvandoId(null);
    }
  }

  async function salvarResgate(item: CrmResgateItemApi) {
    const observacaoNova = String(rascunhosObservacaoResgate[item.contratoId] || "").trim();
    if (!observacaoNova) {
      setErro("A observaÃ§Ã£o do contato Ã© obrigatÃ³ria.");
      return;
    }
    if (!["desistente", "convertido"].includes(normalizarTexto(item.statusResgate || "")) && !paraDataInput(item.dataRetorno)) {
      setErro("Informe a nova data de retorno para continuar o acompanhamento.");
      return;
    }
    setSalvandoId(item.contratoId);
    setErro(null);
    try {
      const atualizado = await atualizarCrmResgateApi(item.contratoId, {
        status: item.statusResgate || "",
        observacao: observacaoNova,
        proximo_contato: paraDataInput(item.dataRetorno) || "",
      });
      atualizarResgateLocal(item.contratoId, atualizado);
      setRascunhosObservacaoResgate((atual) => ({ ...atual, [item.contratoId]: "" }));
      setFeedback(`Resgate salvo para ${atualizado.nome}.`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar o resgate.");
    } finally {
      setSalvandoId(null);
    }
  }

  async function adicionarAvaliacaoAoCrm(pacienteId: number) {
    setAdicionandoAvaliacaoId(pacienteId);
    setErro(null);
    try {
      await adicionarPacienteAvaliacaoCrmApi(pacienteId);
      setFeedback("Paciente de avaliaÃ§Ã£o enviado para o CRM.");
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao levar avaliaÃ§Ã£o para o CRM.");
    } finally {
      setAdicionandoAvaliacaoId(null);
    }
  }

  async function removerAvaliacaoDoCrm(pacienteId: number) {
    setAdicionandoAvaliacaoId(pacienteId);
    setErro(null);
    try {
      await removerPacienteAvaliacaoCrmApi(pacienteId);
      setFeedback("Paciente de avaliaÃ§Ã£o removido do CRM.");
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao desfazer avaliaÃ§Ã£o no CRM.");
    } finally {
      setAdicionandoAvaliacaoId(null);
    }
  }

  async function removerCanceladoDoCrm(pacienteId: number) {
    setAdicionandoAvaliacaoId(pacienteId);
    setErro(null);
    try {
      await removerPacienteCanceladoCrmApi(pacienteId);
      setFeedback("Paciente removido da lista de cancelados.");
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao remover paciente cancelado do CRM.");
    } finally {
      setAdicionandoAvaliacaoId(null);
    }
  }

  async function adicionarLeadManual() {
    const nome = novoLeadManual.nome.trim();
    const telefone = novoLeadManual.telefone.trim();
    if (!nome) {
      setErro("Informe o nome do paciente para criar o lead manual.");
      return;
    }
    setCriandoManual(true);
    setErro(null);
    try {
      const novoItem = normalizarItemCrm(await adicionarPacienteManualCrmApi({ nome, telefone }));
      setPipeline((atual) => [novoItem, ...atual.filter((item) => item.id !== novoItem.id)]);
      if (novoItem.origemFinalizado) {
        setFinalizados((atual) => [novoItem, ...atual.filter((item) => item.id !== novoItem.id)]);
      }
      setNovoLeadManual({ nome: "", telefone: "" });
      setBuscaLead(novoItem.nome);
      setLeadSelecionadoId(novoItem.id);
      setFeedback(`CRM criado para ${novoItem.nome}.`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao criar lead manual no CRM.");
    } finally {
      setCriandoManual(false);
    }
  }

  function exportarRelatorio(nomeBase: string, linhas: RelatorioCrmItem[]) {
    baixarCsv(
      `${nomeBase}.csv`,
      ["Paciente", "Prontuario", "Telefone", "Data", "Profissional", "Tipo", "Origem", "Motivo", "Usuario", "Detalhe"],
      linhas.map((item) => [
        item.nome,
        item.prontuario,
        item.telefone,
        item.dataIso || "",
        item.profissional || "",
        item.tipoProcedimento || "",
        item.statusOrigem || "",
        item.motivo || "",
        item.usuario || "",
        item.detalhe,
      ])
    );
  }

  function exportarRelatorioAtual() {
    if (relatorioAberto === "sem-agendamento" && relatorioLetra) {
      const baixarAtual = window.confirm(`Clique em OK para baixar somente a letra ${relatorioLetra}.\n\nClique em Cancelar para baixar o relatÃ³rio inteiro.`);
      exportarRelatorio(
        baixarAtual ? `${relatorioAtual.nomeExportacao}-${relatorioLetra.toLowerCase()}` : relatorioAtual.nomeExportacao,
        baixarAtual ? relatorioAtual.itens : relatorioSemAgendamento
      );
      return;
    }
    exportarRelatorio(relatorioAtual.nomeExportacao, relatorioAtual.itens);
  }

  function exportarCrmPacientes(nomeBase: string, linhas: CrmPacienteItemApi[]) {
    baixarCsv(
      `${nomeBase}.csv`,
      ["Paciente", "Prontuario", "Telefone", "Etapa", "Canal", "Campanha", "Responsavel", "Proximo contato", "Observacao"],
      linhas.map((item) => [
        item.nome,
        item.prontuario,
        item.telefone,
        item.etapaFunil,
        item.canal,
        item.campanha,
        item.responsavel,
        item.proximoContato,
        item.observacao,
      ])
    );
  }

  function exportarAvaliacoes() {
    const linhasValidas = avaliacoesFiltradas.filter((item) => item.pacienteId > 0);
    baixarCsv(
      "crm-avaliacoes.csv",
      ["Paciente", "Prontuario", "Telefone", "Data", "Profissional", "Procedimento", "Status", "Orcamento", "Valor total", "Procedimentos do orcamento", "Observacao do orcamento"],
      linhasValidas.flatMap((item) => {
        const orcamentos = item.orcamentos?.length ? item.orcamentos : [null];
        return orcamentos.map((orcamento, indice) => [
          item.nome,
          item.prontuario,
          item.telefone,
          item.dataAvaliacao,
          item.profissional,
          item.procedimento,
          item.status,
          orcamento ? `#${orcamento.contratoId}` : (indice === 0 ? "Sem orÃ§amento" : ""),
          orcamento?.valorTotal || "",
          (orcamento?.procedimentos || []).join(" | "),
          orcamento?.observacao || "",
        ]);
      })
    );
  }

  function alternarRelatorio(chave: "sem-agendamento" | "aniversariantes" | "faltaram" | "desmarcaram") {
    setRelatorioAberto(chave);
    if (chave === "sem-agendamento") {
      setRelatorioLetra("");
    }
    if (chave === "sem-agendamento" || chave === "aniversariantes") {
      setRelatorioDataInicio("");
      setRelatorioDataFim("");
      setRelatorioProfissional("");
      setRelatorioTipoProcedimento("");
      setRelatorioStatusOrigem("");
    }
  }

  const relatorioAtual = useMemo(() => {
    switch (relatorioAberto) {
      case "aniversariantes":
        return {
          titulo: "Aniversariantes do mÃªs",
          nomeExportacao: "crm-aniversariantes",
          itens: aniversariantesFiltrados,
          vazio: "Nenhum aniversariante encontrado.",
          icone: <CalendarDays size={18} />,
        };
      case "faltaram":
        return {
          titulo: "Pacientes que faltaram",
          nomeExportacao: "crm-faltaram",
          itens: faltaramFiltrados,
          vazio: "Nenhuma falta registrada.",
          icone: <CalendarDays size={18} />,
        };
      case "desmarcaram":
        return {
          titulo: "Pacientes que desmarcaram",
          nomeExportacao: "crm-desmarcaram",
          itens: desmarcaramFiltrados,
          vazio: "Nenhuma desmarcaÃ§Ã£o registrada.",
          icone: <CalendarDays size={18} />,
        };
      default:
        return {
          titulo: "NÃ£o finalizados sem agendamento",
          nomeExportacao: "crm-nao-finalizados-sem-agendamento",
          itens: semAgendamentoFiltrados,
          vazio: relatorioLetra ? "Nenhum paciente nesta condicao." : "Selecione uma letra para carregar o relatorio.",
          icone: <Search size={18} />,
        };
    }
  }, [aniversariantesFiltrados, desmarcaramFiltrados, faltaramFiltrados, relatorioAberto, relatorioLetra, semAgendamentoFiltrados]);

  return (
    <section className="module-shell crm-shell">
      <section className="module-kpis">
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Funil</span>
          <strong>{pipelineFiltrado.length}</strong>
          <span>pacientes trabalhando no CRM</span>
        </article>
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Finalizados</span>
          <strong>{finalizados.length}</strong>
          <span>vindos do botão do paciente</span>
        </article>
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Cancelados</span>
          <strong>{cancelados.length}</strong>
          <span>pacientes removidos do fluxo</span>
        </article>
        <article className="panel module-kpi-card">
          <span className="panel-kicker">AvaliaÃ§Ãµes</span>
          <strong>{avaliacoes.length}</strong>
          <span>detectadas pelos agendamentos</span>
        </article>
      </section>

      {erro ? <p className="users-password-feedback error">{erro}</p> : null}
      {feedback ? <p className="users-password-feedback success">{feedback}</p> : null}

      <section className="panel crm-tabs-panel">
        <div className="tab-shell tab-shell-primary crm-tabs-shell">
          <button type="button" className={`segmented-tab segmented-tab-primary ${abaAtiva === "funil" ? "active" : ""}`} onClick={() => setAbaAtiva("funil")}>Funil</button>
          <button type="button" className={`segmented-tab segmented-tab-primary ${abaAtiva === "agendados" ? "active" : ""}`} onClick={() => setAbaAtiva("agendados")}>Agendados</button>
          <button type="button" className={`segmented-tab segmented-tab-primary ${abaAtiva === "finalizados" ? "active" : ""}`} onClick={() => setAbaAtiva("finalizados")}>Finalizados</button>
          <button type="button" className={`segmented-tab segmented-tab-primary ${abaAtiva === "cancelados" ? "active" : ""}`} onClick={() => setAbaAtiva("cancelados")}>Cancelados</button>
          <button type="button" className={`segmented-tab segmented-tab-primary ${abaAtiva === "avaliacoes" ? "active" : ""}`} onClick={() => setAbaAtiva("avaliacoes")}>AvaliaÃ§Ãµes</button>
          <button type="button" className={`segmented-tab segmented-tab-primary ${abaAtiva === "resgates" ? "active" : ""}`} onClick={() => setAbaAtiva("resgates")}>Resgates</button>
          <button type="button" className={`segmented-tab segmented-tab-primary ${abaAtiva === "relatorios" ? "active" : ""}`} onClick={() => setAbaAtiva("relatorios")}>RelatÃ³rios</button>
        </div>
        {abaAtiva === "relatorios" ? (
          <div className="tab-shell crm-report-tabs-shell">
            <button type="button" className={`segmented-tab ${relatorioAberto === "sem-agendamento" ? "active" : ""}`} onClick={() => alternarRelatorio("sem-agendamento")}>Sem agendamento</button>
            <button type="button" className={`segmented-tab ${relatorioAberto === "aniversariantes" ? "active" : ""}`} onClick={() => alternarRelatorio("aniversariantes")}>Aniversariantes</button>
            <button type="button" className={`segmented-tab ${relatorioAberto === "faltaram" ? "active" : ""}`} onClick={() => alternarRelatorio("faltaram")}>Faltaram</button>
            <button type="button" className={`segmented-tab ${relatorioAberto === "desmarcaram" ? "active" : ""}`} onClick={() => alternarRelatorio("desmarcaram")}>Desmarcaram</button>
          </div>
        ) : null}
      </section>

      <section className={abaAtiva === "agendados" || abaAtiva === "finalizados" || abaAtiva === "cancelados" || abaAtiva === "avaliacoes" ? "crm-grid" : "crm-grid crm-section-hidden"}>
        <article className={abaAtiva === "agendados" ? "panel crm-panel" : "panel crm-panel crm-section-hidden"}>
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Leads</span>
              <h2>Leads agendados para avaliaÃ§Ã£o</h2>
            </div>
            <div className="crm-inline-actions">
              <Search size={18} />
            </div>
          </div>
          <div className="crm-list">
            {carregando ? <div className="module-subitem"><strong>Carregando...</strong></div> : null}
            {!carregando && agendadosFiltrados.map((item) => (
              <article key={`agendado-${item.id}`} className="crm-list-item">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.prontuario || "Sem prontuÃ¡rio"} Â· {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.proximoContato ? `AvaliaÃ§Ã£o em ${item.proximoContato}` : "Agendado no CRM"}</span>
                  <div className="crm-inline-actions">
                    {item.pacienteId ? <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>Abrir paciente</button> : null}
                    <button type="button" className="ghost-action" onClick={() => { setAbaAtiva("funil"); setLeadSelecionadoId(item.id); setBuscaLead(item.nome || ""); }}>
                      Editar CRM
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!carregando && !agendadosFiltrados.length ? <div className="module-subitem"><strong>Nenhum lead com avaliaÃ§Ã£o agendada.</strong></div> : null}
          </div>
        </article>

        <article className={abaAtiva === "finalizados" ? "panel crm-panel" : "panel crm-panel crm-section-hidden"}>
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Entrada manual</span>
              <h2>Pacientes finalizados</h2>
            </div>
            <div className="crm-inline-actions">
              <button type="button" className="ghost-action compact" onClick={() => exportarCrmPacientes("crm-finalizados", finalizadosFiltrados)}>
                <Download size={15} />
                Baixar
              </button>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="crm-list">
            {carregando ? <div className="module-subitem"><strong>Carregando...</strong></div> : null}
            {!carregando && finalizadosFiltrados.map((item) => (
              <article key={`finalizado-${item.id}`} className="crm-list-item">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.prontuario || "Sem prontuÃ¡rio"} Â· {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.finalizadoEm ? `Finalizado em ${item.finalizadoEm}` : "No CRM"}</span>
                  <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>Abrir paciente</button>
                </div>
              </article>
            ))}
            {!carregando && !finalizadosFiltrados.length ? <div className="module-subitem"><strong>Nenhum paciente finalizado no CRM.</strong></div> : null}
          </div>
        </article>

        <article className={abaAtiva === "cancelados" ? "panel crm-panel" : "panel crm-panel crm-section-hidden"}>
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Entrada manual</span>
              <h2>Pacientes cancelados</h2>
            </div>
            <div className="crm-inline-actions">
              <button type="button" className="ghost-action compact" onClick={() => exportarCrmPacientes("crm-cancelados", canceladosFiltrados)}>
                <Download size={15} />
                Baixar
              </button>
              <X size={18} />
            </div>
          </div>
          <div className="crm-list">
            {carregando ? <div className="module-subitem"><strong>Carregando...</strong></div> : null}
            {!carregando && canceladosFiltrados.map((item) => (
              <article key={`cancelado-${item.id}`} className="crm-list-item">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.prontuario || "Sem prontuÃ¡rio"} Â· {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.canceladoEm ? `Cancelado em ${item.canceladoEm}` : "No CRM"}</span>
                  <div className="crm-inline-actions">
                    <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>Abrir paciente</button>
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => void removerCanceladoDoCrm(item.pacienteId)}
                      disabled={adicionandoAvaliacaoId === item.pacienteId}
                    >
                      {adicionandoAvaliacaoId === item.pacienteId ? "Removendo..." : "Reativar"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!carregando && !canceladosFiltrados.length ? <div className="module-subitem"><strong>Nenhum paciente cancelado no CRM.</strong></div> : null}
          </div>
        </article>

        <article className={abaAtiva === "avaliacoes" ? "panel crm-panel" : "panel crm-panel crm-section-hidden"}>
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Entrada automÃ¡tica</span>
              <h2>Pacientes que fizeram avaliaÃ§Ã£o</h2>
            </div>
            <div className="crm-inline-actions">
              <button
                type="button"
                className="ghost-action compact"
                onClick={exportarAvaliacoes}
                disabled={!periodoAvaliacaoInicio || !periodoAvaliacaoFim || !avaliacoesFiltradas.some((item) => item.pacienteId > 0)}
              >
                <Download size={15} />
                Baixar
              </button>
              <CalendarDays size={18} />
            </div>
          </div>
          <div className="crm-filter-row">
            <label>
              <span>Data inicial</span>
              <input type="date" value={periodoAvaliacaoInicio} onChange={(event) => setPeriodoAvaliacaoInicio(event.target.value)} />
            </label>
            <label>
              <span>Data final</span>
              <input type="date" value={periodoAvaliacaoFim} onChange={(event) => setPeriodoAvaliacaoFim(event.target.value)} />
            </label>
          </div>
          {!periodoAvaliacaoInicio || !periodoAvaliacaoFim ? (
            <div className="module-subitem"><strong>Selecione a data inicial e final para carregar o relatÃ³rio.</strong></div>
          ) : null}
          <div className="crm-list">
            {carregando ? <div className="module-subitem"><strong>Carregando...</strong></div> : null}
            {!carregando && avaliacoesFiltradas.map((item) => (
              item.pacienteId < 0 ? null : <article key={`avaliacao-${item.pacienteId}`} className="crm-list-item">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.dataAvaliacao || "-"} Â· {item.procedimento || "AvaliaÃ§Ã£o"} Â· {item.profissional || "-"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.jaNoCrm ? "JÃ¡ estÃ¡ no CRM" : item.telefone || "Sem telefone"}</span>
                  <div className="crm-inline-actions">
                    <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>Abrir paciente</button>
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => void (item.origemAvaliacao ? removerAvaliacaoDoCrm(item.pacienteId) : adicionarAvaliacaoAoCrm(item.pacienteId))}
                      disabled={adicionandoAvaliacaoId === item.pacienteId || (!item.origemAvaliacao && item.jaNoCrm)}
                    >
                      <UserRoundPlus size={15} />
                      {adicionandoAvaliacaoId === item.pacienteId
                        ? item.origemAvaliacao ? "Desfazendo..." : "Enviando..."
                        : item.origemAvaliacao
                          ? "Desfazer CRM"
                          : item.jaNoCrm
                            ? "No CRM"
                            : "Levar ao CRM"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!carregando && !avaliacoesFiltradas.length ? <div className="module-subitem"><strong>Nenhuma avaliaÃ§Ã£o encontrada.</strong></div> : null}
          </div>
        </article>
      </section>

      <section className={abaAtiva === "resgates" ? "panel crm-panel" : "panel crm-panel crm-section-hidden"}>
        <div className="section-title-row">
          <div>
            <span className="panel-kicker">Resgates</span>
            <h2>OrÃ§amentos para retorno</h2>
          </div>
          <div className="crm-inline-actions">
            <span>{resgatesFiltrados.length} linha(s)</span>
          </div>
        </div>
        <div className="crm-filter-row crm-filter-row-report">
          <label>
            <span>Paciente, telefone ou CDG</span>
            <input
              type="text"
              value={filtroResgateBusca}
              placeholder="Digite nome, telefone ou prontuÃ¡rio"
              onChange={(event) => setFiltroResgateBusca(event.target.value)}
            />
          </label>
          <label>
            <span>Data de retorno</span>
            <input type="date" value={filtroResgateData} onChange={(event) => setFiltroResgateData(event.target.value)} />
            <div className="crm-inline-actions">
              <button type="button" className="ghost-action compact" onClick={() => setFiltroResgateData("")}>
                Todos
              </button>
              <button type="button" className="ghost-action compact" onClick={() => setFiltroResgateData(hojeIso())}>
                Hoje
              </button>
            </div>
          </label>
          <label>
            <span>Status</span>
            <select value={filtroResgateStatus} onChange={(event) => setFiltroResgateStatus(event.target.value)}>
              <option value="">Todos</option>
              {STATUS_RESGATE.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Procedimento</span>
            <input
              type="text"
              value={filtroResgateProcedimento}
              placeholder="Ex.: protocolo"
              onChange={(event) => setFiltroResgateProcedimento(event.target.value)}
            />
          </label>
          <label>
            <span>Ordenar por</span>
            <select value={resgateSortKey} onChange={(event) => setResgateSortKey(event.target.value as ResgateSortKey)}>
              <option value="nome">Paciente</option>
              <option value="prontuario">ProntuÃ¡rio</option>
              <option value="telefone">Telefone</option>
              <option value="dataOrcamento">Data do orÃ§amento</option>
              <option value="valorTotal">Valor total</option>
              <option value="statusResgate">Status</option>
              <option value="dataRetorno">Retorno</option>
            </select>
          </label>
          <label>
            <span>DireÃ§Ã£o</span>
            <select value={resgateSortDirection} onChange={(event) => setResgateSortDirection(event.target.value as "asc" | "desc")}>
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </select>
          </label>
        </div>
        <div className="finance-receivables-grid-shell crm-rescue-grid-shell">
          <table className="finance-receivables-grid crm-rescue-grid">
            <colgroup>
              <col style={{ width: "220px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "320px" }} />
              <col style={{ width: "220px" }} />
              <col style={{ width: "220px" }} />
              <col style={{ width: "240px" }} />
              <col style={{ width: "170px" }} />
              <col style={{ width: "260px" }} />
              <col style={{ width: "340px" }} />
              <col style={{ width: "240px" }} />
              <col style={{ width: "120px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>ProntuÃ¡rio</th>
                <th>Telefone</th>
                <th>Data orÃ§amento</th>
                <th>Valor total</th>
                <th>Procedimentos</th>
                <th>Obs. avaliaÃ§Ã£o</th>
                <th>Obs. orÃ§amento</th>
                <th>Status</th>
                <th>Retorno</th>
                <th>Nova observaÃƒÂ§ÃƒÂ£o</th>
                <th>HistÃƒÂ³rico de contatos</th>
                <th>Ãšltimo registro</th>
                <th>AÃ§Ãµes</th>
              </tr>
            </thead>
            <tbody>
              {resgatesFiltrados.map((item) => (
                <tr key={`resgate-${item.contratoId}`}>
                  <td>{item.nome}</td>
                  <td>{item.prontuario || "-"}</td>
                  <td>{item.telefone || "-"}</td>
                  <td>{item.dataOrcamento || "-"}</td>
                  <td>{item.valorTotal || "-"}</td>
                  <td>{(item.procedimentos || []).join(" | ") || "-"}</td>
                  <td className="crm-rescue-text-cell">{item.observacaoAvaliacao || "-"}</td>
                  <td className="crm-rescue-text-cell">{item.observacaoOrcamento || "-"}</td>
                  <td className="crm-rescue-status-cell">
                    <span className={`crm-rescue-status-badge crm-rescue-status-${normalizarTexto(item.statusResgate || "").replace(/\s+/g, "-") || "vazio"}`}>
                      {item.statusResgate || "Sem status"}
                    </span>
                    <select
                      value={item.statusResgate || ""}
                      onChange={(event) => atualizarResgateLocal(item.contratoId, { statusResgate: event.target.value })}
                    >
                      {STATUS_RESGATE.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      value={paraDataInput(item.dataRetorno)}
                      onChange={(event) => atualizarResgateLocal(item.contratoId, { dataRetorno: event.target.value })}
                    />
                  </td>
                  <td>
                    <textarea
                      rows={2}
                      value={rascunhosObservacaoResgate[item.contratoId] || ""}
                      placeholder="Escreva a nova evoluÃƒÂ§ÃƒÂ£o deste contato..."
                      onChange={(event) => atualizarRascunhoObservacaoResgate(item.contratoId, event.target.value)}
                    />
                  </td>
                  <td className="crm-rescue-text-cell crm-rescue-history-cell">
                    {(item.historico?.length ? item.historico : []).map((registro) => (
                      <div key={registro.id} className="crm-rescue-history-item">
                        <strong>{registro.criadoEm || "Sem data"} Â· {registro.criadoPor || "-"}</strong>
                        <span>{registro.status || "-"}</span>
                        <span>{registro.observacao || "-"}</span>
                      </div>
                    ))}
                    {!item.historico?.length ? <span>Sem histÃƒÂ³rico ainda.</span> : null}
                  </td>
                  <td className="crm-rescue-text-cell">
                    <strong>{item.ultimoContatoEm || "Sem registro"}</strong>
                    <span>{item.ultimoContatoPor || "-"}</span>
                    <span>{item.observacaoContato || ""}</span>
                  </td>
                  <td>
                    <div className="crm-inline-actions crm-inline-actions-column">
                      <button type="button" className="ghost-action compact" onClick={() => onAbrirPaciente?.(item.pacienteId)}>
                        Abrir
                      </button>
                      <button type="button" className="primary-action compact" onClick={() => void salvarResgate(item)} disabled={salvandoId === item.contratoId}>
                        {salvandoId === item.contratoId ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!carregando && !resgatesFiltrados.length ? (
                <tr>
                  <td colSpan={14}>Nenhum resgate encontrado para o filtro atual.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className={abaAtiva === "relatorios" ? "crm-grid" : "crm-grid crm-section-hidden"}>
        <article className="panel crm-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">RelatÃ³rio</span>
              <h2>{relatorioAtual.titulo}</h2>
            </div>
            <div className="crm-inline-actions">
              <button type="button" className="ghost-action compact" onClick={exportarRelatorioAtual}>
                <Download size={15} />
                Baixar
              </button>
              {relatorioAtual.icone}
            </div>
          </div>
          {relatorioAberto === "sem-agendamento" ? (
            <div className="crm-report-letter-bar">
              {letrasRelatorio.map((letra) => (
                <button
                  key={letra}
                  type="button"
                  className={`segmented-tab ${relatorioLetra === letra ? "active" : ""}`}
                  onClick={() => setRelatorioLetra(letra)}
                >
                  {letra}
                </button>
              ))}
            </div>
          ) : null}
          {relatorioAberto === "faltaram" || relatorioAberto === "desmarcaram" ? (
            <div className="crm-filter-row crm-filter-row-report">
              <label>
                <span>Data inicial</span>
                <input type="date" value={relatorioDataInicio} onChange={(event) => setRelatorioDataInicio(event.target.value)} />
              </label>
              <label>
                <span>Data final</span>
                <input type="date" value={relatorioDataFim} onChange={(event) => setRelatorioDataFim(event.target.value)} />
              </label>
              <label>
                <span>Profissional</span>
                <select value={relatorioProfissional} onChange={(event) => setRelatorioProfissional(event.target.value)}>
                  <option value="">Todos</option>
                  {profissionaisRelatorio.map((profissional) => (
                    <option key={profissional} value={profissional}>
                      {profissional}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tipo de procedimento</span>
                <select value={relatorioTipoProcedimento} onChange={(event) => setRelatorioTipoProcedimento(event.target.value)}>
                  <option value="">Todos</option>
                  {tiposRelatorio.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </label>
              {relatorioAberto === "desmarcaram" ? (
                <label>
                  <span>Quem desmarcou</span>
                  <select value={relatorioStatusOrigem} onChange={(event) => setRelatorioStatusOrigem(event.target.value)}>
                    <option value="">Todos</option>
                    {origensDesmarcacao.map((origem) => (
                      <option key={origem} value={origem}>
                        {origem}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          <div className="crm-list">
            {!carregando && relatorioAtual.itens.map((item) => (
              <article key={item.chave} className="crm-list-item">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.prontuario || "Sem prontuÃ¡rio"} Â· {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.detalhe}</span>
                  {relatorioAberto === "desmarcaram" && (item.statusOrigem || item.motivo) ? (
                    <span>{[item.statusOrigem ? `Origem: ${item.statusOrigem}` : "", item.motivo ? `Motivo: ${item.motivo}` : ""].filter(Boolean).join(" Â· ")}</span>
                  ) : null}
                  {item.pacienteId ? <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>Abrir paciente</button> : null}
                </div>
              </article>
            ))}
            {!carregando && !relatorioAtual.itens.length ? <div className="module-subitem"><strong>{relatorioAtual.vazio}</strong></div> : null}
          </div>
        </article>
      </section>

      <section className="crm-grid crm-section-hidden">
        <article className="panel crm-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">RelatÃ³rio</span>
              <h2>NÃ£o finalizados sem agendamento</h2>
            </div>
            <div className="crm-inline-actions">
              <button type="button" className="ghost-action compact" onClick={() => exportarRelatorio("crm-nao-finalizados-sem-agendamento", semAgendamentoFiltrados)}>
                <Download size={15} />
                Baixar
              </button>
              <Search size={18} />
            </div>
          </div>
          {relatorioAberto === "sem-agendamento" ? <div className="crm-list">
            {!carregando && semAgendamentoFiltrados.map((item) => (
              <article key={item.chave} className="crm-list-item">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.prontuario || "Sem prontuÃ¡rio"} Â· {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.detalhe}</span>
                  <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>Abrir paciente</button>
                </div>
              </article>
            ))}
            {!carregando && !semAgendamentoFiltrados.length ? <div className="module-subitem"><strong>Nenhum paciente nesta condiÃ§Ã£o.</strong></div> : null}
          </div> : null}
        </article>

        <article className="panel crm-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">RelatÃ³rio</span>
              <h2>Aniversariantes do mÃªs</h2>
            </div>
            <div className="crm-inline-actions">
              <button type="button" className="ghost-action compact" onClick={() => exportarRelatorio("crm-aniversariantes", aniversariantesFiltrados)}>
                <Download size={15} />
                Baixar
              </button>
              <CalendarDays size={18} />
            </div>
          </div>
          {relatorioAberto === "aniversariantes" ? <div className="crm-list">
            {!carregando && aniversariantesFiltrados.map((item) => (
              <article key={item.chave} className="crm-list-item">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.prontuario || "Sem prontuÃ¡rio"} Â· {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.detalhe}</span>
                  <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>Abrir paciente</button>
                </div>
              </article>
            ))}
            {!carregando && !aniversariantesFiltrados.length ? <div className="module-subitem"><strong>Nenhum aniversariante encontrado.</strong></div> : null}
          </div> : null}
        </article>
      </section>

      <section className="crm-grid crm-section-hidden">
        <article className="panel crm-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">RelatÃ³rio</span>
              <h2>Pacientes que faltaram</h2>
            </div>
            <div className="crm-inline-actions">
              <button type="button" className="ghost-action compact" onClick={() => exportarRelatorio("crm-faltaram", faltaramFiltrados)}>
                <Download size={15} />
                Baixar
              </button>
              <CalendarDays size={18} />
            </div>
          </div>
          {relatorioAberto === "faltaram" ? <div className="crm-list">
            {!carregando && faltaramFiltrados.map((item) => (
              <article key={item.chave} className="crm-list-item">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.prontuario || "Sem prontuÃ¡rio"} Â· {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.detalhe}</span>
                  {item.pacienteId ? <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>Abrir paciente</button> : null}
                </div>
              </article>
            ))}
            {!carregando && !faltaramFiltrados.length ? <div className="module-subitem"><strong>Nenhuma falta registrada.</strong></div> : null}
          </div> : null}
        </article>

        <article className="panel crm-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">RelatÃ³rio</span>
              <h2>Pacientes que desmarcaram</h2>
            </div>
            <div className="crm-inline-actions">
              <button type="button" className="ghost-action compact" onClick={() => exportarRelatorio("crm-desmarcaram", desmarcaramFiltrados)}>
                <Download size={15} />
                Baixar
              </button>
              <CalendarDays size={18} />
            </div>
          </div>
          {relatorioAberto === "desmarcaram" ? <div className="crm-list">
            {!carregando && desmarcaramFiltrados.map((item) => (
              <article key={item.chave} className="crm-list-item">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.prontuario || "Sem prontuÃ¡rio"} Â· {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.detalhe}</span>
                  {item.pacienteId ? <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>Abrir paciente</button> : null}
                </div>
              </article>
            ))}
            {!carregando && !desmarcaramFiltrados.length ? <div className="module-subitem"><strong>Nenhuma desmarcaÃ§Ã£o registrada.</strong></div> : null}
          </div> : null}
        </article>
      </section>

      <section className={abaAtiva === "funil" ? "panel crm-panel crm-pipeline-panel" : "panel crm-panel crm-pipeline-panel crm-section-hidden"}>
        <div className="section-title-row">
          <div>
            <span className="panel-kicker">Campanhas</span>
            <h2>Fluxo do Facebook</h2>
          </div>
          <div className="crm-inline-actions">
            <button type="button" className="ghost-action compact" onClick={() => exportarCrmPacientes("crm-funil-facebook", pipelineFiltrado)}>
              <Download size={15} />
              Baixar
            </button>
            <Megaphone size={18} />
          </div>
        </div>

        <div className="crm-manual-entry">
          <div className="crm-manual-entry-header">
            <div>
              <span className="panel-kicker">Novo lead</span>
              <strong>Adicionar paciente sem cadastro completo</strong>
            </div>
            <span>Digite o nome e o telefone, igual na agenda.</span>
          </div>
          <div className="crm-manual-entry-form">
            <label>
              <span>Nome do paciente</span>
              <input
                value={novoLeadManual.nome}
                onChange={(event) => setNovoLeadManual((atual) => ({ ...atual, nome: event.target.value }))}
                placeholder="Ex.: Maria Silva"
              />
            </label>
            <label>
              <span>Telefone</span>
              <input
                value={novoLeadManual.telefone}
                onChange={(event) => setNovoLeadManual((atual) => ({ ...atual, telefone: event.target.value }))}
                placeholder="Ex.: 22999999999"
              />
            </label>
            <button type="button" className="primary-action" onClick={() => void adicionarLeadManual()} disabled={criandoManual}>
              <UserRoundPlus size={15} />
              {criandoManual ? "Criando..." : "Adicionar ao CRM"}
            </button>
          </div>
        </div>

        <div className="crm-pipeline-list">
          {carregando ? <div className="module-subitem"><strong>Carregando funil...</strong></div> : null}
          {!carregando ? (
            <div className="crm-selector-card">
              <div className="crm-manual-entry-header">
                <div>
                  <span className="panel-kicker">Visualização do funil</span>
                  <strong>Tabela dos leads em andamento</strong>
                </div>
                <span>Clique na linha para editar o CRM do paciente.</span>
              </div>
              <div className="crm-selector-grid">
                <label className="crm-field-wide">
                  <span>Buscar pelo nome, telefone, campanha ou etapa</span>
                  <input
                    value={buscaLead}
                    onChange={(event) => setBuscaLead(event.target.value)}
                    placeholder="Ex.: Maria, 2299..., Facebook ou Conversando"
                  />
                </label>
              </div>
              <div className="crm-funnel-grid-shell">
                <table className="crm-funnel-table">
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>Telefone</th>
                      <th>Etapa</th>
                      <th>Campanha</th>
                      <th>Responsável</th>
                      <th>Próximo contato</th>
                      <th>Última interação</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsFunilFiltrados.map((item) => (
                      <tr
                        key={item.id}
                        className={leadSelecionado?.id === item.id ? "active" : ""}
                        onClick={() => setLeadSelecionadoId(item.id)}
                      >
                        <td>
                          <strong>{item.nome}</strong>
                          <span>{item.prontuario || "Sem prontuário"}</span>
                        </td>
                        <td>{item.telefone || "-"}</td>
                        <td>{item.etapaFunil || "Novo lead"}</td>
                        <td>{item.campanha || "-"}</td>
                        <td>{item.responsavel || "-"}</td>
                        <td>{item.proximoContato || "-"}</td>
                        <td>{item.ultimaInteracao || "-"}</td>
                        <td>
                          <div className="crm-inline-actions">
                            {item.pacienteId ? (
                              <button
                                type="button"
                                className="ghost-action compact"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onAbrirPaciente?.(item.pacienteId);
                                }}
                              >
                                Abrir
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="ghost-action compact"
                              onClick={(event) => {
                                event.stopPropagation();
                                setLeadSelecionadoId(item.id);
                              }}
                            >
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!leadsFunilFiltrados.length ? (
                      <tr>
                        <td colSpan={8}>Nenhum lead encontrado para o filtro atual.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {!carregando && previewLeadManualVisivel ? (
            <article className="crm-pipeline-card crm-pipeline-card-preview">
              <header className="crm-pipeline-card-header">
                <div>
                  <strong>{nomeLeadManual || "Nome do paciente"}</strong>
                  <span>{telefoneLeadManual || "Sem telefone informado"}</span>
                </div>
                <div className="crm-origin-tags">
                  <span className="crm-tag">PrÃ©via do novo lead</span>
                </div>
              </header>
              <div className="crm-form-grid">
                <label>
                  <span>Etapa do funil</span>
                  <input value="Novo lead" readOnly />
                </label>
                <label>
                  <span>Canal</span>
                  <input value="Facebook" readOnly />
                </label>
                <label className="crm-field-wide">
                  <span>ObservaÃ§Ãµes</span>
                  <textarea rows={3} readOnly value="Ao clicar em Adicionar ao CRM, esta ficha serÃ¡ criada com o nome e o telefone digitados acima." />
                </label>
              </div>
            </article>
          ) : null}
          {!carregando && leadSelecionado ? (
            <article key={leadSelecionado.id} className="crm-pipeline-card">
              <header className="crm-pipeline-card-header">
                <div>
                  <strong>{leadSelecionado.nome}</strong>
                  <span>{leadSelecionado.prontuario || "Sem prontuÃ¡rio"} Â· {leadSelecionado.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-origin-tags">
                  {leadSelecionado.origemFinalizado ? <span className="crm-tag">Finalizado</span> : null}
                  {leadSelecionado.origemAvaliacao ? <span className="crm-tag">AvaliaÃ§Ã£o</span> : null}
                </div>
              </header>

              <div className="crm-form-grid">
                <label>
                  <span>Etapa do funil</span>
                  <select value={leadSelecionado.etapaFunil || "Novo lead"} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { etapaFunil: event.target.value })}>
                    {ETAPAS_CRM.map((etapa) => (
                      <option key={etapa} value={etapa}>{etapa}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Canal</span>
                  <input value={leadSelecionado.canal || "Facebook"} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { canal: event.target.value })} />
                </label>
                <label>
                  <span>Campanha</span>
                  <input value={leadSelecionado.campanha || ""} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { campanha: event.target.value })} />
                </label>
                <label>
                  <span>Conjunto</span>
                  <input value={leadSelecionado.conjuntoAnuncio || ""} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { conjuntoAnuncio: event.target.value })} />
                </label>
                <label>
                  <span>AnÃºncio</span>
                  <input value={leadSelecionado.anuncio || ""} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { anuncio: event.target.value })} />
                </label>
                <label>
                  <span>ResponsÃ¡vel</span>
                  <input value={leadSelecionado.responsavel || ""} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { responsavel: event.target.value })} />
                </label>
                <label>
                  <span>PrÃ³ximo contato</span>
                  <input type="date" value={leadSelecionado.proximoContato || ""} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { proximoContato: event.target.value })} />
                </label>
                <label>
                  <span>Ãšltima interaÃ§Ã£o</span>
                  <input type="date" value={leadSelecionado.ultimaInteracao || ""} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { ultimaInteracao: event.target.value })} />
                </label>
                <label className="crm-field-wide">
                  <span>ObservaÃ§Ãµes da campanha</span>
                  <textarea value={leadSelecionado.observacao || ""} rows={4} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { observacao: event.target.value })} />
                </label>
              </div>

              <footer className="crm-pipeline-card-footer">
                <div className="crm-footer-meta">
                  <span>{leadSelecionado.ultimaAvaliacaoEm ? `AvaliaÃ§Ã£o: ${leadSelecionado.ultimaAvaliacaoEm}` : "Sem avaliaÃ§Ã£o registrada"}</span>
                  <span>{leadSelecionado.finalizadoEm ? `Finalizado: ${leadSelecionado.finalizadoEm}` : "Sem finalizaÃ§Ã£o registrada"}</span>
                </div>
                <div className="crm-inline-actions">
                  <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(leadSelecionado.pacienteId)}>
                    <Search size={15} />
                    Abrir paciente
                  </button>
                  <button type="button" className="primary-action" onClick={() => void salvarItem(leadSelecionado)} disabled={salvandoId === leadSelecionado.id}>
                    <Save size={15} />
                    {salvandoId === leadSelecionado.id ? "Salvando..." : "Salvar CRM"}
                  </button>
                </div>
              </footer>
            </article>
          ) : null}
          {!carregando && !leadsFunilFiltrados.length ? <div className="module-subitem"><strong>Nenhum lead encontrado para edição.</strong></div> : null}
        </div>
      </section>
    </section>
  );
}




