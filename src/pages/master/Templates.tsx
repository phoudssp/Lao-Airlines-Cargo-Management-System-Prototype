import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCan, useDb } from "@/lib/store";
import { useName, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Checkbox, Col, Confirm, DataTable, Dialog, Field, IconButton, Input, MonoCode, PageHeader, Panel, Select, Textarea, toast } from "@/ui/kit";
import type { Db, MessageTemplate } from "@/lib/types";
import { newId, removeFrom, saveTemplate } from "@/lib/mock/master";

type Key = MessageTemplate["key"];
const KEYS: Record<Key, [string, string]> = { arrival: ["ແຈ້ງສິນຄ້າມາຮອດ", "Arrival notice"], aging: ["ແຈ້ງສິນຄ້າຄ້າງສາງ", "Aging reminder"], offload: ["ແຈ້ງສິນຄ້າອ໋ອບໂຫຼດ", "Offload notice"], booking: ["ແຈ້ງຜົນການຈອງ", "Booking result"] };
/** Placeholder, meaning in Lao and English, sample value in Lao and English. */
const PLACEHOLDERS: Record<string, [string, string, string, string]> = {
  name: ["ຊື່ຜູ້ຕິດຕໍ່ລູກຄ້າ", "Customer contact", "ທ່ານ ອານຸສອນ", "Mr Anousone"],
  awb: ["ເລກ AWB", "AWB number", "627-4410 1234", "627-4410 1234"],
  pieces: ["ຈໍານວນກ່ອງ", "Pieces", "12", "12"],
  station: ["ສະຖານີ", "Station", "VTE", "VTE"],
  flight: ["ຖ້ຽວບິນ", "Flight", "QV446", "QV446"],
  days: ["ຈໍານວນວັນຄ້າງສາງ", "Days in storage", "32", "32"],
  fee: ["ຄ່າຝາກສາງ", "Storage fee", "576,000 ₭", "576,000 ₭"],
  reason: ["ເຫດຜົນ", "Reason", "ພື້ນທີ່ເຕັມ", "no space on board"],
  next: ["ຖ້ຽວບິນໃໝ່", "New flight", "QV445 05/11/2026", "QV445 05/11/2026"],
  booking: ["ເລກການຈອງ", "Booking number", "BK2611-1012", "BK2611-1012"],
  status: ["ຜົນການຈອງ", "Booking result", "ຢືນຢັນແລ້ວ", "Confirmed"],
};
const FOR_KEY: Record<Key, string[]> = { arrival: ["name", "awb", "pieces", "station", "flight"], aging: ["name", "awb", "pieces", "days", "fee"], offload: ["name", "awb", "pieces", "flight", "reason", "next"], booking: ["name", "booking", "flight", "status", "reason"] };

const fill = (body: string, lang: "lo" | "en") => body.replace(/\{(\w+)\}/g, (m, k) => { const p = PLACEHOLDERS[k]; return p ? p[lang === "lo" ? 2 : 3] : m; });
const usedIn = (body: string) => [...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const unknownIn = (body: string, key: Key) => [...new Set(usedIn(body))].filter((k) => !FOR_KEY[key].includes(k));
const activeOf = (d: Db, key: Key, except?: string) => d.templates.find((x) => x.key === key && x.active && x.id !== except);

function Bubble({ label, text }: { label: string; text: string }) {
  return <div><div className="box-label mb-1">{label}</div><div className="whitespace-pre-wrap rounded border border-line bg-surface-2 px-3 py-2 text-sm">{text || "—"}</div></div>;
}
function PlaceholderList({ tkey }: { tkey: Key }) {
  const t = useT();
  return <ul className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">{FOR_KEY[tkey].map((k) => <li key={k} className="flex items-baseline gap-1.5"><MonoCode className="font-semibold">{`{${k}}`}</MonoCode><span className="text-ink-2">{t(PLACEHOLDERS[k][0], PLACEHOLDERS[k][1])}</span></li>)}</ul>;
}

export default function Templates() {
  const d = useDb(); const t = useT(); const name = useName(); const can = useCan();
  const manage = can("master.manage");
  const [sel, setSel] = useState<string>(d.templates[0]?.id ?? ""); const [edit, setEdit] = useState<MessageTemplate | "new" | null>(null); const [del, setDel] = useState<MessageTemplate | null>(null);
  const cur = d.templates.find((x) => x.id === sel) ?? d.templates[0];
  const toggle = (x: MessageTemplate, active: boolean) => {
    if (!active) { toast(t(`ຕ້ອງມີແບບຟອມເປີດໃຊ້ສໍາລັບ "${t(KEYS[x.key][0], KEYS[x.key][1])}". ໃຫ້ເປີດໃຊ້ແບບຟອມອື່ນແທນ`, `"${KEYS[x.key][1]}" needs one active template. Activate another one in its place.`), "warn"); return; }
    saveTemplate({ ...x, active: true }, false);
    toast(t(`ໃຊ້ "${name(x)}" ສົ່ງແຈ້ງເຕືອນແລ້ວ`, `"${name(x)}" is now the active template`));
  };
  const cols: Col<MessageTemplate>[] = [
    { key: "name", header: t("ຊື່ແບບຟອມ", "Template"), render: (x) => <span className="font-medium">{name(x)}</span>, sort: (x) => x.nameEn },
    { key: "key", header: t("ປະເພດແຈ້ງເຕືອນ", "Notice type"), render: (x) => t(KEYS[x.key][0], KEYS[x.key][1]), sort: (x) => x.key },
    { key: "active", header: t("ສະຖານະ", "Status"), render: (x) => <span onClick={(e) => e.stopPropagation()}><Checkbox label={x.active ? t("ເປີດໃຊ້", "Active") : t("ປິດໃຊ້", "Inactive")} checked={x.active} disabled={!manage} onChange={(v) => toggle(x, v)} /></span> },
    ...(manage ? [{ key: "act", header: "", align: "right" as const, render: (x: MessageTemplate) => <span className="inline-flex" onClick={(e) => e.stopPropagation()}><IconButton icon={Pencil} label={t(`ແກ້ໄຂ ${name(x)}`, `Edit ${name(x)}`)} onClick={() => setEdit(x)} /><IconButton icon={Trash2} label={t(`ລຶບ ${name(x)}`, `Delete ${name(x)}`)} onClick={() => setDel(x)} /></span> }] : []),
  ];
  return <>
    <PageHeader title={t("ແບບຟອມແຈ້ງເຕືອນ", "Notice templates")} subtitle={t("ຂໍ້ຄວາມ WhatsApp ທີ່ສົ່ງຫາລູກຄ້າ. ແຕ່ລະປະເພດແຈ້ງເຕືອນເປີດໃຊ້ໄດ້ 1 ແບບຟອມ ແລະ ຂໍ້ຄວາມທີ່ສົ່ງຈິງໃຊ້ພາສາລາວ.", "The WhatsApp messages sent to customers. Each notice type uses one active template, and notices go out in Lao.")} actions={manage && <Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>{t("ເພີ່ມແບບຟອມ", "Add template")}</Button>} />
    {!manage && <div className="mb-3"><Callout tone="info">{t("ທ່ານເບິ່ງໄດ້ຢ່າງດຽວ. ການແກ້ໄຂຕ້ອງມີສິດຈັດການຂໍ້ມູນພື້ນຖານ.", "You can view this list. Changes need the Manage master data permission.")}</Callout></div>}
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel flush><DataTable rows={d.templates} columns={cols} rowKey={(x) => x.id} minWidth={480} onRowClick={(x) => setSel(x.id)} search={(x) => `${x.nameLo} ${x.nameEn} ${x.bodyLo} ${x.bodyEn}`} /></Panel>
      {cur && <Panel title={<span className="inline-flex flex-wrap items-center gap-2">{t("ຕົວຢ່າງ", "Preview")}: {name(cur)}{cur.active ? <Badge tone="ok">{t("ເປີດໃຊ້", "Active")}</Badge> : <Badge>{t("ປິດໃຊ້", "Inactive")}</Badge>}</span>}>
        <div className="space-y-3">
          <Bubble label={t("ພາສາລາວ", "Lao")} text={fill(cur.bodyLo, "lo")} />
          <Bubble label={t("ພາສາອັງກິດ", "English")} text={fill(cur.bodyEn, "en")} />
          <div><div className="box-label mb-1">{t("ຕົວແປທີ່ໃຊ້ໄດ້", "Available placeholders")}</div><PlaceholderList tkey={cur.key} /></div>
        </div>
      </Panel>}
    </div>
    {edit && <TemplateForm template={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} onSaved={setSel} />}
    <Dialog open={!!del?.active} onClose={() => setDel(null)} size="sm" title={t("ລຶບແບບຟອມນີ້ບໍ່ໄດ້", "This template cannot be deleted")} footer={<Button onClick={() => setDel(null)}>{t("ປິດ", "Close")}</Button>}>
      <p className="text-sm">{t("ແບບຟອມນີ້ກໍາລັງໃຊ້ສົ່ງແຈ້ງເຕືອນຢູ່. ຖ້າລຶບ ລູກຄ້າຈະບໍ່ໄດ້ຮັບແຈ້ງເຕືອນປະເພດນີ້. ກະລຸນາເປີດໃຊ້ແບບຟອມອື່ນຂອງປະເພດນີ້ກ່ອນ.", "Notices are being sent with this template. Without it, customers would stop receiving this notice type. Activate another template of the same type first.")}</p>
    </Dialog>
    <Confirm open={!!del && !del.active} onClose={() => setDel(null)} danger title={t("ລຶບແບບຟອມນີ້?", "Delete this template?")} body={del ? name(del) : ""} confirmLabel={t("ລຶບແບບຟອມ", "Delete template")} onConfirm={() => { if (del) { removeFrom("templates", del.id); toast(t("ລຶບແບບຟອມແລ້ວ", "Template deleted")); } }} />
  </>;
}

function TemplateForm({ template, onClose, onSaved }: { template?: MessageTemplate; onClose: () => void; onSaved: (id: string) => void }) {
  const d = useDb(); const t = useT();
  const [f, setF] = useState<MessageTemplate>(template ?? { id: "", key: "arrival", nameLo: "", nameEn: "", bodyLo: "", bodyEn: "", active: false });
  const [tried, setTried] = useState(false);
  const set = (p: Partial<MessageTemplate>) => setF((x) => ({ ...x, ...p }));
  const req = t("ກະລຸນາປ້ອນຂໍ້ມູນນີ້", "Enter this field");
  const badPh = (body: string) => { const u = unknownIn(body, f.key); return u.length ? t(`ບໍ່ຮູ້ຈັກຕົວແປ ${u.map((k) => `{${k}}`).join(" ")}. ກະລຸນາໃຊ້ຕົວແປໃນລາຍການ`, `Unknown placeholder ${u.map((k) => `{${k}}`).join(" ")}. Use one from the list`) : ""; };
  const errs = { nameLo: f.nameLo.trim() ? "" : req, nameEn: f.nameEn.trim() ? "" : req, bodyLo: !f.bodyLo.trim() ? req : badPh(f.bodyLo), bodyEn: !f.bodyEn.trim() ? req : badPh(f.bodyEn) };
  const replaces = f.active ? activeOf(d, f.key, f.id) : undefined;
  const mustStayActive = !!template?.active && !activeOf(d, f.key, f.id);
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return;
    const item = { ...f, id: f.id || newId("TM"), nameLo: f.nameLo.trim(), nameEn: f.nameEn.trim() };
    saveTemplate(item, !template); onSaved(item.id);
    toast(template ? t("ບັນທຶກແບບຟອມແລ້ວ", "Template saved") : t("ເພີ່ມແບບຟອມແລ້ວ", "Template added")); onClose();
  };
  return <Dialog open onClose={onClose} size="xl" title={template ? t("ແກ້ໄຂແບບຟອມ", "Edit template") : t("ເພີ່ມແບບຟອມ", "Add template")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{template ? t("ບັນທຶກການແກ້ໄຂ", "Save changes") : t("ເພີ່ມແບບຟອມ", "Add template")}</Button></>}>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <Field label={t("ປະເພດແຈ້ງເຕືອນ", "Notice type")} required hint={template ? t("ປະເພດປ່ຽນບໍ່ໄດ້ຫຼັງສ້າງແລ້ວ", "The type cannot change after creation") : undefined}><Select value={f.key} disabled={!!template} onChange={(e) => set({ key: e.target.value as Key })} options={(Object.keys(KEYS) as Key[]).map((k) => ({ value: k, label: t(KEYS[k][0], KEYS[k][1]) }))} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("ຊື່ພາສາລາວ", "Name in Lao")} required error={tried && errs.nameLo || undefined}><Input value={f.nameLo} onChange={(e) => set({ nameLo: e.target.value })} /></Field>
          <Field label={t("ຊື່ພາສາອັງກິດ", "Name in English")} required error={tried && errs.nameEn || undefined}><Input value={f.nameEn} onChange={(e) => set({ nameEn: e.target.value })} /></Field>
        </div>
        <Field label={t("ຂໍ້ຄວາມພາສາລາວ", "Message in Lao")} required error={(tried || badPh(f.bodyLo)) && errs.bodyLo || undefined}><Textarea rows={5} value={f.bodyLo} onChange={(e) => set({ bodyLo: e.target.value })} /></Field>
        <Field label={t("ຂໍ້ຄວາມພາສາອັງກິດ", "Message in English")} required error={(tried || badPh(f.bodyEn)) && errs.bodyEn || undefined}><Textarea rows={5} value={f.bodyEn} onChange={(e) => set({ bodyEn: e.target.value })} /></Field>
        <div>
          <Checkbox label={t("ໃຊ້ແບບຟອມນີ້ສົ່ງແຈ້ງເຕືອນ", "Use this template for notices")} checked={f.active} disabled={mustStayActive} onChange={(v) => set({ active: v })} />
          {mustStayActive && <p className="mt-1 text-xs text-ink-2">{t("ນີ້ແມ່ນແບບຟອມດຽວທີ່ເປີດໃຊ້ຂອງປະເພດນີ້ ຈຶ່ງປິດບໍ່ໄດ້.", "This is the only active template of this type, so it must stay active.")}</p>}
          {replaces && <p className="mt-1 text-xs text-warn">{t(`ຈະປິດໃຊ້ "${replaces.nameLo}" ແທນ.`, `This replaces "${replaces.nameEn}", which becomes inactive.`)}</p>}
        </div>
      </div>
      <div className="space-y-3">
        <div><div className="box-label mb-1">{t("ຕົວແປທີ່ໃຊ້ໄດ້", "Available placeholders")}</div><PlaceholderList tkey={f.key} /></div>
        <Bubble label={t("ຕົວຢ່າງພາສາລາວ", "Lao preview")} text={fill(f.bodyLo, "lo")} />
        <Bubble label={t("ຕົວຢ່າງພາສາອັງກິດ", "English preview")} text={fill(f.bodyEn, "en")} />
        <p className="text-xs text-ink-2">{t("ຕົວຢ່າງນີ້ໃຊ້ຄ່າສົມມຸດ. ຕອນສົ່ງຈິງ ລະບົບໃສ່ຂໍ້ມູນຂອງ AWB ນັ້ນ.", "The preview uses sample values. Real notices use the data of that AWB.")}</p>
      </div>
    </div>
  </Dialog>;
}
