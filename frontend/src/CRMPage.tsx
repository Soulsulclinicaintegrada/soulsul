import { CalendarDays, CheckCircle2, Download, Megaphone, Save, Search, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  adicionarPacienteAvaliacaoCrmApi,
  atualizarCrmApi,
  listarPacientesApi,
  listarCrmApi,
  type CrmAvaliacaoItemApi,
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
  const match = texto.match(/^(\d{2})\/(\d{2})\/\d{4}$/);
  if (!match) return null;
  return { dia: Number(match[1]), mes: Number(match[2]) };
}

export function CRMPage({ busca, onAbrirPaciente }: CRMPageProps) {
  const [pipeline, setPipeline] = useState<CrmPacienteItemApi[]>([]);
  const [finalizados, setFinalizados] = useState<CrmPacienteItemApi[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<CrmAvaliacaoItemApi[]>([]);
  const [relatorioSemAgendamento, setRelatorioSemAgendamento] = useState<RelatorioCrmItem[]>([]);
  const [relatorioAniversariantes, setRelatorioAniversariantes] = useState<RelatorioCrmItem[]>([]);
  const [relatorioFaltaram, setRelatorioFaltaram] = useState<RelatorioCrmItem[]>([]);
  const [relatorioDesmarcaram, setRelatorioDesmarcaram] = useState<RelatorioCrmItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [adicionandoAvaliacaoId, setAdicionandoAvaliacaoId] = useState<number | null>(null);

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

  const pipelineFiltrado = useMemo(
    () => pipeline.filter((item) => correspondeBusca(item, termoBusca)),
    [pipeline, termoBusca]
  );
  const finalizadosFiltrados = useMemo(
    () => finalizados.filter((item) => correspondeBusca(item, termoBusca)),
    [finalizados, termoBusca]
  );
  const avaliacoesFiltradas = useMemo(
    () =>
      avaliacoes.filter((item) =>
        correspondeBusca(
          {
            nome: item.nome,
            prontuario: item.prontuario,
            telefone: item.telefone,
            campanha: item.procedimento,
            etapaFunil: item.status,
          },
          termoBusca
        )
      ),
    [avaliacoes, termoBusca]
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
    baixarCsv(
      "crm-avaliacoes.csv",
      ["Paciente", "Prontuario", "Telefone", "Data", "Profissional", "Procedimento", "Status"],
      avaliacoesFiltradas.map((item) => [
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

  return (
    <section className="module-shell crm-shell">
      <section className="module-kpis">
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Funil</span>
          <strong>{pipeline.length}</strong>
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

      <section className="crm-grid">
        <article className="panel crm-panel">
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

        <article className="panel crm-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Entrada automática</span>
              <h2>Pacientes que fizeram avaliação</h2>
            </div>
            <div className="crm-inline-actions">
              <button type="button" className="ghost-action compact" onClick={exportarAvaliacoes}>
                <Download size={15} />
                Baixar
              </button>
              <CalendarDays size={18} />
            </div>
          </div>
          <div className="crm-list">
            {carregando ? <div className="module-subitem"><strong>Carregando...</strong></div> : null}
            {!carregando && avaliacoesFiltradas.map((item) => (
              <article key={`avaliacao-${item.pacienteId}`} className="crm-list-item">
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
                      onClick={() => void adicionarAvaliacaoAoCrm(item.pacienteId)}
                      disabled={item.jaNoCrm || adicionandoAvaliacaoId === item.pacienteId}
                    >
                      <UserRoundPlus size={15} />
                      {item.jaNoCrm ? "No CRM" : adicionandoAvaliacaoId === item.pacienteId ? "Enviando..." : "Levar ao CRM"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!carregando && !avaliacoesFiltradas.length ? <div className="module-subitem"><strong>Nenhuma avaliação encontrada.</strong></div> : null}
          </div>
        </article>
      </section>

      <section className="crm-grid">
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
          <div className="crm-list">
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
          </div>
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
          <div className="crm-list">
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
          </div>
        </article>
      </section>

      <section className="crm-grid">
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
          <div className="crm-list">
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
          </div>
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
          <div className="crm-list">
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
          </div>
        </article>
      </section>

      <section className="panel crm-panel crm-pipeline-panel">
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

        <div className="crm-pipeline-list">
          {carregando ? <div className="module-subitem"><strong>Carregando funil...</strong></div> : null}
          {!carregando && pipelineFiltrado.map((item) => (
            <article key={item.id} className="crm-pipeline-card">
              <header className="crm-pipeline-card-header">
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.prontuario || "Sem prontuário"} · {item.telefone || "Sem telefone"}</span>
                </div>
                <div className="crm-origin-tags">
                  {item.origemFinalizado ? <span className="crm-tag">Finalizado</span> : null}
                  {item.origemAvaliacao ? <span className="crm-tag">Avaliação</span> : null}
                </div>
              </header>

              <div className="crm-form-grid">
                <label>
                  <span>Etapa do funil</span>
                  <select value={item.etapaFunil || "Novo lead"} onChange={(event) => atualizarItemLocal(item.id, { etapaFunil: event.target.value })}>
                    {ETAPAS_CRM.map((etapa) => (
                      <option key={etapa} value={etapa}>{etapa}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Canal</span>
                  <input value={item.canal || "Facebook"} onChange={(event) => atualizarItemLocal(item.id, { canal: event.target.value })} />
                </label>
                <label>
                  <span>Campanha</span>
                  <input value={item.campanha || ""} onChange={(event) => atualizarItemLocal(item.id, { campanha: event.target.value })} />
                </label>
                <label>
                  <span>Conjunto</span>
                  <input value={item.conjuntoAnuncio || ""} onChange={(event) => atualizarItemLocal(item.id, { conjuntoAnuncio: event.target.value })} />
                </label>
                <label>
                  <span>Anúncio</span>
                  <input value={item.anuncio || ""} onChange={(event) => atualizarItemLocal(item.id, { anuncio: event.target.value })} />
                </label>
                <label>
                  <span>Responsável</span>
                  <input value={item.responsavel || ""} onChange={(event) => atualizarItemLocal(item.id, { responsavel: event.target.value })} />
                </label>
                <label>
                  <span>Próximo contato</span>
                  <input type="date" value={item.proximoContato || ""} onChange={(event) => atualizarItemLocal(item.id, { proximoContato: event.target.value })} />
                </label>
                <label>
                  <span>Última interação</span>
                  <input type="date" value={item.ultimaInteracao || ""} onChange={(event) => atualizarItemLocal(item.id, { ultimaInteracao: event.target.value })} />
                </label>
                <label className="crm-field-wide">
                  <span>Observações da campanha</span>
                  <textarea value={item.observacao || ""} rows={4} onChange={(event) => atualizarItemLocal(item.id, { observacao: event.target.value })} />
                </label>
              </div>

              <footer className="crm-pipeline-card-footer">
                <div className="crm-footer-meta">
                  <span>{item.ultimaAvaliacaoEm ? `Avaliação: ${item.ultimaAvaliacaoEm}` : "Sem avaliação registrada"}</span>
                  <span>{item.finalizadoEm ? `Finalizado: ${item.finalizadoEm}` : "Sem finalização registrada"}</span>
                </div>
                <div className="crm-inline-actions">
                  <button type="button" className="ghost-action" onClick={() => onAbrirPaciente?.(item.pacienteId)}>
                    <Search size={15} />
                    Abrir paciente
                  </button>
                  <button type="button" className="primary-action" onClick={() => void salvarItem(item)} disabled={salvandoId === item.id}>
                    <Save size={15} />
                    {salvandoId === item.id ? "Salvando..." : "Salvar CRM"}
                  </button>
                </div>
              </footer>
            </article>
          ))}
          {!carregando && !pipelineFiltrado.length ? <div className="module-subitem"><strong>Nenhum lead no funil.</strong></div> : null}
        </div>
      </section>
    </section>
  );
}
