import { useEffect, useMemo, useState } from "react";
import { DollarSign, Target, TrendingUp } from "lucide-react";
import {
  atualizarMetaFinanceiraApi,
  listarCrmApi,
  painelDashboardApi,
  type CrmPainelApi,
  type DashboardCalendarioPagamentoItemApi,
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
  calendarioPagamentos: [],
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

const FUNIL_COR_NEUTRA = "#b9b4ab";

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

function dataAtualMesReferencia() {
  const agora = new Date();
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
}

function extrairAnoMes(valor?: string) {
  const texto = String(valor || "").trim();
  if (!texto) return null;
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { ano: Number(iso[1]), mes: Number(iso[2]) };
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return { ano: Number(br[3]), mes: Number(br[2]) };
  return null;
}

function dataEstaNoMesAtual(valor?: string) {
  const referencia = extrairAnoMes(valor);
  if (!referencia) return false;
  const atual = dataAtualMesReferencia();
  return referencia.ano === atual.ano && referencia.mes === atual.mes;
}

function hexParaRgb(hex: string) {
  const limpo = hex.replace("#", "");
  const expandido = limpo.length === 3 ? limpo.split("").map((parte) => `${parte}${parte}`).join("") : limpo;
  const numero = Number.parseInt(expandido, 16);
  return {
    r: (numero >> 16) & 255,
    g: (numero >> 8) & 255,
    b: numero & 255
  };
}

function misturarCores(base: string, destino: string, intensidade: number) {
  const origemRgb = hexParaRgb(base);
  const destinoRgb = hexParaRgb(destino);
  const peso = Math.max(0, Math.min(1, intensidade));
  return `rgb(${Math.round(origemRgb.r + (destinoRgb.r - origemRgb.r) * peso)}, ${Math.round(origemRgb.g + (destinoRgb.g - origemRgb.g) * peso)}, ${Math.round(origemRgb.b + (destinoRgb.b - origemRgb.b) * peso)})`;
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
    if (item.pacienteId && dataEstaNoMesAtual(item.atualizadoEm)) idsLeads.add(item.pacienteId);
    if (item.pacienteId && dataEstaNoMesAtual(item.atualizadoEm) && etapaEhAgendada(item.etapaFunil)) idsAgendados.add(item.pacienteId);
  });
  crm.finalizados.forEach((item) => {
    if (item.pacienteId && dataEstaNoMesAtual(item.finalizadoEm || item.atualizadoEm)) {
      idsLeads.add(item.pacienteId);
      idsAgendados.add(item.pacienteId);
    }
  });

  const idsCompareceu = new Set<number>();
  crm.avaliacoes.forEach((item) => {
    if (item.pacienteId && dataEstaNoMesAtual(item.dataAvaliacao)) {
      idsLeads.add(item.pacienteId);
      idsAgendados.add(item.pacienteId);
      idsCompareceu.add(item.pacienteId);
    }
  });

  const idsFechou = new Set<number>();
  crm.finalizados.forEach((item) => {
    if (item.pacienteId && dataEstaNoMesAtual(item.finalizadoEm || item.atualizadoEm)) idsFechou.add(item.pacienteId);
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

function montarDiasDoMesAtual() {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioGrade = new Date(inicio);
  const diaSemana = (inicio.getDay() + 6) % 7;
  inicioGrade.setDate(inicio.getDate() - diaSemana);
  return Array.from({ length: 35 }, (_, indice) => {
    const dia = new Date(inicioGrade);
    dia.setDate(inicioGrade.getDate() + indice);
    return dia;
  });
}

function diaIsoLocal(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function nomeMesAnoAtual() {
  const agora = new Date();
  return agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

type FunilProps = {
  titulo: string;
  subtitulo: string;
  valores: Record<string, number>;
  metasReferencia?: Record<string, number>;
  metaNumero?: number;
  mostrarPercentual?: boolean;
};

function FunilCard({ titulo, subtitulo, valores, metasReferencia, metaNumero = 0, mostrarPercentual = true }: FunilProps) {
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
            const metaEtapa = metasReferencia?.[etapa.chave] || 0;
            const progresso = metaEtapa > 0 ? Math.max(0, Math.min(1, (valores[etapa.chave] || 0) / metaEtapa)) : 1;
            const corEtapa = metasReferencia ? misturarCores(FUNIL_COR_NEUTRA, etapa.cor, progresso) : etapa.cor;
            return (
              <div
                key={etapa.chave}
                className="dashboard-funnel-segment"
                style={{
                  background: corEtapa,
                  clipPath: `polygon(${(100 - larguraTopo) / 2}% 0%, ${(100 + larguraTopo) / 2}% 0%, ${(100 + larguraBase) / 2}% 100%, ${(100 - larguraBase) / 2}% 100%)`
                }}
              />
            );
          })}
        </div>
        <div className="dashboard-funnel-legend">
          {FUNIL_CORES.map((etapa) => {
            const metaEtapa = metasReferencia?.[etapa.chave] || 0;
            const progresso = metaEtapa > 0 ? Math.max(0, Math.min(1, (valores[etapa.chave] || 0) / metaEtapa)) : 1;
            const corEtapa = metasReferencia ? misturarCores(FUNIL_COR_NEUTRA, etapa.cor, progresso) : etapa.cor;
            return (
              <div key={etapa.chave} className="dashboard-funnel-legend-row">
                <div className="dashboard-funnel-legend-title">
                  <span className="dashboard-funnel-dot" style={{ background: corEtapa }} />
                  <strong>{etapa.rotulo}</strong>
                </div>
                <div className="dashboard-funnel-legend-values">
                  <span>{valores[etapa.chave] || 0}</span>
                  {mostrarPercentual ? <small>{formatoPercentual(valores[etapa.chave] || 0, base)}</small> : null}
                  {metaEtapa > 0 ? <small>{`Meta ${metaEtapa} · ${Math.round(progresso * 100)}%`}</small> : null}
                </div>
              </div>
            );
          })}
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
  const calendarioPagamentos = useMemo(() => {
    const mapa = new Map<string, DashboardCalendarioPagamentoItemApi>();
    (painel.calendarioPagamentos || []).forEach((item) => {
      if (item.data) mapa.set(item.data, item);
    });
    return mapa;
  }, [painel.calendarioPagamentos]);
  const diasCalendario = useMemo(() => montarDiasDoMesAtual(), []);

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
          subtitulo="Baseado no CRM do mês"
          valores={funilEvolucao}
          metasReferencia={funilMeta}
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

          <article className="panel summary-panel">
            <div className="section-title-row">
              <div>
                <span className="panel-kicker">Financeiro</span>
                <h2>Calendário de pagamentos</h2>
              </div>
              <span className="panel-meta">{nomeMesAnoAtual()}</span>
            </div>
            <div className="mini-calendar-weekdays">
              {["S", "T", "Q", "Q", "S", "S", "D"].map((dia, indice) => <span key={`${dia}-${indice}`}>{dia}</span>)}
            </div>
            <div className="mini-calendar-grid dashboard-payment-calendar">
              {diasCalendario.map((dia) => {
                const chave = diaIsoLocal(dia);
                const item = calendarioPagamentos.get(chave);
                const mesAtual = dia.getMonth() === new Date().getMonth();
                return (
                  <div key={chave} className={`dashboard-payment-day${mesAtual ? "" : " muted"}${item ? " has-value" : ""}`}>
                    <strong>{dia.getDate()}</strong>
                    <span>{item?.quantidade ? `${item.quantidade} pagamento(s)` : ""}</span>
                    <small>{item?.total || ""}</small>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
