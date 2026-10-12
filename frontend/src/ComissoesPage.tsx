import { useEffect, useState } from "react";
import { CalendarRange, Download, FileCheck2, RefreshCw, TrendingUp, UsersRound, WalletCards } from "lucide-react";
import { relatorioComissoesApi, urlExportarRelatorioComissoes, type RelatorioComissoesApi } from "./pacientesApi";

function isoHoje() { return new Date().toISOString().slice(0, 10); }
function inicioMes() { const hoje = isoHoje(); return `${hoje.slice(0, 8)}01`; }
function moeda(valor: number) { return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export function ComissoesPage() {
  const [inicio, setInicio] = useState(inicioMes());
  const [fim, setFim] = useState(isoHoje());
  const [dados, setDados] = useState<RelatorioComissoesApi | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function carregar() {
    if (!inicio || !fim) return;
    setCarregando(true); setErro("");
    try { setDados(await relatorioComissoesApi(inicio, fim)); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar o relatório."); }
    finally { setCarregando(false); }
  }
  useEffect(() => { void carregar(); }, []);

  return <div className="commissions-page">
    <section className="commissions-hero">
      <div className="commissions-heading">
        <div><span className="eyebrow">Política de comissionamento</span><h2>Vendas, avaliações e comissões</h2><p>Confira contratos, responsáveis e valores de comissão em um único relatório.</p></div>
        <a className="commissions-export" href={urlExportarRelatorioComissoes(inicio, fim)} target="_blank" rel="noreferrer"><Download size={17}/> Exportar Excel</a>
      </div>
      <div className="commissions-filters">
        <label><span>Data inicial</span><div><CalendarRange size={16}/><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div></label>
        <label><span>Data final</span><div><CalendarRange size={16}/><input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div></label>
        <button type="button" onClick={() => void carregar()} disabled={carregando}><RefreshCw size={17}/>{carregando ? "Carregando..." : "Gerar relatório"}</button>
      </div>
      <div className="commissions-policy"><strong>Regras aplicadas</strong><span>PIX/dinheiro: 1%</span><span>Cartão: 0,6%</span><span>Boleto: 0,4%</span><span>Misto proporcional</span><span>Captação/resgate: 30%/70%</span><span>Permutas excluídas</span></div>
      {erro ? <div className="form-feedback error">{erro}</div> : null}
    </section>

    {dados ? <>
      <section className="commissions-metrics">
        <article><i><FileCheck2 size={20}/></i><div><span>Vendas</span><strong>{dados.vendas.length}</strong></div></article>
        <article><i><TrendingUp size={20}/></i><div><span>Total vendido</span><strong>{moeda(dados.totalVendido)}</strong></div></article>
        <article><i><WalletCards size={20}/></i><div><span>Comissão liberada</span><strong>{moeda(dados.totalComissao)}</strong></div></article>
        <article><i><UsersRound size={20}/></i><div><span>Avaliações comparecidas</span><strong>{dados.avaliacoes.length}</strong></div></article>
      </section>
      <section className="commissions-panel">
        <div className="commissions-panel-heading"><div><span className="eyebrow">Contratos aprovados</span><h2>Vendas do período</h2></div><b>{dados.vendas.length} registros</b></div>
        <div className="commissions-table-wrap"><table><thead><tr>
          <th>Paciente</th><th>Fechamento</th><th>Valor</th><th>Pagamento</th><th>Primeiro agendador</th><th>Avaliação comparecida</th><th>Agendador da avaliação</th><th>Agendador do fechamento</th><th>Comissão</th><th>Divisão</th><th>Status</th>
        </tr></thead><tbody>{dados.vendas.map((item) => <tr key={item.contratoId}>
          <td className="commissions-patient"><strong>{item.paciente}</strong><small>Contrato #{item.contratoId}</small></td><td>{item.dataFechamento}</td><td className="commissions-money">{moeda(item.valorContrato)}</td><td>{item.formaPagamento || "-"}</td><td>{item.primeiroAgendador}<small>{item.primeiroAgendamento}</small></td><td>{item.avaliacaoComparecida || "-"}</td><td>{item.agendadorAvaliacao}</td><td>{item.agendadorFechamento}</td><td className="commissions-money">{moeda(item.comissaoTotal)}</td><td>{item.comissaoResgate ? <span className="commissions-split"><b>30% {moeda(item.comissaoCaptacao)}</b><b>70% {moeda(item.comissaoResgate)}</b></span> : moeda(item.comissaoCaptacao)}</td><td><span className={`commissions-status ${item.status.toLowerCase().includes("revisar") ? "warning" : "ok"}`}>{item.status}</span></td>
        </tr>)}{!dados.vendas.length ? <tr><td colSpan={11} className="commissions-empty">Nenhuma venda encontrada no período.</td></tr> : null}</tbody></table></div>
      </section>
      <section className="commissions-panel">
        <div className="commissions-panel-heading"><div><span className="eyebrow">Comparecimento real</span><h2>Avaliações comparecidas</h2></div><b>{dados.avaliacoes.length} registros</b></div>
        <div className="commissions-table-wrap compact"><table><thead><tr><th>Paciente</th><th>Data</th><th>Hora</th><th>Quem agendou</th><th>Agendado em</th><th>Procedimentos</th></tr></thead><tbody>
          {dados.avaliacoes.map((item) => <tr key={item.agendamentoId}><td><strong>{item.paciente}</strong></td><td>{item.data}</td><td>{item.hora}</td><td>{item.agendadoPor}</td><td>{item.agendadoEm}</td><td>{item.procedimentos || "-"}</td></tr>)}
          {!dados.avaliacoes.length ? <tr><td colSpan={6} className="commissions-empty">Nenhuma avaliação comparecida no período.</td></tr> : null}
        </tbody></table></div>
      </section>
    </> : null}
  </div>;
}
