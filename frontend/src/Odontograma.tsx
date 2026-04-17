const FILEIRA_SUPERIOR_PERMANENTE = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const FILEIRA_INFERIOR_PERMANENTE = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const FILEIRA_SUPERIOR_DECIDUA = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const FILEIRA_INFERIOR_DECIDUA = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

type DenticaoOdontograma = "Permanente" | "Decidua";

type OdontogramaProps = {
  denticao: DenticaoOdontograma;
  dentesContratados: number[];
  dentesSelecionados: number[];
  onSelectTooth: (toothId: number) => void;
};

function classeCaixaDente(contratado: boolean, selecionado: boolean) {
  if (contratado && selecionado) return "odontograma-box contracted selected";
  if (contratado) return "odontograma-box contracted";
  if (selecionado) return "odontograma-box selected";
  return "odontograma-box";
}

function LinhaOdontograma({
  titulo,
  dentes,
  dentesContratados,
  dentesSelecionados,
  onSelectTooth
}: {
  titulo: string;
  dentes: number[];
  dentesContratados: number[];
  dentesSelecionados: number[];
  onSelectTooth: (toothId: number) => void;
}) {
  return (
    <section className="odontograma-section">
      <header className="odontograma-section-header">{titulo}</header>
      <div className="odontograma-row">
        {dentes.map((dente) => {
          const contratado = dentesContratados.includes(dente);
          const selecionado = dentesSelecionados.includes(dente);
          return (
            <button
              key={dente}
              type="button"
              className={classeCaixaDente(contratado, selecionado)}
              onClick={() => onSelectTooth(dente)}
            >
              <span className="odontograma-box-label">{dente}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function Odontograma({ denticao, dentesContratados, dentesSelecionados, onSelectTooth }: OdontogramaProps) {
  const superior = denticao === "Permanente" ? FILEIRA_SUPERIOR_PERMANENTE : FILEIRA_SUPERIOR_DECIDUA;
  const inferior = denticao === "Permanente" ? FILEIRA_INFERIOR_PERMANENTE : FILEIRA_INFERIOR_DECIDUA;

  return (
    <div className={`odontograma-component odontograma-boxes ${denticao === "Decidua" ? "decidua" : "permanente"}`}>
      <div className="odontograma-legend">
        <span className="odontograma-legend-item"><i className="odontograma-legend-swatch contracted" />No contrato</span>
        <span className="odontograma-legend-item"><i className="odontograma-legend-swatch selected" />Selecionado</span>
      </div>
      <LinhaOdontograma
        titulo="Arcada superior"
        dentes={superior}
        dentesContratados={dentesContratados}
        dentesSelecionados={dentesSelecionados}
        onSelectTooth={onSelectTooth}
      />
      <div className="odontograma-divider" />
      <LinhaOdontograma
        titulo="Arcada inferior"
        dentes={inferior}
        dentesContratados={dentesContratados}
        dentesSelecionados={dentesSelecionados}
        onSelectTooth={onSelectTooth}
      />
    </div>
  );
}
