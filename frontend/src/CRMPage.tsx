import { CalendarDays, CheckCircle2, Download, Megaphone, Save, Search, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  adicionarPacienteManualCrmApi,
  adicionarPacienteAvaliacaoCrmApi,
  removerPacienteAvaliacaoCrmApi,
  atualizarCrmApi,
  listarPacientesApi,
  listarCrmApi,
  type CrmAvaliacaoItemApi,
  type CrmNovoLeadPayloadApi,
  type CrmPacienteItemApi,
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
};

type CrmAba = "funil" | "finalizados" | "avaliacoes" | "relatorios";

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
  "Agendou avaliação",
  "Em negociação",
  "Convertido",
  "Perdido",
] as const;

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
  const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return "";
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function CRMPage({ busca, onAbrirPaciente }: CRMPageProps) {
  const [pipeline, setPipeline] = useState<CrmPacienteItemApi[]>([]);
  const [finalizados, setFinalizados] = useState<CrmPacienteItemApi[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<CrmAvaliacaoItemApi[]>([]);
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
        listarPacientesApi("", 500),
        listarAgendamentosAgenda(inicioHistorico.split("-").reverse().join("/"), fimFuturo.split("-").reverse().join("/")),
      ]);

      const [crmResult, pacientesResult, agendamentosResult] = resultados;
      const resposta = crmResult.status === "fulfilled"
        ? crmResult.value
        : { pipeline: [], finalizados: [], avaliacoes: [] };
      const pacientes = pacientesResult.status === "fulfilled" ? pacientesResult.value : [];
      const agendamentos = agendamentosResult.status === "fulfilled" ? agendamentosResult.value : [];

      setPipeline((resposta.pipeline || []).map(normalizarItemCrm));
      setFinalizados((resposta.finalizados || []).map(normalizarItemCrm));
      setAvaliacoes(resposta.avaliacoes || []);

      const finalizadosIds = new Set((resposta.finalizados || []).map((item) => item.pacienteId));
      const futurosAtivos = agendamentos.filter((item) => {
        const status = normalizarTexto(item.status || "");
        if (status === "desmarcado" || status === "cancelado" || status === "faltou") return false;
        const dataIso = (item.data || "").split("/").reverse().join("-");
        return dataIso >= hoje;
      });
      const idsComAgendaFutura = new Set(futurosAtivos.map((item) => item.pacienteId).filter((id): id is number => Boolean(id)));

      setRelatorioSemAgendamento(
        pacientes
          .filter((item) => !finalizadosIds.has(item.id) && !idsComAgendaFutura.has(item.id))
          .map((item) => ({
            chave: `sem-agenda-${item.id}`,
            pacienteId: item.id,
            nome: item.nome,
            prontuario: item.prontuario || "",
            telefone: item.telefone || "",
            detalhe: "Sem agendamento futuro e não finalizado",
          }))
          .slice(0, 80)
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
            detalhe: nascimento ? `Aniversário em ${String(nascimento.dia).padStart(2, "0")}/${String(nascimento.mes).padStart(2, "0")}` : "Sem data válida",
          }))
      );

      const mapearAgendamentoRelatorio = (prefixo: string, item: AgendaApiAgendamento): RelatorioCrmItem => ({
        chave: `${prefixo}-${item.id}`,
        pacienteId: item.pacienteId || 0,
        nome: item.paciente || "Paciente",
        prontuario: item.prontuario || "",
        telefone: item.telefone || "",
        detalhe: `${item.data || "-"} · ${item.inicio || "-"} · ${item.profissional || "-"} · ${(item.procedimentos || []).join(", ") || "-"}`,
      });

      setRelatorioFaltaram(
        agendamentos
          .filter((item) => normalizarTexto(item.status || "") === "faltou")
          .sort((a, b) => `${b.data} ${b.inicio}`.localeCompare(`${a.data} ${a.inicio}`))
          .map((item) => mapearAgendamentoRelatorio("faltou", item))
      );

      setRelatorioDesmarcaram(
        agendamentos
          .filter((item) => normalizarTexto(item.status || "") === "desmarcado")
          .sort((a, b) => `${b.data} ${b.inicio}`.localeCompare(`${a.data} ${a.inicio}`))
          .map((item) => mapearAgendamentoRelatorio("desmarcou", item))
      );

      const fontesComFalha: string[] = [];
      if (crmResult.status === "rejected") fontesComFalha.push("painel CRM");
      if (pacientesResult.status === "rejected") fontesComFalha.push("lista de pacientes");
      if (agendamentosResult.status === "rejected") fontesComFalha.push("agendamentos");
      if (fontesComFalha.length > 0) {
        setErro(`Alguns dados do CRM não carregaram: ${fontesComFalha.join(", ")}.`);
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

  const termoBusca = normalizarTexto(busca);
  const nomeLeadManual = novoLeadManual.nome.trim();
  const telefoneLeadManual = novoLeadManual.telefone.trim();
  const previewLeadManualVisivel = Boolean(nomeLeadManual || telefoneLeadManual);
  const finalizadosIds = useMemo(() => new Set(finalizados.map((item) => item.id)), [finalizados]);

  const pipelineFiltrado = useMemo(
    () =>
      [...pipeline]
        .filter((item) => !item.origemFinalizado && !finalizadosIds.has(item.id))
        .filter((item) => correspondeBusca(item, termoBusca))
        .sort((a, b) => b.id - a.id),
    [finalizadosIds, pipeline, termoBusca]
  );
  const termoBuscaLead = normalizarTexto(buscaLead);
  const leadsFiltrados = useMemo(
    () => pipelineFiltrado.filter((item) => correspondeBusca(item, termoBuscaLead)),
    [pipelineFiltrado, termoBuscaLead]
  );
  const leadSelecionado = useMemo(
    () => leadsFiltrados.find((item) => item.id === leadSelecionadoId) || leadsFiltrados[0] || null,
    [leadSelecionadoId, leadsFiltrados]
  );
  const finalizadosFiltrados = useMemo(
    () => finalizados.filter((item) => correspondeBusca(item, termoBusca)),
    [finalizados, termoBusca]
  );
  const avaliacoesFiltradas = useMemo(
    () => {
      if (!periodoAvaliacaoInicio || !periodoAvaliacaoFim) return [AVALIACAO_PLACEHOLDER];
      return avaliacoes.filter((item) => {
        const dataIso = extrairDataIso(item.dataAvaliacao);
        if (!dataIso || dataIso < periodoAvaliacaoInicio || dataIso > periodoAvaliacaoFim) return false;
        return correspondeBusca(
          {
            nome: item.nome,
            prontuario: item.prontuario,
            telefone: item.telefone,
            campanha: item.procedimento,
            etapaFunil: item.status,
          },
          termoBusca
        );
      });
    },
    [avaliacoes, periodoAvaliacaoFim, periodoAvaliacaoInicio, termoBusca]
  );
  const semAgendamentoFiltrados = useMemo(
    () => relatorioSemAgendamento.filter((item) => correspondeBusca(item, termoBusca)),
    [relatorioSemAgendamento, termoBusca]
  );
  const aniversariantesFiltrados = useMemo(
    () => relatorioAniversariantes.filter((item) => correspondeBusca(item, termoBusca)),
    [relatorioAniversariantes, termoBusca]
  );
  const faltaramFiltrados = useMemo(
    () => relatorioFaltaram.filter((item) => correspondeBusca(item, termoBusca)),
    [relatorioFaltaram, termoBusca]
  );
  const desmarcaramFiltrados = useMemo(
    () => relatorioDesmarcaram.filter((item) => correspondeBusca(item, termoBusca)),
    [relatorioDesmarcaram, termoBusca]
  );

  useEffect(() => {
    if (!leadsFiltrados.length) {
      if (leadSelecionadoId !== null) setLeadSelecionadoId(null);
      return;
    }
    if (!leadSelecionado || leadSelecionado.id !== leadSelecionadoId) {
      setLeadSelecionadoId(leadsFiltrados[0].id);
    }
  }, [leadSelecionado, leadSelecionadoId, leadsFiltrados]);

  function atualizarItemLocal(crmId: number, parcial: Partial<CrmPacienteItemApi>) {
    const aplicar = (lista: CrmPacienteItemApi[]) =>
      lista.map((item) => (item.id === crmId ? { ...item, ...parcial } : item));
    setPipeline((atual) => aplicar(atual));
    setFinalizados((atual) => aplicar(atual));
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

  async function adicionarAvaliacaoAoCrm(pacienteId: number) {
    setAdicionandoAvaliacaoId(pacienteId);
    setErro(null);
    try {
      await adicionarPacienteAvaliacaoCrmApi(pacienteId);
      setFeedback("Paciente de avaliação enviado para o CRM.");
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao levar avaliação para o CRM.");
    } finally {
      setAdicionandoAvaliacaoId(null);
    }
  }

  async function removerAvaliacaoDoCrm(pacienteId: number) {
    setAdicionandoAvaliacaoId(pacienteId);
    setErro(null);
    try {
      await removerPacienteAvaliacaoCrmApi(pacienteId);
      setFeedback("Paciente de avaliação removido do CRM.");
      await carregarPainel();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao desfazer avaliação no CRM.");
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
      ["Paciente", "Prontuario", "Telefone", "Detalhe"],
      linhas.map((item) => [item.nome, item.prontuario, item.telefone, item.detalhe])
    );
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
      ["Paciente", "Prontuario", "Telefone", "Data", "Profissional", "Procedimento", "Status"],
      linhasValidas.map((item) => [
        item.nome,
        item.prontuario,
        item.telefone,
        item.dataAvaliacao,
        item.profissional,
        item.procedimento,
        item.status,
      ])
    );
  }

  function alternarRelatorio(chave: "sem-agendamento" | "aniversariantes" | "faltaram" | "desmarcaram") {
    setRelatorioAberto(chave);
  }

  const relatorioAtual = useMemo(() => {
    switch (relatorioAberto) {
      case "aniversariantes":
        return {
          titulo: "Aniversariantes do mês",
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
          vazio: "Nenhuma desmarcação registrada.",
          icone: <CalendarDays size={18} />,
        };
      default:
        return {
          titulo: "Não finalizados sem agendamento",
          nomeExportacao: "crm-nao-finalizados-sem-agendamento",
          itens: semAgendamentoFiltrados,
          vazio: "Nenhum paciente nesta condição.",
          icone: <Search size={18} />,
        };
    }
  }, [aniversariantesFiltrados, desmarcaramFiltrados, faltaramFiltrados, relatorioAberto, semAgendamentoFiltrados]);

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
          <span className="panel-kicker">Avaliações</span>
          <strong>{avaliacoes.length}</strong>
          <span>detectadas pelos agendamentos</span>
        </article>
      </section>

      {erro ? <p className="users-password-feedback error">{erro}</p> : null}
      {feedback ? <p className="users-password-feedback success">{feedback}</p> : null}

      <section className="panel crm-tabs-panel">
        <div className="tab-shell tab-shell-primary crm-tabs-shell">
          <button type="button" className={`segmented-tab segmented-tab-primary ${abaAtiva === "funil" ? "active" : ""}`} onClick={() => setAbaAtiva("funil")}>Funil</button>
          <button type="button" className={`segmented-tab segmented-tab-primary ${abaAtiva === "finalizados" ? "active" : ""}`} onClick={() => setAbaAtiva("finalizados")}>Finalizados</button>
          <button type="button" className={`segmented-tab segmented-tab-primary ${abaAtiva === "avaliacoes" ? "active" : ""}`} onClick={() => setAbaAtiva("avaliacoes")}>Avaliações</button>
          <button type="button" className={`segmented-tab segmented-tab-primary ${abaAtiva === "relatorios" ? "active" : ""}`} onClick={() => setAbaAtiva("relatorios")}>Relatórios</button>
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

      <section className={abaAtiva === "finalizados" || abaAtiva === "avaliacoes" ? "crm-grid" : "crm-grid crm-section-hidden"}>
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
                  <span>{item.prontuario || "Sem prontuário"} · {item.telefone || "Sem telefone"}</span>
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

        <article className={abaAtiva === "avaliacoes" ? "panel crm-panel" : "panel crm-panel crm-section-hidden"}>
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Entrada automática</span>
              <h2>Pacientes que fizeram avaliação</h2>
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
            <div className="module-subitem"><strong>Selecione a data inicial e final para carregar o relatório.</strong></div>
          ) : null}
          <div className="crm-list">
            {carregando ? <div className="module-subitem"><strong>Carregando...</strong></div> : null}
            {!carregando && avaliacoesFiltradas.map((item) => (
              item.pacienteId < 0 ? null : <article key={`avaliacao-${item.pacienteId}`} className="crm-list-item">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.dataAvaliacao || "-"} · {item.procedimento || "Avaliação"} · {item.profissional || "-"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.jaNoCrm ? "Já está no CRM" : item.telefone || "Sem telefone"}</span>
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
            {!carregando && !avaliacoesFiltradas.length ? <div className="module-subitem"><strong>Nenhuma avaliação encontrada.</strong></div> : null}
          </div>
        </article>
      </section>

      <section className={abaAtiva === "relatorios" ? "crm-grid" : "crm-grid crm-section-hidden"}>
        <article className="panel crm-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Relatório</span>
              <h2>{relatorioAtual.titulo}</h2>
            </div>
            <div className="crm-inline-actions">
              <button type="button" className="ghost-action compact" onClick={() => exportarRelatorio(relatorioAtual.nomeExportacao, relatorioAtual.itens)}>
                <Download size={15} />
                Baixar
              </button>
              {relatorioAtual.icone}
            </div>
          </div>
          <div className="crm-list">
            {!carregando && relatorioAtual.itens.map((item) => (
              <article key={item.chave} className="crm-list-item">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.prontuario || "Sem prontuário"} · {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.detalhe}</span>
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
              <span className="panel-kicker">Relatório</span>
              <h2>Não finalizados sem agendamento</h2>
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
                  <span>{item.prontuario || "Sem prontuário"} · {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.detalhe}</span>
                  <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>Abrir paciente</button>
                </div>
              </article>
            ))}
            {!carregando && !semAgendamentoFiltrados.length ? <div className="module-subitem"><strong>Nenhum paciente nesta condição.</strong></div> : null}
          </div> : null}
        </article>

        <article className="panel crm-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Relatório</span>
              <h2>Aniversariantes do mês</h2>
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
                  <span>{item.prontuario || "Sem prontuário"} · {item.telefone || "Sem telefone"}</span>
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
              <span className="panel-kicker">Relatório</span>
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
                  <span>{item.prontuario || "Sem prontuário"} · {item.telefone || "Sem telefone"}</span>
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
              <span className="panel-kicker">Relatório</span>
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
                  <span>{item.prontuario || "Sem prontuário"} · {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-list-item-meta">
                  <span>{item.detalhe}</span>
                  {item.pacienteId ? <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>Abrir paciente</button> : null}
                </div>
              </article>
            ))}
            {!carregando && !desmarcaramFiltrados.length ? <div className="module-subitem"><strong>Nenhuma desmarcação registrada.</strong></div> : null}
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
                  <span className="panel-kicker">Buscar lead</span>
                  <strong>Escolha um lead cadastrado para editar</strong>
                </div>
                <span>Aqui aparece apenas um cadastro por vez.</span>
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
                <label className="crm-field-wide">
                  <span>Lead selecionado</span>
                  <select
                    value={leadSelecionado?.id ?? ""}
                    onChange={(event) => setLeadSelecionadoId(event.target.value ? Number(event.target.value) : null)}
                  >
                    {leadsFiltrados.length ? (
                      leadsFiltrados.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome} {item.telefone ? `· ${item.telefone}` : ""} {item.etapaFunil ? `· ${item.etapaFunil}` : ""}
                        </option>
                      ))
                    ) : (
                      <option value="">Nenhum lead encontrado</option>
                    )}
                  </select>
                </label>
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
                  <span className="crm-tag">Prévia do novo lead</span>
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
                  <span>Observações</span>
                  <textarea rows={3} readOnly value="Ao clicar em Adicionar ao CRM, esta ficha será criada com o nome e o telefone digitados acima." />
                </label>
              </div>
            </article>
          ) : null}
          {!carregando && leadSelecionado ? (
            <article key={leadSelecionado.id} className="crm-pipeline-card">
              <header className="crm-pipeline-card-header">
                <div>
                  <strong>{leadSelecionado.nome}</strong>
                  <span>{leadSelecionado.prontuario || "Sem prontuário"} · {leadSelecionado.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-origin-tags">
                  {leadSelecionado.origemFinalizado ? <span className="crm-tag">Finalizado</span> : null}
                  {leadSelecionado.origemAvaliacao ? <span className="crm-tag">Avaliação</span> : null}
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
                  <span>Anúncio</span>
                  <input value={leadSelecionado.anuncio || ""} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { anuncio: event.target.value })} />
                </label>
                <label>
                  <span>Responsável</span>
                  <input value={leadSelecionado.responsavel || ""} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { responsavel: event.target.value })} />
                </label>
                <label>
                  <span>Próximo contato</span>
                  <input type="date" value={leadSelecionado.proximoContato || ""} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { proximoContato: event.target.value })} />
                </label>
                <label>
                  <span>Última interação</span>
                  <input type="date" value={leadSelecionado.ultimaInteracao || ""} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { ultimaInteracao: event.target.value })} />
                </label>
                <label className="crm-field-wide">
                  <span>Observações da campanha</span>
                  <textarea value={leadSelecionado.observacao || ""} rows={4} onChange={(event) => atualizarItemLocal(leadSelecionado.id, { observacao: event.target.value })} />
                </label>
              </div>

              <footer className="crm-pipeline-card-footer">
                <div className="crm-footer-meta">
                  <span>{leadSelecionado.ultimaAvaliacaoEm ? `Avaliação: ${leadSelecionado.ultimaAvaliacaoEm}` : "Sem avaliação registrada"}</span>
                  <span>{leadSelecionado.finalizadoEm ? `Finalizado: ${leadSelecionado.finalizadoEm}` : "Sem finalização registrada"}</span>
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
          {!carregando && !leadsFiltrados.length ? <div className="module-subitem"><strong>Nenhum lead encontrado para edição.</strong></div> : null}
        </div>
      </section>
    </section>
  );
}
