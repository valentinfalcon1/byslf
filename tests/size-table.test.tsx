// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { sizeChartFor } from "@/data/sizeCharts";
import { SizeTable } from "@/components/SizeTable";

afterEach(cleanup);

describe("tabla de talles", () => {
  it("las prendas tienen tabla con una fila por talle y los accesorios no", () => {
    const sizes = ["S", "M", "L"];
    expect(Object.keys(sizeChartFor("buzos", sizes)!.measures)).toEqual(sizes);
    expect(sizeChartFor("pantalones", sizes)!.columns).toContain("Cintura");
    expect(sizeChartFor("accesorios", sizes)).toBeNull();
  });

  it("muestra las medidas pendientes como placeholder, sin inventar números", () => {
    render(<SizeTable chart={sizeChartFor("remeras", ["S", "M"])!} />);
    expect(screen.getAllByText("[CM]")).toHaveLength(6);
  });

  it("resalta solo el talle elegido", () => {
    render(<SizeTable chart={sizeChartFor("buzos", ["S", "M", "L"])!} selected="M" />);
    const rows = screen.getAllByRole("row");
    const current = rows.filter((r) => r.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(within(current[0]).getByRole("rowheader").textContent).toBe("M");
  });
});
