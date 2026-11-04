import type { SizeChart } from "@/data/sizeCharts";

/** Tabla de talles. El talle elegido se resalta en azul de marca. */
export function SizeTable({ chart, selected }: { chart: SizeChart; selected?: string | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="label w-full min-w-[22rem] text-left">
        <caption className="sr-only">Medidas en centímetros, prenda en plano</caption>
        <thead>
          <tr className="border-b border-slate text-slate-text">
            <th scope="col" className="py-2 pr-4 font-bold">Talle</th>
            {chart.columns.map((c) => <th key={c} scope="col" className="py-2 pr-4 font-bold">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {Object.entries(chart.measures).map(([size, values]) => {
            const on = size === selected;
            return (
              <tr key={size} aria-current={on || undefined} className={`border-b border-line last:border-0 ${on ? "bg-slate/20" : ""}`}>
                <th scope="row" className="py-3 pr-4 font-bold">{size}</th>
                {values.map((v, i) => <td key={i} className="py-3 pr-4 text-star">{v}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="label mt-3 text-[11px] text-star">Medidas en cm, con la prenda en plano. [MEDIDAS REALES — completar]</p>
    </div>
  );
}
