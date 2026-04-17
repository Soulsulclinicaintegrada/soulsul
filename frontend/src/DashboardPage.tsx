import { useEffect, useMemo, useState } from "react";
import { DollarSign, Target, TrendingUp, X } from "lucide-react";
import {
  atualizarMetaFinanceiraApi,
  painelDashboardApi,
  type ContaPagarResumoApi,
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

const TICKET_MEDIO = 4000;

const FUNIL_CORES = [
  { chave: "leads", rotulo: "Leads", cor: "#5b64b5" },
  { chave: "agendou", rotulo: "Agendou", cor: "#42c0c7" },
  { chave: "compareceu", rotulo: "Compareceu", cor: "#f2898c" },
  { chave: "fechou", rotulo: "Fechou", cor: "#efc449" }
] as const;

const FUNIL_COR_NEUTRA = "#b9b4ab";

function moedaParaNumero(valor: string) {
  return Number(String(valor || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
}

function numeroParaMoedaBr(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

function formatarDataDetalhada(dataIso?: string) {
  if (!dataIso) return "";
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const data = new Date(ano, (mes || 1) - 1, dia || 1);
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
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

function PagamentoDiaModal({
  item,
  onFechar
}: {
  item: DashboardCalendarioPagamentoItemApi;
  onFechar: () => void;
}) {
  const pagamentos = item.pagamentos || [];
  return (
    <div className="overlay" role="presentation" onClick={onFechar}>
      <div className="modal-shell dashboard-payment-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="panel-kicker">Financeiro</span>
            <h2>Pagamentos do dia</h2>
            <span className="panel-meta">{formatarDataDetalhada(item.data)}</span>
          </div>
          <button type="button" className="icon-action" onClick={onFechar} aria-label="Fechar pagamentos do dia">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body dashboard-payment-modal-body">
          <div className="dashboard-payment-modal-summary">
            <div className="summary-row">
              <span>Total previsto</span>
              <strong>{item.total || "R$ 0,00"}</strong>
            </div>
            <div className="summary-row">
              <span>Pagamentos</span>
              <strong>{item.quantidade || 0}</strong>
            </div>
          </div>
          <div className="dashboard-payment-list">
            {pagamentos.length ? (
              pagamentos.map((pagamento: ContaPagarResumoApi) => (
                <article className="dashboard-payment-entry" key={pagamento.id}>
                  <div className="dashboard-payment-entry-main">
                    <strong>{pagamento.descricao || "Pagamento sem descrição"}</strong>
                    <span>{pagamento.fornecedor || pagamento.categoria || "Sem fornecedor informado"}</span>
                  </div>
                  <div className="dashboard-payment-entry-meta">
                    <strong>{pagamento.valor}</strong>
                    <small>{pagamento.status || "A vencer"}</small>
                  </div>
                </article>
              ))
            ) : (
              <div className="dashboard-feedback">Nenhum pagamento pendente nesse dia.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [painel, setPainel] = useState<DashboardPainelApi>(DASHBOARD_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [metaEditavel, setMetaEditavel] = useState("");
  const [salvandoMeta, setSalvandoMeta] = useState(false);
  const [pagamentoDiaAtivo, setPagamentoDiaAtivo] = useState<DashboardCalendarioPagamentoItemApi | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await painelDashboardApi();
      setPainel({
        ...DASHBOARD_VAZIO,
        ...resposta,
        meses: resposta.meses?.length ? resposta.meses : DASHBOARD_VAZIO.meses,
        serieVendas: resposta.serieVendas?.length ? resposta.serieVendas : DASHBOARD_VAZIO.serieVendas,
        metas: resposta.metas || DASHBOARD_VAZIO.metas
      });
      setMetaEditavel(resposta.metas?.metaMes || DASHBOARD_VAZIO.metas.metaMes);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar dashboard.");
      setPainel(DASHBOARD_VAZIO);
      setMetaEditavel(DASHBOARD_VAZIO.metas.metaMes);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const metaMesNumero = useMemo(() => moedaParaNumero(painel.metas.metaMes), [painel.metas.metaMes]);
  const metaEditavelNumero = useMemo(() => moedaParaNumero(metaEditavel), [metaEditavel]);
  const funilMeta = useMemo(() => montarFunilMeta(metaEditavelNumero || metaMesNumero), [metaEditavelNumero, metaMesNumero]);
  const funilEvolucao = useMemo(
    () => ({
      leads: painel.funilReal?.leads || 0,
      agendou: painel.funilReal?.agendou || 0,
      compareceu: painel.funilReal?.compareceu || 0,
      fechou: painel.funilReal?.fechou || 0
    }),
    [painel.funilReal]
  );
  const calendarioPagamentos = useMemo(() => {
    const mapa = new Map<string, DashboardCalendarioPagamentoItemApi>();
    (painel.calendarioPagamentos || []).forEach((item) => {
      if (item.data) mapa.set(item.data, item);
    });
    return mapa;
  }, [painel.calendarioPagamentos]);
  const diasCalendario = useMemo(() => montarDiasDoMesAtual(), []);
  const hoje = useMemo(() => diaIsoLocal(new Date()), []);

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
          subtitulo="Baseado em agenda e contratos reais do mês"
          valores={funilEvolucao}
          metasReferencia={funilMeta}
        />
      </section>

      <section className="content-grid">
        <article className="panel dashboard-calendar-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Financeiro</span>
              <h2>Calendário de pagamentos</h2>
            </div>
            <span className="panel-meta">{nomeMesAnoAtual()}</span>
          </div>
          {erro ? <div className="dashboard-feedback">{erro}</div> : null}
          <div className="mini-calendar-weekdays dashboard-calendar-weekdays">
            {["S", "T", "Q", "Q", "S", "S", "D"].map((dia, indice) => <span key={`${dia}-${indice}`}>{dia}</span>)}
          </div>
          <div className="mini-calendar-grid dashboard-payment-calendar dashboard-payment-calendar-large">
            {diasCalendario.map((dia) => {
              const chave = diaIsoLocal(dia);
              const item = calendarioPagamentos.get(chave);
              const mesAtual = dia.getMonth() === new Date().getMonth();
              const isHoje = chave === hoje;
              const classe = `dashboard-payment-day${mesAtual ? "" : " muted"}${item ? " has-value" : ""}${isHoje ? " today" : ""}`;
              return (
                <button
                  key={chave}
                  type="button"
                  className={classe}
                  disabled={!item}
                  onClick={() => item && setPagamentoDiaAtivo(item)}
                >
                  <strong>{dia.getDate()}</strong>
                  <span>{item?.quantidade ? `${item.quantidade} pagamento(s)` : "Sem pagamentos"}</span>
                  <small>{item?.total || ""}</small>
                </button>
              );
            })}
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

      {pagamentoDiaAtivo ? <PagamentoDiaModal item={pagamentoDiaAtivo} onFechar={() => setPagamentoDiaAtivo(null)} /> : null}
    </>
  );
}
