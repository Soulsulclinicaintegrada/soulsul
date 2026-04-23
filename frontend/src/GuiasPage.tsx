import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  criarOrdemServicoPacienteApi,
  fichaPacienteApi,
  listarOrdensServicoPacienteApi,
  listarPacientesApi,
  listarProcedimentosApi,
  type FichaPacienteApi,
  type OrdemServicoResumoApi,
  type PacienteResumoApi,
  type ProcedimentoResumoApi
} from "./pacientesApi";

type OrdemServicoForm = {
  procedimentoId: string;
  cor: string;
  escala: string;
  elementoArcada: string;
  cargaImediata: boolean;
  retornoSolicitado: string;
  observacao: string;
  etapas: Array<{ id: number; etapa: string; descricaoOutro: string }>;
};

type ProcedimentoCatalogo = {
  id: number;
  nome: string;
  etapasPadrao: string[];
  ativo: boolean;
};

const ORDEM_SERVICO_INICIAL: OrdemServicoForm = {
  procedimentoId: "",
  cor: "",
  escala: "",
  elementoArcada: "",
  cargaImediata: false,
  retornoSolicitado: "",
  observacao: "",
  etapas: [{ id: Date.now(), etapa: "", descricaoOutro: "" }]
};

function normalizarTextoComparacao(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function mapProcedimentoCatalogoApi(item: ProcedimentoResumoApi): ProcedimentoCatalogo {
  return {
    id: item.id,
    nome: item.nome,
    etapasPadrao: item.etapasPadrao || [],
    ativo: item.ativo
  };
}

function redefinirFormulario(procedimentoId = ""): OrdemServicoForm {
  return {
    procedimentoId,
    cor: "",
    escala: "",
    elementoArcada: "",
    cargaImediata: false,
    retornoSolicitado: "",
    observacao: "",
    etapas: [{ id: Date.now(), etapa: "", descricaoOutro: "" }]
  };
}

export function GuiasPage() {
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [pacientes, setPacientes] = useState<PacienteResumoApi[]>([]);
  const [pacienteSelecionadoId, setPacienteSelecionadoId] = useState<number | null>(null);
  const [ficha, setFicha] = useState<FichaPacienteApi | null>(null);
  const [procedimentosCatalogo, setProcedimentosCatalogo] = useState<ProcedimentoCatalogo[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServicoResumoApi[]>([]);
  const [ordemServicoForm, setOrdemServicoForm] = useState<OrdemServicoForm>(ORDEM_SERVICO_INICIAL);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [carregandoPaciente, setCarregandoPaciente] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    listarProcedimentosApi("")
      .then((lista) => {
        if (!ativo) return;
        setProcedimentosCatalogo(lista.map(mapProcedimentoCatalogoApi));
      })
      .catch(() => {
        if (!ativo) return;
        setProcedimentosCatalogo([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCarregandoLista(true);
      listarPacientesApi(buscaPaciente, buscaPaciente.trim() ? 20 : 12)
        .then((lista) => {
          setPacientes(lista);
          if (!pacienteSelecionadoId && lista[0]?.id) {
            setPacienteSelecionadoId(lista[0].id);
          }
        })
        .catch(() => {
          setPacientes([]);
        })
        .finally(() => setCarregandoLista(false));
    }, buscaPaciente.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [buscaPaciente, pacienteSelecionadoId]);

  useEffect(() => {
    if (!pacienteSelecionadoId) return;
    setCarregandoPaciente(true);
    setErro(null);
    Promise.all([
      fichaPacienteApi(pacienteSelecionadoId),
      listarOrdensServicoPacienteApi(pacienteSelecionadoId).catch(() => [])
    ])
      .then(([dadosFicha, ordens]) => {
        setFicha(dadosFicha);
        setOrdensServico(ordens);
      })
      .catch((error) => {
        setErro(error instanceof Error ? error.message : "Falha ao carregar dados do paciente.");
        setFicha(null);
        setOrdensServico([]);
      })
      .finally(() => setCarregandoPaciente(false));
  }, [pacienteSelecionadoId]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const pacienteSelecionado = useMemo(
    () => pacientes.find((item) => item.id === pacienteSelecionadoId) || ficha?.paciente || null,
    [ficha?.paciente, pacienteSelecionadoId, pacientes]
  );

  const procedimentoSelecionado = useMemo(
    () => procedimentosCatalogo.find((item) => item.id === Number(ordemServicoForm.procedimentoId)) || null,
    [ordemServicoForm.procedimentoId, procedimentosCatalogo]
  );

  const procedimentosContratadosPaciente = useMemo(() => {
    const nomesContratados = new Set(
      (ficha?.contratos || [])
        .filter((contrato) => (contrato.status || "").toUpperCase() === "APROVADO")
        .flatMap((contrato) => contrato.procedimentos || [])
        .map((nome) => normalizarTextoComparacao(nome))
        .filter(Boolean)
    );
    return procedimentosCatalogo.filter((item) => item.ativo !== false && nomesContratados.has(normalizarTextoComparacao(item.nome)));
  }, [ficha?.contratos, procedimentosCatalogo]);

  function adicionarEtapa() {
    setOrdemServicoForm((atual) => ({
      ...atual,
      etapas: [...atual.etapas, { id: Date.now(), etapa: "", descricaoOutro: "" }]
    }));
  }

  function atualizarEtapa(etapaId: number, parcial: Partial<{ etapa: string; descricaoOutro: string }>) {
    setOrdemServicoForm((atual) => ({
      ...atual,
      etapas: atual.etapas.map((item) =>
        item.id === etapaId
          ? {
              ...item,
              ...parcial,
              descricaoOutro: parcial.etapa && parcial.etapa !== "Outro" ? "" : (parcial.descricaoOutro ?? item.descricaoOutro)
            }
          : item
      )
    }));
  }

  function removerEtapa(etapaId: number) {
    setOrdemServicoForm((atual) => ({
      ...atual,
      etapas: atual.etapas.length <= 1 ? atual.etapas : atual.etapas.filter((item) => item.id !== etapaId)
    }));
  }

  async function salvarGuia() {
    if (!pacienteSelecionadoId || !procedimentoSelecionado) return;
    const etapas = ordemServicoForm.etapas
      .map((item) => ({
        etapa: item.etapa.trim(),
        descricao_outro: item.descricaoOutro.trim()
      }))
      .filter((item) => item.etapa);

    if (!etapas.length) {
      setErro("Selecione ao menos uma etapa para a ordem de serviço.");
      return;
    }
    if (etapas.some((item) => item.etapa === "Outro" && !item.descricao_outro)) {
      setErro("Descreva a etapa quando selecionar Outro.");
      return;
    }
    if (!ordemServicoForm.elementoArcada.trim()) {
      setErro("Informe o elemento ou arcada.");
      return;
    }
    if (!ordemServicoForm.retornoSolicitado) {
      setErro("Informe a data de retorno solicitada.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const ordem = await criarOrdemServicoPacienteApi(pacienteSelecionadoId, {
        procedimento_id: procedimentoSelecionado.id,
        material: "",
        material_outro: "",
        cor: ordemServicoForm.cor,
        escala: ordemServicoForm.escala,
        elemento_arcada: ordemServicoForm.elementoArcada,
        carga_imediata: ordemServicoForm.cargaImediata,
        retorno_solicitado: ordemServicoForm.retornoSolicitado,
        observacao: ordemServicoForm.observacao,
        etapas
      });
      setOrdensServico((atual) => [ordem, ...atual]);
      setOrdemServicoForm(redefinirFormulario(""));
      setFeedback("Guia salva com sucesso.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar guia.");
    } finally {
      setSalvando(false);
    }
  }

  const etapasPadrao = procedimentoSelecionado?.etapasPadrao || [];
  const opcoesEtapa = [...etapasPadrao, "Outro"];

  return (
    <section className="guides-shell">
      <aside className="panel guides-sidebar">
        <div className="section-title-row">
          <div>
            <span className="panel-kicker">Menu rápido</span>
            <h2>Guias</h2>
          </div>
        </div>
        <label className="guides-search">
          <Search size={16} />
          <input
            value={buscaPaciente}
            onChange={(event) => setBuscaPaciente(event.target.value)}
            placeholder="Buscar paciente, prontuário ou telefone"
          />
        </label>
        <div className="guides-patient-list">
          {carregandoLista ? <span className="empty-inline">Carregando pacientes...</span> : null}
          {!carregandoLista && !pacientes.length ? <span className="empty-inline">Nenhum paciente encontrado.</span> : null}
          {pacientes.map((paciente) => (
            <button
              key={paciente.id}
              type="button"
              className={`guides-patient-card${paciente.id === pacienteSelecionadoId ? " active" : ""}`}
              onClick={() => setPacienteSelecionadoId(paciente.id)}
            >
              <strong>{paciente.nome}</strong>
              <span>{paciente.prontuario || "Sem prontuário"}</span>
              <small>{paciente.telefone || "Sem telefone"}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="panel guides-main">
        <div className="guides-main-header">
          <div>
            <span className="panel-kicker">Ordem de serviço</span>
            <h2>{pacienteSelecionado?.nome || "Selecione um paciente"}</h2>
            <p>
              {pacienteSelecionado
                ? `Prontuário ${pacienteSelecionado.prontuario || "não informado"}`
                : "Escolha um paciente à esquerda para emitir a guia sem entrar na ficha completa."}
            </p>
          </div>
        </div>

        {erro ? <div className="crm-inline-alert">{erro}</div> : null}
        {feedback ? <div className="dashboard-note success">{feedback}</div> : null}
        {carregandoPaciente ? <span className="empty-inline">Carregando dados do paciente...</span> : null}

        {!carregandoPaciente && pacienteSelecionado ? (
          <>
            <div className="guides-summary-grid">
              <article className="dashboard-card">
                <span>Procedimentos contratados</span>
                <strong>{procedimentosContratadosPaciente.length}</strong>
                <small>Somente contratos aprovados entram aqui.</small>
              </article>
              <article className="dashboard-card">
                <span>Guias emitidas</span>
                <strong>{ordensServico.length}</strong>
                <small>Histórico rápido do paciente.</small>
              </article>
            </div>

            <div className="clinical-panel">
              <div className="clinical-panel-header">
                <div>
                  <strong>Nova guia</strong>
                  <span>Preencha e salve a ordem de serviço diretamente por aqui.</span>
                </div>
              </div>

              <div className="users-create-grid procedures-form-grid">
                <label className="procedures-form-wide">
                  <span>Procedimento</span>
                  <select
                    value={ordemServicoForm.procedimentoId}
                    onChange={(event) => setOrdemServicoForm(redefinirFormulario(event.target.value))}
                    disabled={!procedimentosContratadosPaciente.length}
                  >
                    <option value="">{procedimentosContratadosPaciente.length ? "Selecione" : "Nenhum procedimento contratado"}</option>
                    {procedimentosContratadosPaciente.map((item) => (
                      <option key={item.id} value={item.id}>{item.nome}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Elemento ou arcada</span>
                  <input
                    value={ordemServicoForm.elementoArcada}
                    onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, elementoArcada: event.target.value }))}
                    placeholder="Ex.: 11, 21 ou Arcada superior"
                  />
                </label>

                <label>
                  <span>Escala</span>
                  <input
                    value={ordemServicoForm.escala}
                    onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, escala: event.target.value }))}
                    placeholder="Informe a escala"
                  />
                </label>

                <label>
                  <span>Cor</span>
                  <input
                    value={ordemServicoForm.cor}
                    onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, cor: event.target.value }))}
                    placeholder="Informe a cor"
                  />
                </label>

                <label>
                  <span>Data de retorno solicitada</span>
                  <input
                    type="date"
                    value={ordemServicoForm.retornoSolicitado}
                    onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, retornoSolicitado: event.target.value }))}
                  />
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={ordemServicoForm.cargaImediata}
                    onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, cargaImediata: event.target.checked }))}
                  />
                  <span>Carga imediata</span>
                </label>

                {procedimentoSelecionado ? (
                  <div className="procedures-form-wide os-steps-box">
                    <div className="clinical-panel-header compact">
                      <div>
                        <strong>Etapas</strong>
                        <span>Selecione as etapas da guia. Se usar Outro, a descrição é obrigatória.</span>
                      </div>
                      <button type="button" className="ghost-action" onClick={adicionarEtapa}>Adicionar etapa</button>
                    </div>
                    <div className="os-steps-list">
                      {ordemServicoForm.etapas.map((item) => (
                        <div key={item.id} className="os-step-row">
                          <select value={item.etapa} onChange={(event) => atualizarEtapa(item.id, { etapa: event.target.value })}>
                            <option value="">Selecione a etapa</option>
                            {opcoesEtapa.map((opcao) => (
                              <option key={opcao} value={opcao}>{opcao}</option>
                            ))}
                          </select>
                          {item.etapa === "Outro" ? (
                            <input
                              value={item.descricaoOutro}
                              onChange={(event) => atualizarEtapa(item.id, { descricaoOutro: event.target.value })}
                              placeholder="Descreva a etapa"
                            />
                          ) : (
                            <input value={item.etapa} readOnly placeholder="Etapa selecionada" />
                          )}
                          <button type="button" className="ghost-action danger" onClick={() => removerEtapa(item.id)}>Remover</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <label className="procedures-form-wide">
                  <span>Observação</span>
                  <textarea
                    rows={4}
                    value={ordemServicoForm.observacao}
                    onChange={(event) => setOrdemServicoForm((atual) => ({ ...atual, observacao: event.target.value }))}
                  />
                </label>
              </div>

              <div className="users-template-actions">
                <button type="button" className="primary-action" onClick={salvarGuia} disabled={!procedimentoSelecionado || salvando}>
                  Salvar ordem de serviço
                </button>
              </div>
            </div>

            <div className="clinical-elements-panel">
              <div className="clinical-elements-header">
                <strong>Guias emitidas</strong>
                <span>{ordensServico.length} item(ns)</span>
              </div>
              {ordensServico.length ? ordensServico.map((item) => (
                <div key={item.id} className="clinical-element-card">
                  <div className="clinical-element-row">
                    <strong>{item.procedimentoNome}</strong>
                    <span>{item.documentoNome || "Sem documento"}</span>
                  </div>
                  <div className="clinical-element-procedures">
                    <span>{item.elementoArcada || "Sem elemento"}</span>
                    {item.retornoSolicitado ? <span>Retorno {item.retornoSolicitado}</span> : null}
                    {item.etapas?.map((etapa, indice) => (
                      <span key={`${item.id}-${indice}`}>{etapa.etapa === "Outro" ? etapa.descricao_outro || "Outro" : etapa.etapa}</span>
                    ))}
                  </div>
                </div>
              )) : <span className="empty-inline">Nenhuma guia emitida para este paciente.</span>}
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}
