import { useEffect, useMemo, useState } from "react";
import { DollarSign, Target, TrendingUp } from "lucide-react";
import {
  atualizarMetaFinanceiraApi,
  listarCrmApi,
  painelDashboardApi,
  type CrmPainelApi,
  type DashboardPainelApi
} from "./pacientesApi";

function iconeIndicador(chave: string) {
  const chaveNormalizada = (chave || "").toLowerCase();
  if (chaveNormalizada.includes("vendido")) return <TrendingUp size={20} />;
  if (chaveNormalizada.includes("meta")) return <Target size={20} />;
  return <DollarSign size={20} />;
}

const DASHBOARD_VAZIO: DashboardPainelApi = {
  indicadores: [],
  meses: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
  serieVendas: Array.from({ length: 12 }, () => 0),
  resumoHoje: {
    entradasConfirmadas: "R$ 0,00",
    saidasPrevistas: "R$ 0,00",
    saldoProjetado: "R$ 0,00"
  },
  metas: {
    vendidoMes: "R$ 0,00",
    vendidoAno: "R$ 0,00",
    metaMes: "R$ 0,00",
    supermetaMes: "R$ 0,00",
    hipermetaMes: "R$ 0,00",
    faltaMetaMes: "R$ 0,00",
    faltaMetaAno: "R$ 0,00",
    percentualMetaMes: 0,
    percentualMetaAno: 0
  },
  agendaHoje: [],
  alertas: [],
  atividades: []
};

const CRM_VAZIO: CrmPainelApi = {
  pipeline: [],
  finalizados: [],
  avaliacoes: []
};

const TICKET_MEDIO = 4000;

const FUNIL_CORES = [
  { chave: "leads", rotulo: "Leads", cor: "#5b64b5", percentual: 1 },
  { chave: "agendou", rotulo: "Agendou", cor: "#42c0c7", percentual: 0.75 },
  { chave: "compareceu", rotulo: "Compareceu", cor: "#f2898c", percentual: 0.5 },
  { chave: "fechou", rotulo: "Fechou", cor: "#efc449", percentual: 0.25 }
] as const;

function moedaParaNumero(valor: string) {
  return Number(String(valor || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

function numeroParaMoedaBr(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizarTexto(valor: string) {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function etapaEhAgendada(etapa?: string) {
  const valor = normalizarTexto(etapa || "");
  return ["agendou avaliacao", "em negociacao", "convertido", "perdido"].includes(valor);
}

function montarFunilMeta(metaNumero: number) {
  const fechou = Math.max(1, Math.ceil((metaNumero || 0) / TICKET_MEDIO));
  return {
    leads: fechou * 4,
    agendou: fechou * 3,
    compareceu: fechou * 2,
    fechou
  };
}

function montarFunilEvolucao(crm: CrmPainelApi) {
  const idsLeads = new Set<number>();
  const idsAgendados = new Set<number>();

  crm.pipeline.forEach((item) => {
    if (item.pacienteId) idsLeads.add(item.pacienteId);
    if (item.pacienteId && etapaEhAgendada(item.etapaFunil)) idsAgendados.add(item.pacienteId);
  });
  crm.finalizados.forEach((item) => {
    if (item.pacienteId) {
      idsLeads.add(item.pacienteId);
      idsAgendados.add(item.pacienteId);
    }
  });

  const idsCompareceu = new Set<number>();
  crm.avaliacoes.forEach((item) => {
    if (item.pacienteId) {
      idsLeads.add(item.pacienteId);
      idsAgendados.add(item.pacienteId);
      idsCompareceu.add(item.pacienteId);
    }
  });

  const idsFechou = new Set<number>();
  crm.finalizados.forEach((item) => {
    if (item.pacienteId) idsFechou.add(item.pacienteId);
  });

  return {
    leads: idsLeads.size,
    agendou: Math.max(idsAgendados.size, idsCompareceu.size),
    compareceu: idsCompareceu.size,
    fechou: idsFechou.size
  };
}

function formatoPercentual(valor: number, base: number) {
  if (!base) return "0,0%";
  return `${((valor / base) * 100).toFixed(1).replace(".", ",")}%`;
}

type FunilProps = {
  titulo: string;
  subtitulo: string;
  valores: Record<string, number>;
  metaNumero?: number;
  mostrarPercentual?: boolean;
};

function FunilCard({ titulo, subtitulo, valores, metaNumero = 0, mostrarPercentual = true }: FunilProps) {
  const base = valores.leads || 0;
  return (
    <article className="panel dashboard-funnel-panel">
      <div className="section-title-row">
        <div>
          <span className="panel-kicker">Funil</span>
          <h2>{titulo}</h2>
        </div>
        <span className="panel-meta">{subtitulo}</span>
      </div>
      <div className="dashboard-funnel-shell">
        <div className="dashboard-funnel-graphic">
          {FUNIL_CORES.map((etapa, indice) => {
            const larguraTopo = 100 - indice * 18;
            const larguraBase = 100 - (indice + 1) * 18;
            return (
              <div
                key={etapa.chave}
                className="dashboard-funnel-segment"
                style={{
                  background: etapa.cor,
                  clipPath: `polygon(${(100 - larguraTopo) / 2}% 0%, ${(100 + larguraTopo) / 2}% 0%, ${(100 + larguraBase) / 2}% 100%, ${(100 - larguraBase) / 2}% 100%)`
                }}
              />
            );
          })}
        </div>
        <div className="dashboard-funnel-legend">
          {FUNIL_CORES.map((etapa) => (
            <div key={etapa.chave} className="dashboard-funnel-legend-row">
              <div className="dashboard-funnel-legend-title">
                <span className="dashboard-funnel-dot" style={{ background: etapa.cor }} />
                <strong>{etapa.rotulo}</strong>
              </div>
              <div className="dashboard-funnel-legend-values">
                <span>{valores[etapa.chave] || 0}</span>
                {mostrarPercentual ? <small>{formatoPercentual(valores[etapa.chave] || 0, base)}</small> : null}
              </div>
            </div>
          ))}
          {metaNumero > 0 ? (
            <div className="dashboard-funnel-ticket">
              <span>Ticket médio</span>
              <strong>{numeroParaMoedaBr(TICKET_MEDIO)}</strong>
              <span>Meta mensal</span>
              <strong>{numeroParaMoedaBr(metaNumero)}</strong>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function DashboardPage() {
  const [painel, setPainel] = useState<DashboardPainelApi>(DASHBOARD_VAZIO);
  const [crmPainel, setCrmPainel] = useState<CrmPainelApi>(CRM_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [metaEditavel, setMetaEditavel] = useState("");
  const [salvandoMeta, setSalvandoMeta] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const [dashboardResult, crmResult] = await Promise.allSettled([
        painelDashboardApi(),
        listarCrmApi()
      ]);

      if (dashboardResult.status === "fulfilled") {
        const resposta = dashboardResult.value;
        setPainel({
          ...DASHBOARD_VAZIO,
          ...resposta,
          meses: resposta.meses?.length ? resposta.meses : DASHBOARD_VAZIO.meses,
          serieVendas: resposta.serieVendas?.length ? resposta.serieVendas : DASHBOARD_VAZIO.serieVendas,
          metas: resposta.metas || DASHBOARD_VAZIO.metas
        });
        setMetaEditavel(resposta.metas?.metaMes || DASHBOARD_VAZIO.metas.metaMes);
      } else {
        setPainel(DASHBOARD_VAZIO);
        setMetaEditavel(DASHBOARD_VAZIO.metas.metaMes);
      }

      if (crmResult.status === "fulfilled") {
        setCrmPainel(crmResult.value || CRM_VAZIO);
      } else {
        setCrmPainel(CRM_VAZIO);
      }

      const falhas: string[] = [];
      if (dashboardResult.status === "rejected") falhas.push("dashboard");
      if (crmResult.status === "rejected") falhas.push("CRM");
      if (falhas.length) {
        setErro(`Alguns dados não carregaram: ${falhas.join(", ")}.`);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar dashboard.");
      setPainel(DASHBOARD_VAZIO);
      setCrmPainel(CRM_VAZIO);
      setMetaEditavel(DASHBOARD_VAZIO.metas.metaMes);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const maxValor = useMemo(() => {
    const meta = moedaParaNumero(painel.metas.metaMes);
    const supermeta = moedaParaNumero(painel.metas.supermetaMes);
    return Math.max(...painel.serieVendas, meta, supermeta, 1000);
  }, [painel.serieVendas, painel.metas.metaMes, painel.metas.supermetaMes]);

  const metaMesNumero = useMemo(() => moedaParaNumero(painel.metas.metaMes), [painel.metas.metaMes]);
  const supermetaMesNumero = useMemo(() => moedaParaNumero(painel.metas.supermetaMes), [painel.metas.supermetaMes]);
  const metaEditavelNumero = useMemo(() => moedaParaNumero(metaEditavel), [metaEditavel]);
  const funilMeta = useMemo(() => montarFunilMeta(metaEditavelNumero || metaMesNumero), [metaEditavelNumero, metaMesNumero]);
  const funilEvolucao = useMemo(() => montarFunilEvolucao(crmPainel), [crmPainel]);

  async function salvarMetaRapida() {
    try {
      setSalvandoMeta(true);
      const agora = new Date();
      await atualizarMetaFinanceiraApi(agora.getFullYear(), agora.getMonth() + 1, {
        meta: metaEditavelNumero || metaMesNumero,
        supermeta: moedaParaNumero(painel.metas.supermetaMes),
        hipermeta: moedaParaNumero(painel.metas.hipermetaMes)
      });
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar meta.");
    } finally {
      setSalvandoMeta(false);
    }
  }

  return (
    <>
      <section className="kpi-grid">
        {painel.indicadores.map((card) => (
          <article className="kpi-card" key={card.chave}>
            <div className="kpi-icon">{iconeIndicador(card.chave)}</div>
            <div className="kpi-title">{card.titulo}</div>
            <div className="kpi-value">{card.valor}</div>
            <div className="kpi-detail">{card.detalhe || "Atualizado pelo sistema"}</div>
            <div className="kpi-wave" />
          </article>
        ))}
        {!painel.indicadores.length && !carregando ? (
          <article className="panel dashboard-feedback">
            <strong>Sem dados no dashboard.</strong>
          </article>
        ) : null}
      </section>

      <section className="dashboard-funnels-grid">
        <FunilCard
          titulo="Meta ideal"
          subtitulo="Modelo 100 / 75 / 50 / 25"
          valores={funilMeta}
          metaNumero={metaEditavelNumero || metaMesNumero}
        />
        <FunilCard
          titulo="Evolução atual"
          subtitulo="Baseado no CRM"
          valores={funilEvolucao}
        />
      </section>

      <section className="content-grid">
        <article className="panel panel-chart">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Performance</span>
              <h2>Evolução mensal</h2>
            </div>
            <span className="panel-meta">Ano atual</span>
          </div>
          {erro ? <div className="dashboard-feedback">{erro}</div> : null}
          <div className="chart-area">
            <div className="chart-guides">
              {[0, maxValor * 0.25, maxValor * 0.5, maxValor * 0.75, maxValor].reverse().map((valor) => (
                <div key={valor} className="chart-guide-row">
                  <span>{Math.round(valor).toLocaleString("pt-BR")}</span>
                  <div className="chart-guide-line" />
                </div>
              ))}
            </div>
            <div className="chart-series">
              {metaMesNumero > 0 ? (
                <div className="line meta" style={{ bottom: `${(metaMesNumero / maxValor) * 100}%` }}>
                  <span>Meta: {painel.metas.metaMes}</span>
                </div>
              ) : null}
              {supermetaMesNumero > 0 ? (
                <div className="line super" style={{ bottom: `${(supermetaMesNumero / maxValor) * 100}%` }}>
                  <span>Supermeta: {painel.metas.supermetaMes}</span>
                </div>
              ) : null}
              <div className="bars">
                {painel.serieVendas.map((valor, index) => (
                  <div key={`${painel.meses[index] || index}`} className="bar-group">
                    <div className="bar" style={{ height: `${maxValor ? (valor / maxValor) * 100 : 0}%` }} />
                    <span>{painel.meses[index] || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>

        <div className="side-column">
          <article className="panel summary-panel">
            <div className="section-title-row">
              <div>
                <span className="panel-kicker">Metas</span>
                <h2>Meta e conversão</h2>
              </div>
              <Target size={20} />
            </div>
            <div className="summary-stats">
              <label className="dashboard-meta-editor">
                <span>Meta do mês</span>
                <input type="text" value={metaEditavel} onChange={(event) => setMetaEditavel(event.target.value)} />
              </label>
              <button type="button" className="primary-action" onClick={() => void salvarMetaRapida()} disabled={salvandoMeta}>
                {salvandoMeta ? "Salvando..." : "Salvar meta"}
              </button>
              <div className="summary-row">
                <span>Ticket médio</span>
                <strong>{numeroParaMoedaBr(TICKET_MEDIO)}</strong>
              </div>
              <div className="summary-row">
                <span>Leads necessários</span>
                <strong>{funilMeta.leads}</strong>
              </div>
              <div className="summary-row">
                <span>Agendamentos necessários</span>
                <strong>{funilMeta.agendou}</strong>
              </div>
              <div className="summary-row">
                <span>Comparecimentos necessários</span>
                <strong>{funilMeta.compareceu}</strong>
              </div>
              <div className="summary-row highlight">
                <span>Fechamentos necessários</span>
                <strong>{funilMeta.fechou}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
