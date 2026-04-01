import { useEffect, useMemo, useState } from "react";
import { DollarSign, Target, TrendingUp } from "lucide-react";
import { painelDashboardApi, type DashboardPainelApi } from "./pacientesApi";

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

function moedaParaNumero(valor: string) {
  return Number(valor.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

export function DashboardPage() {
  const [painel, setPainel] = useState<DashboardPainelApi>(DASHBOARD_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErro("");
      try {
        const resposta = await painelDashboardApi();
        if (!ativo) return;
        setPainel({
          ...DASHBOARD_VAZIO,
          ...resposta,
          meses: resposta.meses?.length ? resposta.meses : DASHBOARD_VAZIO.meses,
          serieVendas: resposta.serieVendas?.length ? resposta.serieVendas : DASHBOARD_VAZIO.serieVendas,
          metas: resposta.metas || DASHBOARD_VAZIO.metas
        });
      } catch (error) {
        if (!ativo) return;
        setErro(error instanceof Error ? error.message : "Falha ao carregar dashboard.");
        setPainel(DASHBOARD_VAZIO);
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, []);

  const maxValor = useMemo(() => {
    const meta = moedaParaNumero(painel.metas.metaMes);
    const supermeta = moedaParaNumero(painel.metas.supermetaMes);
    return Math.max(...painel.serieVendas, meta, supermeta, 1000);
  }, [painel.serieVendas, painel.metas.metaMes, painel.metas.supermetaMes]);

  const metaMesNumero = useMemo(() => moedaParaNumero(painel.metas.metaMes), [painel.metas.metaMes]);
  const supermetaMesNumero = useMemo(() => moedaParaNumero(painel.metas.supermetaMes), [painel.metas.supermetaMes]);

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
                <h2>Resumo financeiro</h2>
              </div>
              <Target size={20} />
            </div>
            <div className="summary-stats">
              <div className="summary-row">
                <span>Meta do mês</span>
                <strong>{painel.metas.metaMes}</strong>
              </div>
              <div className="summary-row">
                <span>Supermeta do mês</span>
                <strong>{painel.metas.supermetaMes}</strong>
              </div>
              <div className="summary-row">
                <span>Hipermeta do mês</span>
                <strong>{painel.metas.hipermetaMes}</strong>
              </div>
              <div className="summary-row">
                <span>Falta para meta do mês</span>
                <strong>{painel.metas.faltaMetaMes}</strong>
              </div>
              <div className="summary-row highlight">
                <span>Falta para meta do ano</span>
                <strong>{painel.metas.faltaMetaAno}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
