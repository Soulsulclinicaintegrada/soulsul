import { Shield, UserCog } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buscarConfiguracaoAgendaApi, salvarConfiguracaoAgendaApi, type AgendaDiaConfiguracaoApi } from "./agendaApi";
import { obterUsuariosSistema } from "./mockData";
import { atualizarUsuarioApi, criarUsuarioApi, excluirUsuarioApi, listarUsuariosApi, redefinirSenhaUsuarioApi, urlExportarAcoesUsuariosApi, type UsuarioResumoApi } from "./pacientesApi";

type NivelPermissao = "Sem acesso" | "Visualizacao" | "Edicao";
type CargoUsuario = "Administrador" | "Profissional" | "Recepcionista";
type AgendaEscopo = "Toda a clinica" | "Somente a propria";

type UsuarioPermissao = {
  id: number;
  nome: string;
  usuario: string;
  nomeAgenda: string;
  perfil: "Administrador" | "Usuario";
  cargo: CargoUsuario;
  agendaEscopo: AgendaEscopo;
  agendaDisponivel: boolean;
  status: "Ativo" | "Inativo";
  ultimoAcesso: string;
  modulos: Record<string, NivelPermissao>;
  pacientesAbas: Record<string, NivelPermissao>;
};

type AgendaDiaUsuario = {
  ativo: boolean;
  inicio: string;
  fim: string;
  almocoInicio: string;
  almocoFim: string;
};

type AgendaConfigUsuario = {
  mostrar: boolean;
  maxAgendamentosPorHorario: number;
  configuracaoDias: Record<string, AgendaDiaUsuario>;
};

const MODULOS_BASE = ["Dashboard", "Pacientes", "Agenda", "Financeiro", "Tabelas", "Usuarios"] as const;
const ABAS_PACIENTES = ["Cadastro", "Orcamentos", "Financeiro", "Documentos", "Plano e Ficha Clinica", "Odontograma", "Agendamentos"] as const;
const OPCOES_PERMISSAO: NivelPermissao[] = ["Sem acesso", "Visualizacao", "Edicao"];
const DIAS_CURTOS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"] as const;

function criarConfiguracaoDiasPadrao() {
  return Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((dia) => [
      String(dia),
      {
        ativo: dia >= 1 && dia <= 5,
        inicio: "08:00",
        fim: dia === 4 ? "18:00" : "19:00",
        almocoInicio: "12:00",
        almocoFim: "13:00"
      }
    ])
  ) as Record<string, AgendaDiaUsuario>;
}

function gerarUsuarioLogin(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function cargoInicial(usuario: UsuarioResumoApi): CargoUsuario {
  if (usuario.cargo) return usuario.cargo;
  if (usuario.perfil === "Administrador") return "Administrador";
  return "Profissional";
}

function agendaEscopoInicial(usuario: UsuarioResumoApi): AgendaEscopo {
  if (usuario.agendaEscopo === "Toda a clinica" || usuario.agendaEscopo === "Somente a propria") return usuario.agendaEscopo;
  return cargoInicial(usuario) === "Profissional" ? "Somente a propria" : "Toda a clinica";
}

function agendaConfigPadraoUsuario(): AgendaConfigUsuario {
  return {
    mostrar: true,
    maxAgendamentosPorHorario: 1,
    configuracaoDias: criarConfiguracaoDiasPadrao()
  };
}

function calcularNivelPacientes(pacientesAbas: Record<string, NivelPermissao>): NivelPermissao {
  const niveis = Object.values(pacientesAbas);
  if (!niveis.some((item) => item !== "Sem acesso")) return "Sem acesso";
  if (niveis.some((item) => item === "Edicao")) return "Edicao";
  return "Visualizacao";
}

function fallbackPermissoesProfissional() {
  const modulos = Object.fromEntries(MODULOS_BASE.map((modulo) => [modulo, "Sem acesso"])) as Record<string, NivelPermissao>;
  const pacientesAbas = Object.fromEntries(ABAS_PACIENTES.map((aba) => [aba, "Sem acesso"])) as Record<string, NivelPermissao>;
  modulos.Pacientes = "Edicao";
  modulos.Agenda = "Visualizacao";
  pacientesAbas.Documentos = "Edicao";
  pacientesAbas["Plano e Ficha Clinica"] = "Visualizacao";
  pacientesAbas.Odontograma = "Visualizacao";
  pacientesAbas.Agendamentos = "Visualizacao";
  modulos.Pacientes = calcularNivelPacientes(pacientesAbas);
  return {
    perfil: "Usuario" as const,
    agendaEscopo: "Somente a propria" as const,
    modulos,
    pacientesAbas
  };
}

function fallbackPermissoesRecepcionista() {
  const modulos = Object.fromEntries(MODULOS_BASE.map((modulo) => [modulo, "Sem acesso"])) as Record<string, NivelPermissao>;
  const pacientesAbas = Object.fromEntries(ABAS_PACIENTES.map((aba) => [aba, "Sem acesso"])) as Record<string, NivelPermissao>;
  modulos.Dashboard = "Visualizacao";
  modulos.Pacientes = "Edicao";
  modulos.Agenda = "Edicao";
  modulos.Financeiro = "Visualizacao";
  pacientesAbas.Cadastro = "Edicao";
  pacientesAbas.Orcamentos = "Visualizacao";
  pacientesAbas.Financeiro = "Visualizacao";
  pacientesAbas.Documentos = "Visualizacao";
  pacientesAbas.Agendamentos = "Edicao";
  modulos.Pacientes = calcularNivelPacientes(pacientesAbas);
  return {
    perfil: "Usuario" as const,
    agendaEscopo: "Toda a clinica" as const,
    modulos,
    pacientesAbas
  };
}

function mapUsuarioApi(usuario: UsuarioResumoApi): UsuarioPermissao {
  const modulos = Object.fromEntries(
    MODULOS_BASE.map((modulo) => [modulo, (usuario.modulos?.[modulo] as NivelPermissao) || "Sem acesso"])
  ) as Record<string, NivelPermissao>;
  const pacientesAbas = Object.fromEntries(
    ABAS_PACIENTES.map((aba) => [aba, (usuario.pacientesAbas?.[aba] as NivelPermissao) || "Sem acesso"])
  ) as Record<string, NivelPermissao>;
  return {
    id: usuario.id,
    nome: usuario.nome,
    usuario: usuario.usuario || gerarUsuarioLogin(usuario.nome),
    nomeAgenda: usuario.nomeAgenda || usuario.nome,
    perfil: usuario.perfil,
    cargo: cargoInicial(usuario),
    agendaEscopo: agendaEscopoInicial(usuario),
    agendaDisponivel: usuario.agendaDisponivel ?? cargoInicial(usuario) === "Profissional",
    status: (usuario.status as "Ativo" | "Inativo") || "Ativo",
    ultimoAcesso: usuario.ultimoAcesso || "-",
    modulos,
    pacientesAbas
  };
}

function cargoPodeTerAgenda(cargo: CargoUsuario) {
  return cargo === "Profissional" || cargo === "Administrador";
}

function obterPadraoPorCargo(cargo: CargoUsuario, usuarios: UsuarioPermissao[]) {
  if (cargo === "Administrador") {
    return {
      perfil: "Administrador" as const,
      agendaEscopo: "Toda a clinica" as const,
      modulos: Object.fromEntries(MODULOS_BASE.map((modulo) => [modulo, "Edicao"])) as Record<string, NivelPermissao>,
      pacientesAbas: Object.fromEntries(ABAS_PACIENTES.map((aba) => [aba, "Edicao"])) as Record<string, NivelPermissao>
    };
  }

  if (cargo === "Profissional") {
    return fallbackPermissoesProfissional();
  }

  return fallbackPermissoesRecepcionista();
}

export function UsuariosPage() {
  const hojeIso = new Date().toISOString().slice(0, 10);
  const [usuarios, setUsuarios] = useState<UsuarioPermissao[]>([]);
  const [agendaConfig, setAgendaConfig] = useState<Record<number, AgendaConfigUsuario>>({});
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState<number>(0);
  const [novoUsuario, setNovoUsuario] = useState({
    nome: "",
    nomeAgenda: "",
    cargo: "Profissional" as CargoUsuario,
    agendaEscopo: "Somente a propria" as AgendaEscopo,
    agendaDisponivel: true,
    status: "Ativo" as "Ativo" | "Inativo"
  });
  const [dataRelatorio, setDataRelatorio] = useState(hojeIso);
  const [senhaAdmin, setSenhaAdmin] = useState({ aberta: false, nova: "", confirmar: "", erro: "", sucesso: "" });
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [feedbackPerfil, setFeedbackPerfil] = useState("");

  useEffect(() => {
    let cancelado = false;
    listarUsuariosApi()
      .then((resultado) => {
        if (cancelado) return;
        const mapeados = resultado.map(mapUsuarioApi);
        setUsuarios(mapeados);
        setUsuarioSelecionadoId((atual) => atual || mapeados[0]?.id || 0);
      })
      .catch(() => {
        if (cancelado) return;
        setUsuarios([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    buscarConfiguracaoAgendaApi()
      .then((config) => {
        if (cancelado) return;
        const mapa = Object.fromEntries(
          (config.configProfissionais || []).map((item) => [
            item.id,
            {
              mostrar: item.mostrar,
              maxAgendamentosPorHorario: item.maxAgendamentosPorHorario || 1,
              configuracaoDias: item.configuracaoDias || criarConfiguracaoDiasPadrao()
            }
          ])
        ) as Record<number, AgendaConfigUsuario>;
        setAgendaConfig(mapa);
      })
      .catch(() => {
        if (cancelado) return;
        setAgendaConfig({});
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!usuarios.length) return;
    const legado = obterUsuariosSistema();
    const loginsExistentes = new Set(usuarios.map((usuario) => usuario.usuario.toLowerCase()));
    const faltantes = legado.filter((usuario) => !loginsExistentes.has((usuario.usuario || gerarUsuarioLogin(usuario.nome)).toLowerCase()));
    if (!faltantes.length) return;
    void (async () => {
      for (const usuario of faltantes) {
        const cargo = (usuario.cargo as CargoUsuario) || "Profissional";
        const padrao = obterPadraoPorCargo(cargo, usuarios);
        try {
          const criado = await criarUsuarioApi({
            nome: usuario.nome,
            nome_agenda: usuario.nomeAgenda || usuario.nome,
            cargo,
            agenda_escopo:
              usuario.agendaEscopo === "Somente a propria" || usuario.agendaEscopo === "Toda a clinica"
                ? usuario.agendaEscopo
                : padrao.agendaEscopo,
            agenda_disponivel: Boolean(usuario.agendaDisponivel),
            perfil: usuario.perfil === "Administrador" ? "Administrador" : padrao.perfil,
            ativo: usuario.status !== "Inativo",
            modulos: Object.fromEntries(
              MODULOS_BASE.map((modulo) => [modulo, (usuario.modulos as string[] | undefined)?.includes(modulo) ? "Edicao" : "Sem acesso"])
            ),
            pacientes_abas: padrao.pacientesAbas
          });
          setUsuarios((atuais) => [...atuais, mapUsuarioApi(criado)]);
        } catch {
          // Ignora conflitos de migracao e mantem a tela operacional.
        }
      }
    })();
  }, [usuarios]);

  const usuarioSelecionado = useMemo(
    () => usuarios.find((item) => item.id === usuarioSelecionadoId) || usuarios[0] || null,
    [usuarioSelecionadoId, usuarios]
  );
  const agendaUsuarioSelecionado = usuarioSelecionado ? agendaConfig[usuarioSelecionado.id] || agendaConfigPadraoUsuario() : null;

  function atualizarUsuarioSelecionado(parcial: Partial<UsuarioPermissao>) {
    if (!usuarioSelecionado) return;
    setUsuarios((atuais) => atuais.map((usuario) => (usuario.id === usuarioSelecionado.id ? { ...usuario, ...parcial } : usuario)));
  }

  function atualizarAgendaUsuarioSelecionado(parcial: Partial<AgendaConfigUsuario>) {
    if (!usuarioSelecionado) return;
    setAgendaConfig((atual) => ({
      ...atual,
      [usuarioSelecionado.id]: {
        ...(atual[usuarioSelecionado.id] || agendaConfigPadraoUsuario()),
        ...parcial
      }
    }));
  }

  function atualizarAgendaDiaUsuarioSelecionado(dia: string, parcial: Partial<AgendaDiaConfiguracaoApi>) {
    if (!usuarioSelecionado) return;
    setAgendaConfig((atual) => {
      const atualUsuario = atual[usuarioSelecionado.id] || agendaConfigPadraoUsuario();
      return {
        ...atual,
        [usuarioSelecionado.id]: {
          ...atualUsuario,
          configuracaoDias: {
            ...atualUsuario.configuracaoDias,
            [dia]: {
              ...(atualUsuario.configuracaoDias[dia] || criarConfiguracaoDiasPadrao()[dia]),
              ...parcial
            }
          }
        }
      };
    });
  }

  function aplicarPadraoCargoNoUsuario(usuarioId: number, cargo: CargoUsuario) {
    setUsuarios((atuais) => {
      const padrao = obterPadraoPorCargo(cargo, atuais);
      const proximos = atuais.map((usuario) => {
        if (usuario.id !== usuarioId) return usuario;
        return {
          ...usuario,
          cargo,
          perfil: padrao.perfil,
          agendaEscopo: cargo === "Profissional" ? usuario.agendaEscopo : padrao.agendaEscopo,
          agendaDisponivel: cargo === "Profissional" ? usuario.agendaDisponivel : false,
          modulos: { ...padrao.modulos },
          pacientesAbas: { ...padrao.pacientesAbas }
        };
      });
      return proximos;
    });
  }

  function atualizarModulo(modulo: string, nivel: NivelPermissao) {
    if (!usuarioSelecionado) return;
    setUsuarios((atuais) =>
      atuais.map((usuario) => {
        if (usuario.id !== usuarioSelecionado.id) return usuario;
        const proximo = {
          ...usuario,
          modulos: { ...usuario.modulos, [modulo]: nivel },
          pacientesAbas: { ...usuario.pacientesAbas }
        };
        if (modulo === "Pacientes" && nivel === "Sem acesso") {
          ABAS_PACIENTES.forEach((aba) => {
            proximo.pacientesAbas[aba] = "Sem acesso";
          });
        }
        if (modulo === "Pacientes" && nivel !== "Sem acesso") {
          ABAS_PACIENTES.forEach((aba) => {
            if (proximo.pacientesAbas[aba] === "Sem acesso") {
              proximo.pacientesAbas[aba] = nivel === "Edicao" ? "Visualizacao" : nivel;
            }
          });
        }
        return proximo;
      })
    );
  }

  function atualizarAbaPaciente(aba: string, nivel: NivelPermissao) {
    if (!usuarioSelecionado) return;
    setUsuarios((atuais) =>
      atuais.map((usuario) => {
        if (usuario.id !== usuarioSelecionado.id) return usuario;
        const pacientesAbas = { ...usuario.pacientesAbas, [aba]: nivel };
        return {
          ...usuario,
          modulos: { ...usuario.modulos, Pacientes: calcularNivelPacientes(pacientesAbas) },
          pacientesAbas
        };
      })
    );
  }

  function criarNovoUsuario() {
    const nome = novoUsuario.nome.trim();
    if (!nome) return;
    const padrao = obterPadraoPorCargo(novoUsuario.cargo, usuarios);
    void (async () => {
      try {
        const criado = await criarUsuarioApi({
          nome,
          nome_agenda: novoUsuario.nomeAgenda.trim() || nome,
          cargo: novoUsuario.cargo,
          agenda_escopo: novoUsuario.cargo === "Profissional" ? novoUsuario.agendaEscopo : padrao.agendaEscopo,
          agenda_disponivel: cargoPodeTerAgenda(novoUsuario.cargo) ? novoUsuario.agendaDisponivel : false,
          perfil: padrao.perfil,
          ativo: novoUsuario.status === "Ativo",
          modulos: padrao.modulos,
          pacientes_abas: padrao.pacientesAbas
        });
        setUsuarios((atuais) => [mapUsuarioApi(criado), ...atuais]);
        setUsuarioSelecionadoId(criado.id);
        setNovoUsuario({
          nome: "",
          nomeAgenda: "",
          cargo: "Profissional",
          agendaEscopo: "Somente a propria",
          agendaDisponivel: true,
          status: "Ativo"
        });
        setFeedbackPerfil("Usuário criado com sucesso.");
      } catch (error) {
        setFeedbackPerfil(error instanceof Error ? error.message : "Falha ao criar o usuário.");
      }
    })();
  }

  async function redefinirSenhaUsuarioSelecionado() {
    if (!usuarioSelecionado) return;
    const nova = senhaAdmin.nova.trim();
    const confirmar = senhaAdmin.confirmar.trim();
    if (!nova || !confirmar) {
      setSenhaAdmin((atual) => ({ ...atual, erro: "Preencha e confirme a nova senha.", sucesso: "" }));
      return;
    }
    if (nova !== confirmar) {
      setSenhaAdmin((atual) => ({ ...atual, erro: "As senhas nao conferem.", sucesso: "" }));
      return;
    }
    try {
      await redefinirSenhaUsuarioApi(usuarioSelecionado.id, { nova_senha: nova });
      setSenhaAdmin({ aberta: false, nova: "", confirmar: "", erro: "", sucesso: "Senha alterada com sucesso." });
    } catch (error) {
      setSenhaAdmin((atual) => ({
        ...atual,
        erro: error instanceof Error ? error.message : "Falha ao alterar a senha.",
        sucesso: ""
      }));
    }
  }

  async function salvarPerfilUsuarioSelecionado() {
    if (!usuarioSelecionado) return;
    try {
      setSalvandoPerfil(true);
      setFeedbackPerfil("");
      const atualizado = await atualizarUsuarioApi(usuarioSelecionado.id, {
        nome: usuarioSelecionado.nome,
        usuario: usuarioSelecionado.usuario,
        nome_agenda: usuarioSelecionado.nomeAgenda,
        cargo: usuarioSelecionado.cargo,
        agenda_escopo: usuarioSelecionado.agendaEscopo,
        agenda_disponivel: usuarioSelecionado.agendaDisponivel,
        perfil: usuarioSelecionado.perfil,
        ativo: usuarioSelecionado.status === "Ativo",
        modulos: usuarioSelecionado.modulos,
        pacientes_abas: usuarioSelecionado.pacientesAbas
      });
      const configuracaoAtual = await buscarConfiguracaoAgendaApi().catch(() => ({
        ordemProfissionais: [],
        configClinicaDias: {},
        configProfissionais: []
      }));
      const configUsuario = agendaConfig[usuarioSelecionado.id] || agendaConfigPadraoUsuario();
      const outros = (configuracaoAtual.configProfissionais || []).filter((item) => item.id !== usuarioSelecionado.id);
      await salvarConfiguracaoAgendaApi({
        ordemProfissionais: configuracaoAtual.ordemProfissionais || [],
        configClinicaDias: configuracaoAtual.configClinicaDias || {},
        configProfissionais: [
          ...outros,
          {
            id: usuarioSelecionado.id,
            nomeAgenda: usuarioSelecionado.nomeAgenda,
            usuarioVinculado: usuarioSelecionado.usuario,
            mostrar: usuarioSelecionado.agendaDisponivel && configUsuario.mostrar,
            cor: "#c7aa78",
            corSuave: "#f7f0e4",
            maxAgendamentosPorHorario: configUsuario.maxAgendamentosPorHorario,
            configuracaoDias: configUsuario.configuracaoDias
          }
        ]
      });
      setUsuarios((atual) => atual.map((item) => (item.id === atualizado.id ? mapUsuarioApi(atualizado) : item)));
      setFeedbackPerfil("Dados do usuário salvos com sucesso.");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Falha ao salvar os dados do usuário.";
      setFeedbackPerfil(mensagem);
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function excluirUsuarioSelecionado() {
    if (!usuarioSelecionado) return;
    const confirmar = window.confirm(`Deseja realmente excluir o usuário ${usuarioSelecionado.nome}?`);
    if (!confirmar) return;

    try {
      setFeedbackPerfil("");
      await excluirUsuarioApi(usuarioSelecionado.id);
      setUsuarios((atual) => {
        const proximos = atual.filter((item) => item.id !== usuarioSelecionado.id);
        setUsuarioSelecionadoId(proximos[0]?.id || 0);
        return proximos;
      });
      setFeedbackPerfil("Usuário excluído com sucesso.");
    } catch (error) {
      setFeedbackPerfil(error instanceof Error ? error.message : "Falha ao excluir o usuário.");
    }
  }

  const totalAtivos = usuarios.filter((item) => item.status === "Ativo").length;
  const totalEdicao = usuarios.filter((item) => Object.values(item.modulos).some((nivel) => nivel === "Edicao")).length;

  return (
    <section className="module-shell">
      <section className="module-kpis">
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Usuarios</span>
          <strong>{usuarios.length}</strong>
          <span>contas cadastradas</span>
        </article>
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Ativos</span>
          <strong>{totalAtivos}</strong>
          <span>em operacao</span>
        </article>
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Com edicao</span>
          <strong>{totalEdicao}</strong>
          <span>acesso operacional</span>
        </article>
      </section>

      <section className="module-content-grid">
        <article className="panel module-detail-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Cadastro</span>
              <h2>Novo usuario</h2>
            </div>
            <UserCog size={18} />
          </div>
          <div className="users-create-grid users-create-grid-wide">
            <label>
              <span>Nome</span>
              <input type="text" value={novoUsuario.nome} onChange={(e) => setNovoUsuario((atual) => ({ ...atual, nome: e.target.value }))} />
            </label>
            <label>
              <span>Nome na agenda</span>
              <input type="text" value={novoUsuario.nomeAgenda} onChange={(e) => setNovoUsuario((atual) => ({ ...atual, nomeAgenda: e.target.value }))} />
            </label>
            <label>
              <span>Cargo</span>
              <select
                value={novoUsuario.cargo}
                onChange={(e) =>
                  setNovoUsuario((atual) => ({
                    ...atual,
                    cargo: e.target.value as CargoUsuario,
                    agendaEscopo: cargoPodeTerAgenda(e.target.value as CargoUsuario) ? atual.agendaEscopo : "Toda a clinica",
                    agendaDisponivel: cargoPodeTerAgenda(e.target.value as CargoUsuario) ? atual.agendaDisponivel : false
                  }))
                }
              >
                <option value="Profissional">Profissional</option>
                <option value="Recepcionista">Recepcionista</option>
                <option value="Administrador">Administrador</option>
              </select>
            </label>
            <label>
              <span>Agenda</span>
              <select
                value={novoUsuario.agendaEscopo}
                disabled={!cargoPodeTerAgenda(novoUsuario.cargo)}
                onChange={(e) => setNovoUsuario((atual) => ({ ...atual, agendaEscopo: e.target.value as AgendaEscopo }))}
              >
                <option value="Somente a propria">Somente a propria</option>
                <option value="Toda a clinica">Toda a clinica</option>
              </select>
            </label>
            <label>
              <span>Agenda disponivel</span>
              <select
                value={novoUsuario.agendaDisponivel ? "Sim" : "Nao"}
                disabled={!cargoPodeTerAgenda(novoUsuario.cargo)}
                onChange={(e) => setNovoUsuario((atual) => ({ ...atual, agendaDisponivel: e.target.value === "Sim" }))}
              >
                <option value="Sim">Sim</option>
                <option value="Nao">Não</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={novoUsuario.status} onChange={(e) => setNovoUsuario((atual) => ({ ...atual, status: e.target.value as "Ativo" | "Inativo" }))}>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </label>
            <div className="finance-form-actions">
              <button type="button" className="primary-action" onClick={criarNovoUsuario}>Criar usuario</button>
            </div>
          </div>
        </article>
        <article className="panel module-detail-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Auditoria</span>
              <h2>Relatorio diario de acoes</h2>
            </div>
            <Shield size={18} />
          </div>
          <div className="users-create-grid">
            <label>
              <span>Data</span>
              <input type="date" value={dataRelatorio} onChange={(e) => setDataRelatorio(e.target.value)} />
            </label>
            <div className="finance-form-actions">
              <a className="primary-action" href={urlExportarAcoesUsuariosApi(dataRelatorio)} target="_blank" rel="noreferrer">
                Baixar relatorio
              </a>
            </div>
          </div>
        </article>
      </section>

      <section className="module-content-grid users-permission-grid">
        <article className="panel module-list-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Equipe</span>
              <h2>Usuarios e cargos</h2>
            </div>
            <UserCog size={18} />
          </div>
          <div className="module-sublist">
            {usuarios.map((usuario) => (
              <button
                key={usuario.id}
                type="button"
                className={`module-subitem users-list-item${usuarioSelecionado?.id === usuario.id ? " active" : ""}`}
                onClick={() => setUsuarioSelecionadoId(usuario.id)}
              >
                <div>
                  <strong>{usuario.nome}</strong>
                  <span>{usuario.cargo} Â· ultimo acesso {usuario.ultimoAcesso}</span>
                </div>
                <div className="module-subitem-right">
                  <strong>{Object.values(usuario.modulos).filter((item) => item !== "Sem acesso").length} modulos</strong>
                  <span className={`module-status-badge ${usuario.status.toLowerCase()}`}>{usuario.status}</span>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="panel module-detail-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Permissoes</span>
              <h2>{usuarioSelecionado ? `Acessos de ${usuarioSelecionado.nome}` : "Selecione um usuario"}</h2>
            </div>
            <Shield size={18} />
          </div>

          {usuarioSelecionado ? (
            <div className="users-permission-sections">
              <section className="users-permission-section">
                <div className="users-permission-section-head">
                  <strong>Perfil do usuario</strong>
                  <span>Profissional usa o padrao dentista. Recepcionista usa o padrao recepcionista.</span>
                </div>
                <div className="users-profile-grid">
                  <label>
                    <span>Nome do usuário</span>
                    <input value={usuarioSelecionado.nome} onChange={(e) => atualizarUsuarioSelecionado({ nome: e.target.value })} />
                  </label>
                  <label>
                    <span>Usuario de login</span>
                    <input type="text" value={usuarioSelecionado.usuario} onChange={(e) => atualizarUsuarioSelecionado({ usuario: e.target.value })} />
                  </label>
                  <label>
                    <span>Cargo</span>
                    <select value={usuarioSelecionado.cargo} onChange={(e) => aplicarPadraoCargoNoUsuario(usuarioSelecionado.id, e.target.value as CargoUsuario)}>
                      <option value="Profissional">Profissional</option>
                      <option value="Recepcionista">Recepcionista</option>
                      <option value="Administrador">Administrador</option>
                    </select>
                  </label>
                  <label>
                    <span>Nome na agenda</span>
                    <input value={usuarioSelecionado.nomeAgenda} onChange={(e) => atualizarUsuarioSelecionado({ nomeAgenda: e.target.value })} />
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={usuarioSelecionado.status} onChange={(e) => atualizarUsuarioSelecionado({ status: e.target.value as "Ativo" | "Inativo" })}>
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </label>
                  <label>
                    <span>Perfil de login</span>
                    <input type="text" readOnly value={usuarioSelecionado.perfil} />
                  </label>
                  <label>
                    <span>Agenda</span>
                    <select
                      value={usuarioSelecionado.agendaEscopo}
                      disabled={!cargoPodeTerAgenda(usuarioSelecionado.cargo)}
                      onChange={(e) => atualizarUsuarioSelecionado({ agendaEscopo: e.target.value as AgendaEscopo })}
                    >
                      <option value="Somente a propria">Somente a propria</option>
                      <option value="Toda a clinica">Toda a clinica</option>
                    </select>
                  </label>
                  <label>
                    <span>Agenda disponivel</span>
                    <select
                      value={usuarioSelecionado.agendaDisponivel ? "Sim" : "Nao"}
                      disabled={!cargoPodeTerAgenda(usuarioSelecionado.cargo)}
                      onChange={(e) => atualizarUsuarioSelecionado({ agendaDisponivel: e.target.value === "Sim" })}
                    >
                      <option value="Sim">Sim</option>
                      <option value="Nao">Não</option>
                    </select>
                  </label>
                </div>
                <div className="users-template-actions">
                  <button type="button" className="primary-action" onClick={salvarPerfilUsuarioSelecionado} disabled={salvandoPerfil}>
                    {salvandoPerfil ? "Salvando..." : "Salvar dados"}
                  </button>
                  <button type="button" className="ghost-action" onClick={() => aplicarPadraoCargoNoUsuario(usuarioSelecionado.id, "Profissional")}>
                    Aplicar padrao dentista
                  </button>
                  <button type="button" className="ghost-action" onClick={() => aplicarPadraoCargoNoUsuario(usuarioSelecionado.id, "Recepcionista")}>
                    Aplicar padrao recepcionista
                  </button>
                  <button
                    type="button"
                    className="ghost-action"
                    onClick={() => setSenhaAdmin({ aberta: true, nova: "", confirmar: "", erro: "", sucesso: "" })}
                  >
                    Alterar senha
                  </button>
                  <button type="button" className="ghost-action danger" onClick={excluirUsuarioSelecionado}>
                    Excluir usuário
                  </button>
                </div>
                {feedbackPerfil ? <p className={`users-password-feedback ${feedbackPerfil.includes("sucesso") ? "success" : "error"}`}>{feedbackPerfil}</p> : null}
                {senhaAdmin.sucesso ? <p className="users-password-feedback success">{senhaAdmin.sucesso}</p> : null}
                {senhaAdmin.aberta ? (
                  <div className="users-password-panel">
                    <label>
                      <span>Nova senha</span>
                      <input
                        type="password"
                        value={senhaAdmin.nova}
                        onChange={(e) => setSenhaAdmin((atual) => ({ ...atual, nova: e.target.value, erro: "", sucesso: "" }))}
                      />
                    </label>
                    <label>
                      <span>Confirmar nova senha</span>
                      <input
                        type="password"
                        value={senhaAdmin.confirmar}
                        onChange={(e) => setSenhaAdmin((atual) => ({ ...atual, confirmar: e.target.value, erro: "", sucesso: "" }))}
                      />
                    </label>
                    {senhaAdmin.erro ? <p className="users-password-feedback error">{senhaAdmin.erro}</p> : null}
                    <div className="users-template-actions">
                      <button type="button" className="ghost-action" onClick={() => setSenhaAdmin({ aberta: false, nova: "", confirmar: "", erro: "", sucesso: "" })}>
                        Cancelar
                      </button>
                      <button type="button" className="primary-action" onClick={redefinirSenhaUsuarioSelecionado}>
                        Salvar nova senha
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="users-permission-section">
                <div className="users-permission-section-head">
                  <strong>Modulos do sistema</strong>
                  <span>Defina se o usuario pode editar, visualizar ou nao acessar.</span>
                </div>
                <div className="users-permission-table">
                  {MODULOS_BASE.map((modulo) => (
                    <div className="users-permission-row" key={modulo}>
                      <div className="users-permission-label">{modulo}</div>
                      <div className="users-permission-actions">
                        {OPCOES_PERMISSAO.map((nivel) => (
                          <button
                            key={nivel}
                            type="button"
                            className={`permission-chip${usuarioSelecionado.modulos[modulo] === nivel ? " active" : ""}`}
                            onClick={() => atualizarModulo(modulo, nivel)}
                          >
                            {nivel}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="users-permission-section">
                <div className="users-permission-section-head">
                  <strong>Agenda do usuario</strong>
                  <span>Edite disponibilidade e horarios sem sair desta tela.</span>
                </div>
                {agendaUsuarioSelecionado ? (
                  <div className="users-agenda-grid">
                    <label>
                      <span>Mostrar na agenda</span>
                      <select
                        value={agendaUsuarioSelecionado.mostrar ? "Sim" : "Nao"}
                        onChange={(e) => atualizarAgendaUsuarioSelecionado({ mostrar: e.target.value === "Sim" })}
                      >
                        <option value="Sim">Sim</option>
                        <option value="Nao">Não</option>
                      </select>
                    </label>
                    <label>
                      <span>Max. por horario</span>
                      <input
                        type="number"
                        min={1}
                        max={9}
                        value={agendaUsuarioSelecionado.maxAgendamentosPorHorario}
                        onChange={(e) =>
                          atualizarAgendaUsuarioSelecionado({
                            maxAgendamentosPorHorario: Math.max(1, Number(e.target.value) || 1)
                          })
                        }
                      />
                    </label>
                    {Object.entries(agendaUsuarioSelecionado.configuracaoDias).map(([dia, config]) => (
                      <div key={dia} className="users-agenda-day-card">
                        <div className="users-agenda-day-head">
                          <strong>{DIAS_CURTOS[Number(dia)]}</strong>
                          <label className="users-agenda-day-toggle">
                            <span>Ativo</span>
                            <input
                              type="checkbox"
                              checked={config.ativo}
                              onChange={(e) => atualizarAgendaDiaUsuarioSelecionado(dia, { ativo: e.target.checked })}
                            />
                          </label>
                        </div>
                        <div className="users-agenda-day-grid">
                          <label>
                            <span>Início</span>
                            <input type="time" value={config.inicio} onChange={(e) => atualizarAgendaDiaUsuarioSelecionado(dia, { inicio: e.target.value })} />
                          </label>
                          <label>
                            <span>Fim</span>
                            <input type="time" value={config.fim} onChange={(e) => atualizarAgendaDiaUsuarioSelecionado(dia, { fim: e.target.value })} />
                          </label>
                          <label>
                            <span>Almoço início</span>
                            <input
                              type="time"
                              value={config.almocoInicio}
                              onChange={(e) => atualizarAgendaDiaUsuarioSelecionado(dia, { almocoInicio: e.target.value })}
                            />
                          </label>
                          <label>
                            <span>Almoço fim</span>
                            <input
                              type="time"
                              value={config.almocoFim}
                              onChange={(e) => atualizarAgendaDiaUsuarioSelecionado(dia, { almocoFim: e.target.value })}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="users-permission-section">
                <div className="users-permission-section-head">
                  <strong>Abas de pacientes</strong>
                  <span>Controle fino por aba dentro da ficha do paciente.</span>
                </div>
                <div className="users-permission-table">
                  {ABAS_PACIENTES.map((aba) => (
                    <div className="users-permission-row" key={aba}>
                      <div className="users-permission-label">{aba}</div>
                      <div className="users-permission-actions">
                        {OPCOES_PERMISSAO.map((nivel) => (
                          <button
                            key={nivel}
                            type="button"
                            className={`permission-chip${usuarioSelecionado.pacientesAbas[aba] === nivel ? " active" : ""}`}
                            onClick={() => atualizarAbaPaciente(aba, nivel)}
                          >
                            {nivel}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </article>
      </section>
    </section>
  );
}

