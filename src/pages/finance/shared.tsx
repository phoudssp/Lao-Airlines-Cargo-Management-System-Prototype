import type { ReactNode } from "react";
import { Badge } from "@/ui/kit";
import { useT } from "@/lib/i18n";
import { useDb } from "@/lib/store";
import { rateToLak } from "@/lib/pricing";
import { fmtDateTime, money, num } from "@/lib/format";
import { userName } from "@/ui/cargo";
import type { Receipt, ReceiptStatus } from "@/lib/types";
import { dayOf } from "../reports/metrics";

export function ReceiptBadge({ status }: { status: ReceiptStatus }) { const t = useT(); return status === "valid" ? <Badge tone="ok">{t("ໃຊ້ໄດ້", "Valid")}</Badge> : status === "voided" ? <Badge tone="bad">{t("ຍົກເລີກແລ້ວ", "Voided")}</Badge> : <Badge tone="warn">{t("ຄືນເງິນແລ້ວ", "Refunded")}</Badge>; }
export function MethodBadge({ method }: { method: Receipt["method"] }) { const t = useT(); return <Badge noIcon>{method === "cash" ? t("ເງິນສົດ", "Cash") : t("ເງິນໂອນ", "Transfer")}</Badge>; }

/** Paper header shared by receipts, invoices and handover sheets. Paper always carries both languages. */
export function PaperHead({ station, title, no, children }: { station: string; title: string; no: string; children?: ReactNode }) {
  const d = useDb(); const st = d.stations.find((s) => s.code === station);
  return <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
    <div><div className="text-base font-bold">ລາວ ແອລາຍ / Lao Airlines</div><div className="text-xs">{st?.branchLo} / {st?.branchEn}</div><div className="text-xs">{station}{st?.phone ? ` · ${st.phone}` : ""}</div></div>
    <div className="text-right"><div className="text-lg font-bold">{title}</div><div className="font-mono text-sm font-semibold">{no}</div>{children}</div>
  </div>;
}
export function SignLine({ label }: { label: string }) { return <div className="pt-10 text-center text-xs"><div className="border-t border-black pt-1">{label}</div></div>; }

/** Printed receipt, A4 half page. Reprints carry a DUPLICATE mark so they can never pass as the original. */
export function ReceiptPaper({ receipt: r, duplicate, tendered, change }: { receipt: Receipt; duplicate?: boolean; tendered?: number; change?: number }) {
  const d = useDb();
  const on = dayOf(r.ts); const usdRate = rateToLak(d, "USD", on); const usd = r.currency === "USD" ? r.total : usdRate ? r.lakEquivalent / usdRate : 0;
  return <div className="text-[13px] leading-5 text-black">
    <PaperHead station={r.station} title="ໃບຮັບເງິນ / Receipt" no={r.no}>{duplicate && <div className="mt-1 inline-block border-2 border-black px-2 text-xs font-bold">ສໍາເນົາ / DUPLICATE</div>}{r.status !== "valid" && <div className="mt-1 inline-block border-2 border-black px-2 text-xs font-bold">{r.status === "voided" ? "ຍົກເລີກ / VOID" : "ຄືນເງິນ / REFUNDED"}</div>}</PaperHead>
    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5">
      <div>ວັນທີ / Date: <b className="tnum">{fmtDateTime(r.ts)}</b></div>
      <div>ສະຖານີ / Station: <b className="font-mono">{r.station}</b></div>
      <div>ຜູ້ຈ່າຍ / Received from: <b>{r.payerName}</b></div>
      <div>ຜູ້ຮັບເງິນ / Cashier: <b>{userName(d, r.cashierId, "lo")} ({userName(d, r.cashierId, "en")})</b></div>
      <div>ວິທີຊໍາລະ / Method: <b>{r.method === "cash" ? "ເງິນສົດ / Cash" : `ເງິນໂອນ / Transfer${r.transferRef ? ` ${r.transferRef}` : ""}`}</b></div>
      <div>ປະເພດ / Scope: <b>{r.scope === "domestic" ? "ພາຍໃນ / Domestic" : "ຕ່າງປະເທດ / International"}</b></div>
    </div>
    <table className="mt-2 w-full border-collapse text-[12.5px]">
      <thead><tr className="border-y border-black text-left"><th className="py-1 pr-2 font-semibold">ອ້າງອີງ / Reference</th><th className="py-1 pr-2 font-semibold">ລາຍການ / Description</th><th className="py-1 text-right font-semibold">ຈໍານວນ / Amount</th></tr></thead>
      <tbody>{r.lines.map((l, i) => <tr key={i} className="border-b border-black/20"><td className="py-0.5 pr-2 font-mono text-xs whitespace-nowrap">{l.ref}</td><td className="py-0.5 pr-2">{l.description}</td><td className="py-0.5 text-right tnum whitespace-nowrap">{money(l.amount, l.currency)}</td></tr>)}</tbody>
    </table>
    <div className="mt-2 grid grid-cols-[1fr_auto] items-start gap-6">
      <div className="text-xs">
        <div>ອັດຕາທີ່ໃຊ້ / Rate used: <b className="tnum">{r.currency === "LAK" ? `1 USD = ${num(usdRate)} ₭` : `1 ${r.currency} = ${num(r.rateToLak)} ₭`}</b></div>
        {r.status === "voided" && r.voidReason && <div>ເຫດຜົນຍົກເລີກ / Void reason: {r.voidReason}</div>}
        {r.status === "refunded" && <div>ຄືນເງິນ / Refund: <b className="tnum">{money(r.refundAmount ?? 0, r.currency)}</b>{r.voidReason ? ` · ${r.voidReason}` : ""}</div>}
      </div>
      <table className="text-right"><tbody>
        <tr><td className="pr-4">ລວມຮັບ / Total paid</td><td className="tnum text-base font-bold whitespace-nowrap">{money(r.total, r.currency)}</td></tr>
        <tr><td className="pr-4">ເທົ່າກັບ / In LAK</td><td className="tnum whitespace-nowrap">{money(r.lakEquivalent, "LAK")}</td></tr>
        <tr><td className="pr-4">ເທົ່າກັບ / In USD</td><td className="tnum whitespace-nowrap">{money(usd, "USD")}</td></tr>
        {tendered != null && <tr><td className="pr-4">ຮັບມາ / Tendered</td><td className="tnum whitespace-nowrap">{money(tendered, r.currency)}</td></tr>}
        {change != null && <tr><td className="pr-4">ເງິນທອນ / Change</td><td className="tnum whitespace-nowrap">{money(change, r.currency)}</td></tr>}
      </tbody></table>
    </div>
    <div className="grid grid-cols-2 gap-10"><SignLine label="ຜູ້ຈ່າຍເງິນ / Payer" /><SignLine label="ຜູ້ຮັບເງິນ / Cashier" /></div>
  </div>;
}
