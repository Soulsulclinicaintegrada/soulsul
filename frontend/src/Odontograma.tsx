const FILEIRA_SUPERIOR_DECIDUA = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const FILEIRA_INFERIOR_DECIDUA = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

type DenticaoOdontograma = "Permanente" | "Decidua";

type OdontogramaProps = {
  denticao: DenticaoOdontograma;
  dentesContratados: number[];
  dentesSelecionados: number[];
  onSelectTooth: (toothId: number) => void;
};

type ToothLayout = {
  id: number;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  tipo: "molar" | "premolar" | "canino" | "incisivo";
};

const FILEIRA_SUPERIOR_PERMANENTE: ToothLayout[] = [
  { id: 18, x: 56, y: 48, labelX: 84, labelY: 164, tipo: "molar" },
  { id: 17, x: 118, y: 50, labelX: 146, labelY: 164, tipo: "molar" },
  { id: 16, x: 180, y: 50, labelX: 208, labelY: 164, tipo: "molar" },
  { id: 15, x: 245, y: 58, labelX: 271, labelY: 164, tipo: "premolar" },
  { id: 14, x: 302, y: 58, labelX: 328, labelY: 164, tipo: "premolar" },
  { id: 13, x: 360, y: 60, labelX: 382, labelY: 164, tipo: "canino" },
  { id: 12, x: 412, y: 64, labelX: 432, labelY: 164, tipo: "incisivo" },
  { id: 11, x: 458, y: 64, labelX: 478, labelY: 164, tipo: "incisivo" },
  { id: 21, x: 522, y: 64, labelX: 542, labelY: 164, tipo: "incisivo" },
  { id: 22, x: 566, y: 64, labelX: 586, labelY: 164, tipo: "incisivo" },
  { id: 23, x: 610, y: 60, labelX: 632, labelY: 164, tipo: "canino" },
  { id: 24, x: 665, y: 58, labelX: 691, labelY: 164, tipo: "premolar" },
  { id: 25, x: 722, y: 58, labelX: 748, labelY: 164, tipo: "premolar" },
  { id: 26, x: 780, y: 50, labelX: 808, labelY: 164, tipo: "molar" },
  { id: 27, x: 842, y: 50, labelX: 870, labelY: 164, tipo: "molar" },
  { id: 28, x: 904, y: 48, labelX: 932, labelY: 164, tipo: "molar" }
];

const FILEIRA_INFERIOR_PERMANENTE: ToothLayout[] = [
  { id: 48, x: 56, y: 340, labelX: 84, labelY: 246, tipo: "molar" },
  { id: 47, x: 118, y: 340, labelX: 146, labelY: 246, tipo: "molar" },
  { id: 46, x: 180, y: 340, labelX: 208, labelY: 246, tipo: "molar" },
  { id: 45, x: 245, y: 332, labelX: 271, labelY: 246, tipo: "premolar" },
  { id: 44, x: 302, y: 332, labelX: 328, labelY: 246, tipo: "premolar" },
  { id: 43, x: 360, y: 324, labelX: 382, labelY: 246, tipo: "canino" },
  { id: 42, x: 412, y: 320, labelX: 432, labelY: 246, tipo: "incisivo" },
  { id: 41, x: 458, y: 320, labelX: 478, labelY: 246, tipo: "incisivo" },
  { id: 31, x: 522, y: 320, labelX: 542, labelY: 246, tipo: "incisivo" },
  { id: 32, x: 566, y: 320, labelX: 586, labelY: 246, tipo: "incisivo" },
  { id: 33, x: 610, y: 324, labelX: 632, labelY: 246, tipo: "canino" },
  { id: 34, x: 665, y: 332, labelX: 691, labelY: 246, tipo: "premolar" },
  { id: 35, x: 722, y: 332, labelX: 748, labelY: 246, tipo: "premolar" },
  { id: 36, x: 780, y: 340, labelX: 808, labelY: 246, tipo: "molar" },
  { id: 37, x: 842, y: 340, labelX: 870, labelY: 246, tipo: "molar" },
  { id: 38, x: 904, y: 340, labelX: 932, labelY: 246, tipo: "molar" }
];

function classeDente(contratado: boolean, selecionado: boolean) {
  if (contratado) return "dente-path treated";
  if (selecionado) return "dente-path selected";
  return "dente-path";
}

function pathPermanente(tipo: ToothLayout["tipo"]) {
  switch (tipo) {
    case "molar":
      return "M6 16 Q10 0 28 0 Q46 0 50 16 Q54 30 52 54 Q49 72 42 88 Q36 102 34 118 Q31 134 28 134 Q25 134 22 118 Q20 102 14 88 Q7 72 4 54 Q2 30 6 16 Z";
    case "premolar":
      return "M7 18 Q10 2 24 2 Q38 2 42 18 Q45 30 44 50 Q43 68 38 82 Q34 94 31 112 Q29 126 24 126 Q19 126 17 112 Q14 96 10 82 Q5 68 5 50 Q4 30 7 18 Z";
    case "canino":
      return "M14 18 Q20 -4 28 18 Q32 30 31 50 Q30 70 28 86 Q25 108 22 130 Q20 144 18 144 Q16 144 14 130 Q11 108 8 86 Q6 70 5 50 Q4 30 14 18 Z";
    case "incisivo":
      return "M11 16 Q16 0 24 0 Q32 0 37 16 Q40 32 39 56 Q38 82 34 108 Q31 128 28 146 Q26 156 24 156 Q22 156 20 146 Q17 128 14 108 Q10 82 9 56 Q8 32 11 16 Z";
  }
}

function pathDecidua(tipo: "molar" | "canine" | "incisor") {
  switch (tipo) {
    case "molar":
      return "M10 16c3-6 9-9 18-9 9 0 15 3 18 9 3 6 2 13-.2 18.8-1.5 5.9-5 10.5-8 15.1-2.5 3.9-4.1 7.8-5.1 13.2l-1.9 11.2c-.4 2.7-2 4.5-4.2 4.5s-3.7-1.7-4.1-4.5l-1.9-11.2c-.9-5.4-2.6-9.4-5.1-13.2-3-4.6-6.5-9.2-8-15.1-1.5-5.7-1.9-12.6-.2-18.8Z";
    case "canine":
      return "M16 14c2.2-3.7 5.5-5.9 10-5.9s7.8 2.2 10 5.9c3.2 5 4.1 11 2.8 17.6-1.1 5.6-4.2 10.1-6.7 14.5-2.2 3.7-3.5 7.6-4.3 13.3l-2.3 17.2c-.4 2.8-1.8 4.5-3.6 4.5-1.9 0-3.3-1.7-3.6-4.5L16 59.4c-.8-5.6-2.2-9.6-4.3-13.3-2.6-4.3-5.6-8.9-6.7-14.5-1.3-6.5-.3-12.6 2.7-17.6Z";
    case "incisor":
      return "M14 14c2.4-3.9 6.6-6 12-6s9.6 2.1 12 6c2.6 4.1 3.1 9.2 2.3 15.2-.9 5.6-3.5 10.1-5.7 14.5-2 4-3.3 7.8-4.2 13.4l-2.5 18.1c-.4 2.9-1.9 4.6-3.8 4.6s-3.4-1.7-3.8-4.6l-2.5-18.1c-.8-5.4-2.3-9.4-4.2-13.4-2.2-4.2-4.8-8.9-5.7-14.5-.8-6 .1-11.1 2.1-15.2Z";
  }
}

function DentePermanente({
  tooth,
  invertido,
  contratado,
  selecionado,
  onClick
}: {
  tooth: ToothLayout;
  invertido?: boolean;
  contratado: boolean;
  selecionado: boolean;
  onClick: (toothId: number) => void;
}) {
  return (
    <g transform={invertido ? `translate(${tooth.x}, ${tooth.y}) scale(1,-1)` : `translate(${tooth.x}, ${tooth.y})`}>
      <path data-tooth={tooth.id} className={classeDente(contratado, selecionado)} d={pathPermanente(tooth.tipo)} onClick={() => onClick(tooth.id)} />
    </g>
  );
}

function DeciduaTooth({
  id,
  x,
  y,
  invertido,
  contratado,
  selecionado,
  onClick
}: {
  id: number;
  x: number;
  y: number;
  invertido?: boolean;
  contratado: boolean;
  selecionado: boolean;
  onClick: (toothId: number) => void;
}) {
  const ultimo = id % 10;
  const tipo = ultimo === 3 ? "canine" : ultimo === 4 || ultimo === 5 ? "molar" : "incisor";
  return (
    <g transform={invertido ? `translate(${x}, ${y}) scale(1,-1)` : `translate(${x}, ${y})`}>
      <path data-tooth={id} className={classeDente(contratado, selecionado)} d={pathDecidua(tipo)} onClick={() => onClick(id)} />
    </g>
  );
}

function renderPermanente(dentesContratados: number[], dentesSelecionados: number[], onSelectTooth: (toothId: number) => void) {
  return (
    <svg viewBox="0 0 1000 420" xmlns="http://www.w3.org/2000/svg" className="odontograma-figure">
      <line x1="500" y1="20" x2="500" y2="400" className="divider" />
      <line x1="50" y1="210" x2="950" y2="210" className="divider" />

      {FILEIRA_SUPERIOR_PERMANENTE.map((tooth) => (
        <g key={tooth.id}>
          <DentePermanente
            tooth={tooth}
            contratado={dentesContratados.includes(tooth.id)}
            selecionado={dentesSelecionados.includes(tooth.id)}
            onClick={onSelectTooth}
          />
          <text x={tooth.labelX} y={tooth.labelY} className="tooth-number" textAnchor="middle">
            {tooth.id}
          </text>
        </g>
      ))}

      {FILEIRA_INFERIOR_PERMANENTE.map((tooth) => (
        <g key={tooth.id}>
          <DentePermanente
            tooth={tooth}
            invertido
            contratado={dentesContratados.includes(tooth.id)}
            selecionado={dentesSelecionados.includes(tooth.id)}
            onClick={onSelectTooth}
          />
          <text x={tooth.labelX} y={tooth.labelY} className="tooth-number" textAnchor="middle">
            {tooth.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

function renderDecidua(dentesContratados: number[], dentesSelecionados: number[], onSelectTooth: (toothId: number) => void) {
  return (
    <svg viewBox="0 0 560 300" xmlns="http://www.w3.org/2000/svg" className="odontograma-figure decidua">
      <line x1="280" y1="18" x2="280" y2="284" className="divider" />
      <line x1="16" y1="150" x2="544" y2="150" className="divider" />

      {FILEIRA_SUPERIOR_DECIDUA.map((id, index) => (
        <g key={id}>
          <DeciduaTooth
            id={id}
            x={18 + index * 52}
            y={12}
            contratado={dentesContratados.includes(id)}
            selecionado={dentesSelecionados.includes(id)}
            onClick={onSelectTooth}
          />
          <text x={44 + index * 52} y="118" className="tooth-number" textAnchor="middle">
            {id}
          </text>
        </g>
      ))}

      {FILEIRA_INFERIOR_DECIDUA.map((id, index) => (
        <g key={id}>
          <DeciduaTooth
            id={id}
            x={18 + index * 52}
            y={286}
            invertido
            contratado={dentesContratados.includes(id)}
            selecionado={dentesSelecionados.includes(id)}
            onClick={onSelectTooth}
          />
          <text x={44 + index * 52} y="170" className="tooth-number" textAnchor="middle">
            {id}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function Odontograma({ denticao, dentesContratados, dentesSelecionados, onSelectTooth }: OdontogramaProps) {
  return (
    <div className={`odontograma-component ${denticao === "Decidua" ? "decidua" : "permanente"}`}>
      {denticao === "Permanente"
        ? renderPermanente(dentesContratados, dentesSelecionados, onSelectTooth)
        : renderDecidua(dentesContratados, dentesSelecionados, onSelectTooth)}
    </div>
  );
}
