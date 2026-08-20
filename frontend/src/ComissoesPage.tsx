import { useEffect, useState } from "react";
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

  return <div className="module-page">
    <section className="module-panel">
      <div className="module-panel-heading">
        <div><span className="eyebrow">Política de comissionamento</span><h2>Vendas, avaliações e comissões</h2></div>
        <a className="primary-action" href={urlExportarRelatorioComissoes(inicio, fim)} target="_blank" rel="noreferrer">Exportar Excel</a>
      </div>
      <div className="finance-form-grid">
        <label><span>Data inicial</span><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
        <label><span>Data final</span><input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
        <div className="finance-form-actions"><button className="primary-action" type="button" onClick={() => void carregar()} disabled={carregando}>{carregando ? "Carregando..." : "Gerar relatório"}</button></div>
      </div>
      <p className="module-muted">PIX/dinheiro: 1% · cartão: 0,6% · boleto: 0,4% · pagamento misto proporcional. Quando captação e resgate são diferentes, a divisão é 30%/70%. Permutas são excluídas.</p>
      {erro ? <div className="form-feedback error">{erro}</div> : null}
    </section>

    {dados ? <>
      <section className="dashboard-metrics-grid">
        <article className="metric-card"><span>Vendas</span><strong>{dados.vendas.length}</strong></article>
        <article className="metric-card"><span>Total vendido</span><strong>{moeda(dados.totalVendido)}</strong></article>
        <article className="metric-card"><span>Comissão liberada</span><strong>{moeda(dados.totalComissao)}</strong></article>
        <article className="metric-card"><span>Avaliações comparecidas</span><strong>{dados.avaliacoes.length}</strong></article>
      </section>
      <section className="module-panel">
        <div className="module-panel-heading"><div><span className="eyebrow">Contratos aprovados</span><h2>Vendas do período</h2></div></div>
        <div className="finance-table-wrap"><table className="finance-table"><thead><tr>
          <th>Paciente</th><th>Fechamento</th><th>Valor</th><th>Pagamento</th><th>Primeiro agendador</th><th>Avaliação comparecida</th><th>Agendador da avaliação</th><th>Agendador do fechamento</th><th>Comissão</th><th>Divisão</th><th>Status</th>
        </tr></thead><tbody>{dados.vendas.map((item) => <tr key={item.contratoId}>
          <td><strong>{item.paciente}</strong><small>Contrato #{item.contratoId}</small></td><td>{item.dataFechamento}</td><td>{moeda(item.valorContrato)}</td><td>{item.formaPagamento || "-"}</td><td>{item.primeiroAgendador}<small>{item.primeiroAgendamento}</small></td><td>{item.avaliacaoComparecida || "-"}</td><td>{item.agendadorAvaliacao}</td><td>{item.agendadorFechamento}</td><td>{moeda(item.comissaoTotal)}</td><td>{item.comissaoResgate ? `30% ${moeda(item.comissaoCaptacao)} / 70% ${moeda(item.comissaoResgate)}` : moeda(item.comissaoCaptacao)}</td><td>{item.status}</td>
        </tr>)}</tbody></table></div>
      </section>
      <section className="module-panel">
        <div className="module-panel-heading"><div><span className="eyebrow">Comparecimento real</span><h2>Avaliações comparecidas</h2></div></div>
        <div className="finance-table-wrap"><table className="finance-table"><thead><tr><th>Paciente</th><th>Data</th><th>Hora</th><th>Quem agendou esta avaliação</th><th>Agendado em</th><th>Procedimentos</th></tr></thead><tbody>
          {dados.avaliacoes.map((item) => <tr key={item.agendamentoId}><td><strong>{item.paciente}</strong></td><td>{item.data}</td><td>{item.hora}</td><td>{item.agendadoPor}</td><td>{item.agendadoEm}</td><td>{item.procedimentos || "-"}</td></tr>)}
        </tbody></table></div>
      </section>
    </> : null}
  </div>;
}


