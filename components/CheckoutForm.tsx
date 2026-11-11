"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { formatPrice } from "@/lib/format";
import { goTo } from "@/lib/navigate";
import { EMPTY_SHIPPING, PROVINCES, validateShipping, type Shipping, type ShippingErrors } from "@/lib/shipping";
import { SOCIAL } from "@/lib/site";
import { FREE_SHIPPING_OVER, homeDeliveryEnabled, quoteShipping, type DeliveryMethod } from "@/lib/shippingCost";
import { Button } from "./Button";
import { useCart } from "./cart/CartProvider";
import { ChevronDownIcon } from "./icons";
import { TransferInstructions, type TransferOrder } from "./TransferInstructions";

const input =
  "h-14 w-full rounded-btn border bg-surface px-5 text-paper normal-case placeholder:text-star focus:border-paper aria-[invalid=true]:border-red-400 border-line";

function Field({ id, label, error, optional, children }: { id: string; label: string; error?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label mb-2 block font-bold">
        {label}
        {optional && <span className="font-normal text-star"> (opcional)</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} role="alert" className="label mt-2 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}

export function CheckoutForm() {
  const { items, subtotal } = useCart();
  const [form, setForm] = useState<Shipping>({ ...EMPTY_SHIPPING, method: homeDeliveryEnabled() ? "delivery" : "branch" });
  const [errors, setErrors] = useState<ShippingErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const inFlight = useRef(false);
  const [pay, setPay] = useState<"mp" | "transfer">("mp");
  const [transfer, setTransfer] = useState<{ order: TransferOrder; shipping: Shipping } | null>(null);
  const [terms, setTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const pickup = form.method === "pickup";
  const branch = form.method === "branch";
  const home = form.method === "delivery";
  // Solo para mostrar: el servidor vuelve a calcular el envío al cobrar.
  const quote = subtotal === null ? null : quoteShipping(form.method, form.province, form.zip, subtotal);
  const shippingLabel = !quote ? "[A DEFINIR]" : !quote.ok ? (quote.reason === "no_province" ? "Elegí tu provincia" : quote.reason === "no_zip" ? "Ingresá tu código postal" : "[A DEFINIR]") : quote.cost === 0 ? "Gratis" : formatPrice(quote.cost);
  const noRate = quote?.ok === false && quote.reason === "no_rate";
  const total = subtotal !== null && quote?.ok ? subtotal + quote.cost : null;

  const setMethod = (m: DeliveryMethod) => {
    setForm((f) => ({ ...f, method: m }));
    setErrors((x) => ({ ...x, street: undefined, number: undefined, city: undefined, province: undefined, zip: undefined, branch: undefined }));
  };

  const set = (k: keyof Shipping) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };
  const props = (k: keyof Shipping, auto?: string) => ({
    id: k,
    name: k,
    value: form[k],
    onChange: set(k),
    autoComplete: auto,
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `${k}-error` : undefined,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Traba inmediata (el estado de React tarda un instante): evita crear dos pagos con doble clic o Enter repetido.
    if (inFlight.current) return;
    setFormError(null);
    const check = validateShipping(form);
    if (!check.ok) {
      setErrors(check.errors);
      document.getElementById(Object.keys(check.errors)[0])?.focus();
      return;
    }
    if (!terms) {
      setTermsError(true);
      document.getElementById("terms")?.focus();
      return;
    }
    inFlight.current = true;
    setPaying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Solo se manda qué y cuánto: el servidor pone los precios.
        body: JSON.stringify({
          items: items.map((i) => ({ slug: i.slug, color: i.color, size: i.size, qty: i.qty })),
          shipping: check.value,
          acceptedTerms: terms,
          payment: pay,
        }),
      });
      const data = await res.json();
      if (res.status === 422 && data.fields) {
        setErrors(data.fields);
        throw new Error(data.error);
      }
      if (res.ok && data.transfer) {
        // Transferencia: el stock ya está reservado; se muestran los datos de la cuenta (los de envío salen al tocar "Ya transferí").
        setTransfer({ order: data.transfer, shipping: check.value });
        inFlight.current = false;
        setPaying(false);
        return;
      }
      if (!res.ok || !data.url) throw new Error(data.error ?? "No pudimos iniciar el pago.");
      goTo(data.url);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No pudimos iniciar el pago.");
      inFlight.current = false;
      setPaying(false);
    }
  }

  if (transfer) return <TransferInstructions order={transfer.order} shipping={transfer.shipping} />;

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="display text-4xl">Tu carrito está vacío</p>
        <Button href="/tienda" className="mt-8">Ir a la tienda</Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-12 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
      <div className="space-y-10">
        <fieldset className="space-y-5">
          <legend className="display mb-5 text-3xl">Tus datos</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="name" label="Nombre" error={errors.name}><input {...props("name", "given-name")} className={input} /></Field>
            <Field id="lastname" label="Apellido" error={errors.lastname}><input {...props("lastname", "family-name")} className={input} /></Field>
          </div>
          <Field id="email" label="Email" error={errors.email}><input {...props("email", "email")} type="email" inputMode="email" className={input} /></Field>
          <div className="grid gap-5 sm:grid-cols-[11rem_1fr]">
            <Field id="areaCode" label="Cód. área (sin 0)" error={errors.areaCode}><input {...props("areaCode", "tel-area-code")} inputMode="numeric" placeholder="351" className={input} /></Field>
            <Field id="phone" label="Celular (sin 15)" error={errors.phone}><input {...props("phone", "tel-local")} type="tel" inputMode="tel" placeholder="5551234" className={input} /></Field>
          </div>
          <Field id="dni" label="DNI" optional error={errors.dni}><input {...props("dni")} inputMode="numeric" className={input} /></Field>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="display mb-5 text-3xl">Cómo lo recibís</legend>
          {([
            ["delivery", "Envío a domicilio", `Gratis en Córdoba capital y en compras de más de ${formatPrice(FREE_SHIPPING_OVER)}.`],
            ["branch", "Envío a sucursal de Correo Argentino", `Lo retirás en la sucursal que elijas. Gratis en compras de más de ${formatPrice(FREE_SHIPPING_OVER)}.`],
            ["pickup", "Retiro en Córdoba", "Gratis."],
          ] as const).filter(([value]) => value !== "delivery" || homeDeliveryEnabled()).map(([value, title, hint]) => (
            <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-btn border bg-surface p-4 ${form.method === value ? "border-paper" : "border-line"}`}>
              <input type="radio" name="method" value={value} checked={form.method === value} onChange={() => setMethod(value)} className="mt-1 h-5 w-5 shrink-0 accent-paper" />
              <span>
                <span className="label block font-bold">{title}</span>
                <span className="label block text-[11px] text-star">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {pickup && (
          <p className="label rounded-btn border border-line bg-surface p-4 text-star">
            Si vas a retirar en persona, <span className="font-bold text-paper">escribinos por Instagram (@{SOCIAL.instagram.user})</span> con tu número de pedido y coordinamos el día y el lugar.
          </p>
        )}
        {branch && (
          <fieldset className="space-y-5">
            <legend className="display mb-5 text-3xl">Sucursal de Correo Argentino</legend>
            <Field id="province" label="Provincia" error={errors.province}>
              <div className="relative">
                <select {...props("province", "address-level1")} className={`${input} appearance-none pr-11`}>
                  <option value="">Elegí una provincia</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-star" />
              </div>
            </Field>
            <Field id="branch" label="Sucursal de destino" error={errors.branch}>
              <input {...props("branch")} placeholder="Ej. Sucursal Rosario Centro, Córdoba 721" className={input} />
              <p className="label mt-2 text-[11px] text-star">Escribí el nombre o la dirección de la sucursal de Correo Argentino donde querés retirarlo.</p>
            </Field>
            <Field id="notes" label="Observaciones" optional error={errors.notes}>
              <textarea {...props("notes")} rows={3} className={`${input} h-auto py-4`} />
            </Field>
          </fieldset>
        )}
        {home && (
        <fieldset className="space-y-5">
          <legend className="display mb-5 text-3xl">Dirección de envío</legend>
          <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
            <Field id="street" label="Calle" error={errors.street}><input {...props("street", "address-line1")} className={input} /></Field>
            <Field id="number" label="Número" error={errors.number}><input {...props("number")} inputMode="numeric" className={input} /></Field>
          </div>
          <Field id="floor" label="Piso / Depto" optional error={errors.floor}><input {...props("floor", "address-line2")} className={input} /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="city" label="Localidad" error={errors.city}><input {...props("city", "address-level2")} className={input} /></Field>
            <Field id="zip" label="Código postal" error={errors.zip}><input {...props("zip", "postal-code")} className={input} /></Field>
          </div>
          <Field id="province" label="Provincia" error={errors.province}>
            <div className="relative">
              <select {...props("province", "address-level1")} className={`${input} appearance-none pr-11`}>
                <option value="">Elegí una provincia</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-star" />
            </div>
          </Field>
          <Field id="notes" label="Indicaciones para el envío" optional error={errors.notes}>
            <textarea {...props("notes")} rows={3} placeholder="Ej. timbre, horario, entre calles…" className={`${input} h-auto py-4`} />
          </Field>
        </fieldset>
        )}
        {pickup && (
          <Field id="notes" label="Indicaciones" optional error={errors.notes}>
            <textarea {...props("notes")} rows={3} placeholder="Ej. horario en el que pasás" className={`${input} h-auto py-4`} />
          </Field>
        )}

        <fieldset className="space-y-3">
          <legend className="display mb-5 text-3xl">Cómo pagás</legend>
          {([
            ["mp", "Mercado Pago", "Tarjeta, dinero en cuenta y otros medios. Se confirma al instante."],
            ["transfer", "Transferencia bancaria", "Reservamos tu pedido 24 horas. Nos mandás el comprobante por Instagram."],
          ] as const).map(([value, title, hint]) => (
            <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-btn border bg-surface p-4 ${pay === value ? "border-paper" : "border-line"}`}>
              <input type="radio" name="payment" value={value} checked={pay === value} onChange={() => setPay(value)} className="mt-1 h-5 w-5 shrink-0 accent-paper" />
              <span>
                <span className="label block font-bold">{title}</span>
                <span className="label block text-[11px] text-star">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <aside className="h-fit rounded-card border border-line bg-surface p-6 lg:sticky lg:top-28">
        <h2 className="display text-3xl">Tu pedido</h2>
        <ul className="mt-6 divide-y divide-line">
          {items.map((i) => (
            <li key={i.key} className="flex gap-4 py-4">
              <div className="relative aspect-square w-16 shrink-0 overflow-hidden rounded-[12px] border border-line">
                <Image src={i.image} alt="" fill sizes="64px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="label font-bold">{i.name}</p>
                <p className="label text-star">{i.color} · Talle {i.size} · x{i.qty}</p>
              </div>
              <p className="label font-bold">{formatPrice(i.price === null ? null : i.price * i.qty)}</p>
            </li>
          ))}
        </ul>
        <dl className="label mt-4 space-y-2 border-t border-line pt-4">
          <div className="flex justify-between"><dt className="text-star">Subtotal</dt><dd className="font-bold">{formatPrice(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-star">Envío</dt><dd className="font-bold">{shippingLabel}</dd></div>
          <div className="flex justify-between border-t border-line pt-2"><dt className="text-star">Total</dt><dd className="font-bold">{formatPrice(total)}</dd></div>
        </dl>
        {noRate && <p className="label mt-3 text-[11px] text-star">Todavía no enviamos a tu zona. Elegí retiro en Córdoba o superá {formatPrice(FREE_SHIPPING_OVER)} en productos para envío gratis.</p>}

        <div className="mt-6">
          <label htmlFor="terms" className="flex cursor-pointer items-start gap-3 text-star">
            <input
              id="terms"
              type="checkbox"
              checked={terms}
              onChange={(e) => { setTerms(e.target.checked); setTermsError(false); }}
              aria-invalid={termsError || undefined}
              aria-describedby={termsError ? "terms-error" : undefined}
              className="mt-1 h-5 w-5 shrink-0 accent-paper"
            />
            <span className="text-[13px] leading-snug">
              Leí y acepto los <Link href="/legal/terminos" target="_blank" className="text-paper underline underline-offset-4">Términos y condiciones</Link>{" "}
              y la <Link href="/legal/privacidad" target="_blank" className="text-paper underline underline-offset-4">Política de privacidad</Link>.
            </span>
          </label>
          {termsError && <p id="terms-error" role="alert" className="label mt-2 text-[11px] text-red-300">Tenés que aceptarlos para continuar.</p>}
        </div>

        {formError && <p role="alert" className="label mt-5 text-red-300">{formError}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={paying}>{paying ? (pay === "transfer" ? "Reservando…" : "Redirigiendo…") : pay === "transfer" ? "Reservar y ver datos de transferencia" : "Ir a pagar"}</Button>
        <p className="label mt-4 text-center text-[11px] text-star">
          {pay === "transfer" ? "Pagás por transferencia. " : "Pagás en Mercado Pago. "}Usamos tus datos solo para enviarte el pedido.
        </p>
      </aside>
    </form>
  );
}
