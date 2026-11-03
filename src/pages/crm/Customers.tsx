import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { nowIso, useCan, useDb } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Badge, Button, Callout, Checkbox, Col, Confirm, DataTable, Dialog, Empty, Field, IconButton, Input, PageHeader, Panel, Select, StatRow, Textarea, toast, type Tone } from "@/ui/kit";
import type { Customer, CustomerType } from "@/lib/types";
import { money } from "@/lib/format";
import { customerHistory, customerInUse, deleteCustomer, newCustomerId, saveCustomer } from "@/lib/mock/booking";
import { creditUsed } from "@/lib/mock/finance";

const TYPES: Record<CustomerType, [Tone, string, string]> = { agent: ["info", "ຕົວແທນ", "Agent"], corporate: ["neutral", "ບໍລິສັດ", "Corporate"], general: ["neutral", "ລູກຄ້າທົ່ວໄປ", "General"] };
const PREFIX: Record<CustomerType, string> = { agent: "AG", corporate: "CP", general: "GN" };
export function CustomerTypeBadge({ type }: { type: CustomerType }) { const t = useT(); const [tone, lo, en] = TYPES[type]; return <Badge tone={tone} noIcon>{t(lo, en)}</Badge>; }

/** Create or edit a customer. Used from the list and from the customer's own page. */
export function CustomerDialog({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved?: (id: string) => void }) {
  const d = useDb(); const t = useT();
  const [f, setF] = useState({ type: customer?.type ?? ("general" as CustomerType), name: customer?.name ?? "", nameEn: customer?.nameEn ?? "", contact: customer?.contact ?? "", phone: customer?.phone ?? "", whatsapp: customer?.whatsapp ?? "", email: customer?.email ?? "", address: customer?.address ?? "", station: customer?.station ?? d.session.station, creditLimit: String(customer?.creditLimit ?? 0), creditDays: String(customer?.creditDays ?? 0), portalUser: customer?.portalUser ?? "", active: customer?.active ?? true, note: customer?.note ?? "" });
  const [noWa, setNoWa] = useState(customer ? !customer.whatsapp : false); const [tried, setTried] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const portal = f.portalUser.trim();
  const portalTaken = !!portal && d.customers.some((c) => c.portalUser === portal && c.id !== customer?.id);
  const creditLimit = Number(f.creditLimit); const creditDays = Number(f.creditDays);
  const errors = { name: !f.name.trim(), nameEn: !f.nameEn.trim(), contact: !f.contact.trim(), phone: !f.phone.trim(), whatsapp: !noWa && !f.whatsapp.trim(), address: !f.address.trim(), creditLimit: !(creditLimit >= 0), creditDays: !(creditDays >= 0) || (creditLimit > 0 && creditDays <= 0), portal: portalTaken };
  function save() {
    setTried(true); if (Object.values(errors).some(Boolean)) return;
    const nums = d.customers.filter((c) => c.code.startsWith(PREFIX[f.type])).map((c) => Number(c.code.slice(2)) || 0);
    const next: Customer = { id: customer?.id ?? newCustomerId(), code: customer?.code ?? `${PREFIX[f.type]}${nums.length ? Math.max(...nums) + 1 : 101}`, type: f.type, name: f.name.trim(), nameEn: f.nameEn.trim(), contact: f.contact.trim(), phone: f.phone.trim(), whatsapp: noWa ? undefined : f.whatsapp.trim(), email: f.email.trim() || undefined, address: f.address.trim(), station: f.station, creditLimit, creditDays, portalUser: portal || undefined, active: f.active, note: f.note.trim() || undefined, createdAt: customer?.createdAt ?? nowIso() };
    saveCustomer(next, !customer); toast(customer ? t("ບັນທຶກຂໍ້ມູນລູກຄ້າແລ້ວ", "Customer updated") : t(`ສ້າງລູກຄ້າ ${next.code} ແລ້ວ`, `Customer ${next.code} created`)); onSaved?.(next.id); onClose();
  }
  const req = t("ກະລຸນາປ້ອນຂໍ້ມູນນີ້", "Enter this field");
  return <Dialog open size="lg" onClose={onClose} title={customer ? t(`ແກ້ໄຂ ${customer.code}`, `Edit ${customer.code}`) : t("ສ້າງລູກຄ້າໃໝ່", "New customer")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{customer ? t("ບັນທຶກ", "Save changes") : t("ສ້າງລູກຄ້າ", "Create customer")}</Button></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("ປະເພດ", "Type")} required hint={customer ? undefined : t("ລະຫັດລູກຄ້າຈະຖືກສ້າງຕາມປະເພດ", "The customer code is generated from the type")}><Select value={f.type} onChange={(e) => set("type", e.target.value as CustomerType)} options={(Object.keys(TYPES) as CustomerType[]).map((k) => ({ value: k, label: t(TYPES[k][1], TYPES[k][2]) }))} /></Field>
      <Field label={t("ສະຖານີຫຼັກ", "Home station")} required><Select value={f.station} onChange={(e) => set("station", e.target.value)} options={d.stations.filter((s) => s.active).map((s) => ({ value: s.code, label: `${s.code} · ${t(s.nameLo, s.nameEn)}` }))} /></Field>
      <Field label={t("ຊື່ (ພາສາລາວ)", "Name (Lao)")} required error={tried && errors.name ? req : undefined}><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <Field label={t("ຊື່ (ພາສາອັງກິດ)", "Name (English)")} required error={tried && errors.nameEn ? t("ໃຊ້ໃນ AWB ແລະ ຂໍ້ຄວາມ FWB", "Used on the AWB and in FWB messages") : undefined}><Input value={f.nameEn} onChange={(e) => set("nameEn", e.target.value)} /></Field>
      <Field label={t("ຜູ້ຕິດຕໍ່", "Contact person")} required error={tried && errors.contact ? req : undefined}><Input value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
      <Field label={t("ເບີໂທ", "Phone")} required error={tried && errors.phone ? req : undefined}><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      <div>
        <Field label={t("ເບີ WhatsApp", "WhatsApp number")} required={!noWa} error={tried && errors.whatsapp ? t("ປ້ອນເບີ ຫຼື ໝາຍວ່າບໍ່ມີ WhatsApp", "Enter a number or tick no WhatsApp") : undefined}><Input value={noWa ? "" : f.whatsapp} disabled={noWa} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
        <div className="mt-1.5"><Checkbox label={t("ລູກຄ້າບໍ່ມີ WhatsApp", "Customer has no WhatsApp")} checked={noWa} onChange={setNoWa} /></div>
        {noWa && <p className="mt-1 text-xs text-ink-2">{t("ລະບົບຈະສ້າງໝາຍເຫດໃຫ້ພະນັກງານໂທແຈ້ງແທນ.", "The system will leave a note telling staff to call instead.")}</p>}
      </div>
      <Field label={t("ອີເມວ", "Email")}><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
      <Field className="sm:col-span-2" label={t("ທີ່ຢູ່", "Address")} required error={tried && errors.address ? req : undefined}><Textarea rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
      <Field label={t("ວົງເງິນສິນເຊື່ອ (ກີບ)", "Credit limit (LAK)")} hint={t("0 ໝາຍເຖິງຈ່າຍສົດເທົ່ານັ້ນ", "0 means cash only")} error={tried && errors.creditLimit ? t("ວົງເງິນຕ້ອງບໍ່ຕິດລົບ", "The limit can't be negative") : undefined}><Input type="number" min={0} step={1000000} value={f.creditLimit} onChange={(e) => set("creditLimit", e.target.value)} /></Field>
      <Field label={t("ໄລຍະສິນເຊື່ອ (ວັນ)", "Credit days")} error={tried && errors.creditDays ? t("ກໍານົດຈໍານວນວັນ ເມື່ອມີວົງເງິນສິນເຊື່ອ", "Set the days when there is a credit limit") : undefined}><Input type="number" min={0} value={f.creditDays} onChange={(e) => set("creditDays", e.target.value)} /></Field>
      <Field label={t("ຊື່ຜູ້ໃຊ້ Portal", "Portal user")} hint={t("ປ່ອຍຫວ່າງຖ້າບໍ່ໃຊ້ Portal", "Leave blank if they don't use the portal")} error={tried && errors.portal ? t(`ຊື່ ${portal} ຖືກໃຊ້ແລ້ວ. ກະລຸນາເລືອກຊື່ອື່ນ.`, `${portal} is already taken. Choose another name.`) : undefined}><Input className="font-mono" value={f.portalUser} onChange={(e) => set("portalUser", e.target.value.replace(/\s/g, "").toLowerCase())} /></Field>
      <div className="self-end pb-2"><Checkbox label={t("ເປີດໃຊ້ງານ", "Active")} checked={f.active} onChange={(v) => set("active", v)} /></div>
      <Field className="sm:col-span-2" label={t("ໝາຍເຫດ", "Note")}><Textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
    </div>
  </Dialog>;
}

export default function Customers() {
  const d = useDb(); const t = useT(); const can = useCan(); const nav = useNavigate();
  const [type, setType] = useState(""); const [station, setStation] = useState("");
  const [edit, setEdit] = useState<Customer | "new" | null>(null); const [del, setDel] = useState<Customer | null>(null); const [blocked, setBlocked] = useState<Customer | null>(null);
  const manage = can("crm.manage");
  const rows = useMemo(() => d.customers.filter((c) => (!type || c.type === type) && (!station || c.station === station)), [d.customers, type, station]);
  const blockedHist = blocked ? customerHistory(d, blocked.id) : null;
  const usedOf = (c: Customer) => creditUsed(d, c.id);
  const nearLimit = d.customers.filter((c) => c.creditLimit > 0 && usedOf(c) >= c.creditLimit * 0.8).length;
  const cols: Col<Customer>[] = [
    { key: "code", header: t("ລະຫັດ", "Code"), mono: true, render: (c) => <span className="font-semibold">{c.code}</span>, sort: (c) => c.code },
    { key: "name", header: t("ຊື່", "Name"), render: (c) => <span className="line-clamp-1">{t(c.name, c.nameEn)}{!c.active && <span className="ml-1.5"><Badge>{t("ປິດໃຊ້ງານ", "Inactive")}</Badge></span>}</span>, sort: (c) => t(c.name, c.nameEn) },
    { key: "type", header: t("ປະເພດ", "Type"), render: (c) => <CustomerTypeBadge type={c.type} />, sort: (c) => c.type },
    { key: "contact", header: t("ຜູ້ຕິດຕໍ່", "Contact"), render: (c) => <span className="line-clamp-1">{c.contact}</span> },
    { key: "phone", header: t("ເບີໂທ", "Phone"), render: (c) => <span className="tnum whitespace-nowrap">{c.phone}</span> },
    { key: "wa", header: "WhatsApp", render: (c) => c.whatsapp ? <Badge tone="ok">{t("ມີ", "Yes")}</Badge> : <Badge tone="warn">{t("ບໍ່ມີ: ໂທແຈ້ງ", "No: call")}</Badge> },
    { key: "station", header: t("ສະຖານີ", "Station"), mono: true, render: (c) => c.station, sort: (c) => c.station },
    { key: "limit", header: t("ວົງເງິນ", "Credit limit"), align: "right", render: (c) => c.creditLimit ? <span className="whitespace-nowrap">{money(c.creditLimit)}</span> : <span className="text-ink-3">{t("ຈ່າຍສົດ", "Cash")}</span>, sort: (c) => c.creditLimit },
    { key: "used", header: t("ໃຊ້ໄປ", "Used"), align: "right", render: (c) => c.creditLimit ? <span className={usedOf(c) > c.creditLimit ? "font-semibold text-bad whitespace-nowrap" : "whitespace-nowrap"}>{money(usedOf(c))}</span> : "", sort: usedOf },
    { key: "portal", header: "Portal", mono: true, render: (c) => c.portalUser ?? "" },
    ...(manage ? [{ key: "act", header: "", align: "right" as const, render: (c: Customer) => <span className="inline-flex" onClick={(e) => e.stopPropagation()}><IconButton icon={Pencil} label={t(`ແກ້ໄຂ ${c.code}`, `Edit ${c.code}`)} onClick={() => setEdit(c)} /><IconButton icon={Trash2} label={t(`ລຶບ ${c.code}`, `Delete ${c.code}`)} onClick={() => (customerInUse(c.id) ? setBlocked(c) : setDel(c))} /></span> }] : []),
  ];
  return <>
    <PageHeader title={t("ລູກຄ້າ ແລະ ຕົວແທນ", "Customers & agents")} subtitle={t("ຂໍ້ມູນຕິດຕໍ່, ວົງເງິນສິນເຊື່ອ ແລະ ປະຫວັດການໃຊ້ບໍລິການຂອງລູກຄ້າທຸກສາຂາ.", "Contacts, credit limits and service history for customers at every branch.")} actions={manage && <Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>{t("ສ້າງລູກຄ້າໃໝ່", "New customer")}</Button>} />
    <StatRow items={[
      { label: t("ລູກຄ້າທັງໝົດ", "All customers"), value: d.customers.length, sub: t(`${d.customers.filter((c) => c.active).length} ເປີດໃຊ້ງານ`, `${d.customers.filter((c) => c.active).length} active`) },
      { label: t("ຕົວແທນ", "Agents"), value: d.customers.filter((c) => c.type === "agent").length },
      { label: t("ບໍ່ມີ WhatsApp", "No WhatsApp"), value: d.customers.filter((c) => !c.whatsapp).length, sub: t("ພະນັກງານຕ້ອງໂທແຈ້ງ", "Staff must call them") },
      { label: t("ໃຊ້ວົງເງິນເກີນ 80%", "Over 80% of credit"), value: nearLimit, tone: nearLimit ? "warn" : undefined },
    ]} />
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(c) => c.id} minWidth={1120} pageSize={14} defaultSort={{ key: "code", dir: "asc" }} onRowClick={(c) => nav(`/crm/${c.id}`)}
        search={(c) => `${c.code} ${c.name} ${c.nameEn} ${c.contact} ${c.phone} ${c.whatsapp ?? ""} ${c.portalUser ?? ""}`}
        filters={<>
          <Select aria-label={t("ປະເພດ", "Type")} className="w-auto" value={type} onChange={(e) => setType(e.target.value)} placeholder={t("ທຸກປະເພດ", "All types")} options={(Object.keys(TYPES) as CustomerType[]).map((k) => ({ value: k, label: t(TYPES[k][1], TYPES[k][2]) }))} />
          <Select aria-label={t("ສະຖານີ", "Station")} className="w-auto" value={station} onChange={(e) => setStation(e.target.value)} placeholder={t("ທຸກສະຖານີ", "All stations")} options={d.stations.map((s) => ({ value: s.code, label: s.code }))} />
        </>}
        empty={<Empty title={t("ບໍ່ພົບລູກຄ້າຕາມເງື່ອນໄຂນີ້", "No customers match these filters")} action={manage ? <Button icon={Plus} onClick={() => setEdit("new")}>{t("ສ້າງລູກຄ້າໃໝ່", "New customer")}</Button> : undefined}>{t("ລອງປ່ຽນປະເພດ ຫຼື ສະຖານີ.", "Try another type or station.")}</Empty>} />
    </Panel>
    {edit && <CustomerDialog customer={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} onSaved={edit === "new" ? (id) => nav(`/crm/${id}`) : undefined} />}
    <Confirm open={!!del} onClose={() => setDel(null)} danger title={t(`ລຶບ ${del?.code}?`, `Delete ${del?.code}?`)} body={t(`${del?.name} ຈະຖືກລຶບອອກຈາກລະບົບ. ລູກຄ້ານີ້ຍັງບໍ່ມີປະຫວັດການໃຊ້ບໍລິການ.`, `${del?.nameEn} will be removed. This customer has no service history yet.`)} confirmLabel={t("ລຶບລູກຄ້າ", "Delete customer")} onConfirm={() => { if (del) { deleteCustomer(del.id); toast(t("ລຶບລູກຄ້າແລ້ວ", "Customer deleted")); } }} />
    <Dialog open={!!blocked} size="sm" onClose={() => setBlocked(null)} title={t(`ບໍ່ສາມາດລຶບ ${blocked?.code} ໄດ້`, `${blocked?.code} can't be deleted`)} footer={<>
      <Button onClick={() => setBlocked(null)}>{t("ປິດ", "Close")}</Button>
      {blocked?.active && <Button variant="primary" onClick={() => { if (blocked) { saveCustomer({ ...blocked, active: false }, false); toast(t("ປິດໃຊ້ງານລູກຄ້າແລ້ວ", "Customer deactivated")); } setBlocked(null); }}>{t("ປິດໃຊ້ງານແທນ", "Deactivate instead")}</Button>}
    </>}>
      <Callout tone="warn" title={t("ລູກຄ້ານີ້ມີປະຫວັດໃນລະບົບ", "This customer has records in the system")}>{t(`ມີ ${blockedHist?.awbs.length} AWB, ${blockedHist?.bookings.length} ການຈອງ ແລະ ${blockedHist?.invoices.length} ໃບເກັບເງິນ. ຕ້ອງເກັບໄວ້ເພື່ອການກວດສອບ. ໃຫ້ປິດໃຊ້ງານແທນການລຶບ.`, `There are ${blockedHist?.awbs.length} AWBs, ${blockedHist?.bookings.length} bookings and ${blockedHist?.invoices.length} invoices that must stay for audit. Deactivate the customer instead.`)}</Callout>
    </Dialog>
  </>;
}
