import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Download, FileCheck2, RefreshCw, Search, TrendingUp, UsersRound, WalletCards } from "lucide-react";
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
  const [pessoa, setPessoa] = useState("TODAS");
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [status, setStatus] = useState("TODOS");

  async function carregar() {
    if (!inicio || !fim) return;
    setCarregando(true); setErro("");
    try { setDados(await relatorioComissoesApi(inicio, fim)); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar o relatório."); }
    finally { setCarregando(false); }
  }
  useEffect(() => { void carregar(); }, []);

  const pessoas = useMemo(() => dados ? Array.from(new Set(dados.vendas.flatMap((item) => [item.agendadorAvaliacao, item.agendadorFechamento]).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")) : [], [dados]);
  const statusDisponiveis = useMemo(() => dados ? Array.from(new Set(dados.vendas.map((item) => item.status).filter(Boolean))).sort() : [], [dados]);
  const vendasFiltradas = useMemo(() => (dados?.vendas || []).filter((item) => {
    const correspondePessoa = pessoa === "TODAS" || item.agendadorAvaliacao === pessoa || item.agendadorFechamento === pessoa;
    const termo = buscaPaciente.trim().toLocaleLowerCase("pt-BR");
    const correspondePaciente = !termo || item.paciente.toLocaleLowerCase("pt-BR").includes(termo) || String(item.contratoId).includes(termo);
    const correspondeStatus = status === "TODOS" || item.status === status;
    return correspondePessoa && correspondePaciente && correspondeStatus;
  }), [buscaPaciente, dados, pessoa, status]);
  const resumoPessoas = useMemo(() => {
    const mapa = new Map<string, { pessoa: string; contratos: Set<number>; captacao: number; resgate: number; total: number }>();
    const obter = (nome: string) => {
      const chave = nome || "Não localizado";
      if (!mapa.has(chave)) mapa.set(chave, { pessoa: chave, contratos: new Set<number>(), captacao: 0, resgate: 0, total: 0 });
      return mapa.get(chave)!;
    };
    vendasFiltradas.forEach((item) => {
      const captador = obter(item.agendadorAvaliacao);
      captador.contratos.add(item.contratoId); captador.captacao += item.comissaoCaptacao; captador.total += item.comissaoCaptacao;
      if (item.comissaoResgate > 0) { const resgatador = obter(item.agendadorFechamento); resgatador.contratos.add(item.contratoId); resgatador.resgate += item.comissaoResgate; resgatador.total += item.comissaoResgate; }
    });
    return Array.from(mapa.values()).map((item) => ({ ...item, quantidade: item.contratos.size })).sort((a, b) => b.total - a.total || a.pessoa.localeCompare(b.pessoa, "pt-BR"));
  }, [vendasFiltradas]);
  const totalVendidoFiltrado = vendasFiltradas.reduce((total, item) => total + item.valorContrato, 0);
  const totalComissaoFiltrada = vendasFiltradas.reduce((total, item) => total + item.comissaoTotal, 0);

  return <div className="commissions-page">
    <section className="commissions-hero">
      <div className="commissions-heading">
        <div><span className="eyebrow">Política de comissionamento</span><h2>Vendas e comissões</h2><p>Somente pacientes que compareceram à avaliação e fecharam contrato.</p></div>
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
        <article><i><FileCheck2 size={20}/></i><div><span>Vendas filtradas</span><strong>{vendasFiltradas.length}</strong></div></article>
        <article><i><TrendingUp size={20}/></i><div><span>Total vendido</span><strong>{moeda(totalVendidoFiltrado)}</strong></div></article>
        <article><i><WalletCards size={20}/></i><div><span>Comissão liberada</span><strong>{moeda(totalComissaoFiltrada)}</strong></div></article>
        <article><i><UsersRound size={20}/></i><div><span>Pessoas com comissão</span><strong>{resumoPessoas.length}</strong></div></article>
      </section>
      <section className="commissions-panel commissions-people-summary">
        <div className="commissions-panel-heading"><div><span className="eyebrow">Resumo individual</span><h2>Comissão por pessoa</h2></div><b>{resumoPessoas.length} pessoas</b></div>
        <div className="commissions-person-cards">{resumoPessoas.map((item) => <article key={item.pessoa}><div><span>Responsável</span><strong>{item.pessoa}</strong></div><dl><div><dt>Contratos</dt><dd>{item.quantidade}</dd></div><div><dt>Captação</dt><dd>{moeda(item.captacao)}</dd></div><div><dt>Resgate</dt><dd>{moeda(item.resgate)}</dd></div><div className="total"><dt>Total</dt><dd>{moeda(item.total)}</dd></div></dl></article>)}{!resumoPessoas.length ? <div className="commissions-empty">Nenhuma comissão para os filtros selecionados.</div> : null}</div>
      </section>
      <section className="commissions-panel">
        <div className="commissions-panel-heading"><div><span className="eyebrow">Compareceu e fechou</span><h2>Contratos com comissão</h2></div><b>{vendasFiltradas.length} registros</b></div>
        <div className="commissions-detail-filters"><label><span>Buscar paciente ou contrato</span><div><Search size={15}/><input value={buscaPaciente} onChange={(e) => setBuscaPaciente(e.target.value)} placeholder="Nome ou número"/></div></label><label><span>Pessoa</span><select value={pessoa} onChange={(e) => setPessoa(e.target.value)}><option value="TODAS">Todas</option>{pessoas.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</select></label><label><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="TODOS">Todos</option>{statusDisponiveis.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><button type="button" onClick={() => { setPessoa("TODAS"); setBuscaPaciente(""); setStatus("TODOS"); }}>Limpar filtros</button></div>
        <div className="commissions-table-wrap"><table><thead><tr>
          <th>Paciente</th><th>Fechamento</th><th>Valor</th><th>Pagamento</th><th>Primeiro agendador</th><th>Avaliação comparecida</th><th>Agendador da avaliação</th><th>Agendador do fechamento</th><th>Comissão</th><th>Divisão</th><th>Status</th>
        </tr></thead><tbody>{vendasFiltradas.map((item) => <tr key={item.contratoId}>
          <td className="commissions-patient"><strong>{item.paciente}</strong><small>Contrato #{item.contratoId}</small></td><td>{item.dataFechamento}</td><td className="commissions-money">{moeda(item.valorContrato)}</td><td>{item.formaPagamento || "-"}</td><td>{item.primeiroAgendador}<small>{item.primeiroAgendamento}</small></td><td>{item.avaliacaoComparecida || "-"}</td><td>{item.agendadorAvaliacao}</td><td>{item.agendadorFechamento}</td><td className="commissions-money">{moeda(item.comissaoTotal)}</td><td>{item.comissaoResgate ? <span className="commissions-split"><b>30% {moeda(item.comissaoCaptacao)}</b><b>70% {moeda(item.comissaoResgate)}</b></span> : moeda(item.comissaoCaptacao)}</td><td><span className={`commissions-status ${item.status.toLowerCase().includes("revisar") ? "warning" : "ok"}`}>{item.status}</span></td>
        </tr>)}{!vendasFiltradas.length ? <tr><td colSpan={11} className="commissions-empty">Nenhuma venda encontrada para os filtros selecionados.</td></tr> : null}</tbody></table></div>
      </section>
    </> : null}
  </div>;
}
