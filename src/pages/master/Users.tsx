import { Fragment, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { currentUser, useCan, useDb } from "@/lib/store";
import { useLang, useName, useT } from "@/lib/i18n";
import { Badge, Button, Callout, Checkbox, Col, Confirm, DataTable, Dialog, Field, IconButton, Input, PageHeader, Panel, Select, Tabs, toast } from "@/ui/kit";
import type { Db, PermKey, Role, User } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { newId, removeFrom, upsert } from "@/lib/mock/master";

const PERM_LABEL: Record<PermKey, [string, string]> = {
  "master.manage": ["ຈັດການຂໍ້ມູນພື້ນຖານ", "Manage master data"],
  "users.manage": ["ຈັດການຜູ້ໃຊ້ ແລະ ສິດທິ", "Manage users and roles"],
  "rates.approve": ["ອະນຸມັດອັດຕາແລກປ່ຽນ", "Approve exchange rates"],
  "tariff.approve": ["ອະນຸມັດອັດຕາຄ່າບໍລິການ", "Approve tariffs"],
  "crm.manage": ["ຈັດການລູກຄ້າ ແລະ ຕົວແທນ", "Manage customers and agents"],
  "booking.manage": ["ສ້າງ ແລະ ແກ້ໄຂການຈອງ", "Create and edit bookings"],
  "booking.approve": ["ອະນຸມັດການຈອງພື້ນທີ່", "Approve space bookings"],
  "awb.issue": ["ອອກ ແລະ ແກ້ໄຂ AWB", "Issue and correct AWBs"],
  "awb.void": ["ຍົກເລີກ AWB", "Void AWBs"],
  "screening.record": ["ບັນທຶກຜົນ X-Ray", "Record X-Ray results"],
  "flight.dispatch": ["ຈັດຖ້ຽວບິນ ແລະ Manifest", "Dispatch flights and manifests"],
  "messages.manage": ["ຈັດການຂໍ້ຄວາມ FFM/FWB/FHL", "Manage FFM/FWB/FHL messages"],
  "wms.operate": ["ຮັບເຄື່ອງ ແລະ ຈັດການສາງ", "Operate the warehouse"],
  "mail.manage": ["ຈັດການຖົງເມ", "Manage mail bags"],
  "import.operate": ["ຈັດການສິນຄ້າຂາເຂົ້າ ແລະ ການມອບ", "Handle imports and delivery"],
  "customs.manage": ["ບັນທຶກສະຖານະພາສີ", "Record customs status"],
  "cash.operate": ["ຮັບເງິນ ແລະ ອອກໃບຮັບເງິນ POS", "Take payments at the POS"],
  "cash.approve": ["ອະນຸມັດການແກ້ໄຂໃບຮັບເງິນ ແລະ ການປິດຍອດ", "Approve receipt changes and day close"],
  "invoice.manage": ["ຈັດການໃບເກັບເງິນ", "Manage invoices"],
  "reports.view": ["ເບິ່ງລາຍງານ ແລະ Dashboard", "View reports and Dashboard"],
};
const PERM_GROUPS: { lo: string; en: string; perms: PermKey[] }[] = [
  { lo: "ຂໍ້ມູນພື້ນຖານ ແລະ ຕັ້ງຄ່າ", en: "Master data and settings", perms: ["master.manage", "users.manage", "rates.approve", "tariff.approve"] },
  { lo: "ລູກຄ້າ ແລະ ການຈອງ", en: "Customers and booking", perms: ["crm.manage", "booking.manage", "booking.approve"] },
  { lo: "ສິນຄ້າຂາອອກ", en: "Export", perms: ["awb.issue", "awb.void", "screening.record", "flight.dispatch", "messages.manage"] },
  { lo: "ສາງສິນຄ້າ", en: "Warehouse", perms: ["wms.operate", "mail.manage"] },
  { lo: "ສິນຄ້າຂາເຂົ້າ", en: "Import", perms: ["import.operate", "customs.manage"] },
  { lo: "ການເງິນ", en: "Finance", perms: ["cash.operate", "cash.approve", "invoice.manage"] },
  { lo: "ລາຍງານ", en: "Reports", perms: ["reports.view"] },
];
const ALL_PERMS = PERM_GROUPS.flatMap((g) => g.perms);

/** Someone active must always be able to manage users, or nobody could repair access. */
const keepsManager = (users: User[], roles: Role[]) => users.some((u) => u.active && roles.find((r) => r.id === u.roleId)?.perms.includes("users.manage"));

export default function Users() {
  const d = useDb(); const t = useT(); const can = useCan();
  const [tab, setTab] = useState<"users" | "roles">("users");
  const manage = can("users.manage");
  return <>
    <PageHeader title={t("ຜູ້ໃຊ້ ແລະ ສິດທິ", "Users and roles")} subtitle={t("ບັນຊີຜູ້ໃຊ້ ສະຖານີປະຈໍາ ແລະ ສິດທີ່ແຕ່ລະບົດບາດເຮັດໄດ້.", "User accounts, home stations and what each role is allowed to do.")} />
    {!manage && <div className="mb-3"><Callout tone="info">{t("ທ່ານເບິ່ງໄດ້ຢ່າງດຽວ. ການແກ້ໄຂຕ້ອງມີສິດຈັດການຜູ້ໃຊ້ ແລະ ສິດທິ.", "You can view this page. Changes need the Manage users and roles permission.")}</Callout></div>}
    <Tabs value={tab} onChange={setTab} tabs={[{ key: "users", label: t("ຜູ້ໃຊ້", "Users"), count: d.users.length }, { key: "roles", label: t("ບົດບາດ", "Roles"), count: d.roles.length }]} />
    {tab === "users" ? <UsersTab manage={manage} /> : <RolesTab manage={manage} />}
  </>;
}

function userRefs(d: Db, id: string) {
  return d.awbs.filter((a) => a.issuedBy === id).length + d.audit.filter((a) => a.userId === id).length + d.receipts.filter((r) => r.cashierId === id).length + d.shifts.filter((s) => s.cashierId === id).length + d.notifications.filter((n) => n.by === id).length + d.tariffs.filter((x) => x.requestedBy === id || x.decidedBy === id).length + d.rates.filter((x) => x.requestedBy === id || x.decidedBy === id).length + d.loads.filter((l) => l.scannedBy === id).length + d.mail.filter((m) => m.receivedBy === id).length + d.irregularities.filter((i) => i.reportedBy === id).length + d.bookings.filter((b) => b.decidedBy === id).length;
}

function UsersTab({ manage }: { manage: boolean }) {
  const d = useDb(); const t = useT(); const name = useName(); const lang = useLang();
  const [role, setRole] = useState(""); const [station, setStation] = useState("");
  const [edit, setEdit] = useState<User | "new" | null>(null); const [del, setDel] = useState<User | null>(null);
  const self = currentUser(d)?.id;
  const rows = d.users.filter((u) => (!role || u.roleId === role) && (!station || u.station === station));
  const nameOf = (u: User) => (lang === "lo" ? u.nameLo : u.nameEn);
  const toggle = (u: User, active: boolean) => {
    if (!active && u.id === self) { toast(t("ທ່ານປິດບັນຊີຂອງຕົນເອງບໍ່ໄດ້. ໃຫ້ຜູ້ດູແລລະບົບຄົນອື່ນດໍາເນີນການ", "You cannot deactivate your own account. Ask another administrator."), "warn"); return; }
    const next = d.users.map((x) => (x.id === u.id ? { ...x, active } : x));
    if (!keepsManager(next, d.roles)) { toast(t("ຕ້ອງມີຜູ້ໃຊ້ຢ່າງໜ້ອຍ 1 ຄົນທີ່ຈັດການສິດທິໄດ້", "At least one active user must be able to manage users."), "bad"); return; }
    upsert("users", { ...u, active }, false); toast(active ? t(`ເປີດໃຊ້ ${u.username} ແລ້ວ`, `${u.username} is active`) : t(`ປິດໃຊ້ ${u.username} ແລ້ວ`, `${u.username} is inactive`));
  };
  const cols: Col<User>[] = [
    { key: "username", header: t("ຊື່ຜູ້ໃຊ້", "Username"), mono: true, render: (u) => <>{u.username}{u.id === self && <span className="ml-1.5 font-sans"><Badge tone="info" noIcon>{t("ທ່ານ", "You")}</Badge></span>}</>, sort: (u) => u.username },
    { key: "nameLo", header: t("ຊື່ພາສາລາວ", "Name in Lao"), render: (u) => u.nameLo, sort: (u) => u.nameLo },
    { key: "nameEn", header: t("ຊື່ພາສາອັງກິດ", "Name in English"), render: (u) => u.nameEn, sort: (u) => u.nameEn },
    { key: "role", header: t("ບົດບາດ", "Role"), render: (u) => name(d.roles.find((r) => r.id === u.roleId)), sort: (u) => u.roleId },
    { key: "station", header: t("ສະຖານີ", "Station"), mono: true, render: (u) => u.station, sort: (u) => u.station },
    { key: "login", header: t("ເຂົ້າລະບົບຫຼ້າສຸດ", "Last login"), render: (u) => u.lastLogin ? <span className="tnum whitespace-nowrap">{fmtDateTime(u.lastLogin)}</span> : <span className="text-ink-2">{t("ຍັງບໍ່ເຄີຍເຂົ້າ", "Never")}</span>, sort: (u) => u.lastLogin ?? "" },
    { key: "active", header: t("ສະຖານະ", "Status"), render: (u) => <Checkbox label={u.active ? t("ເປີດໃຊ້", "Active") : t("ປິດໃຊ້", "Inactive")} checked={u.active} disabled={!manage} onChange={(v) => toggle(u, v)} /> },
    ...(manage ? [{ key: "act", header: "", align: "right" as const, render: (u: User) => <span className="inline-flex"><IconButton icon={Pencil} label={t(`ແກ້ໄຂ ${u.username}`, `Edit ${u.username}`)} onClick={() => setEdit(u)} /><IconButton icon={Trash2} label={t(`ລຶບ ${u.username}`, `Delete ${u.username}`)} onClick={() => setDel(u)} /></span> }] : []),
  ];
  const isSelf = del?.id === self; const refs = del ? userRefs(d, del.id) : 0; const blocked = !!del && (isSelf || refs > 0);
  return <>
    <Panel flush>
      <DataTable rows={rows} columns={cols} rowKey={(u) => u.id} minWidth={1040} pageSize={15} defaultSort={{ key: "username", dir: "asc" }} search={(u) => `${u.username} ${u.nameLo} ${u.nameEn}`}
        filters={<>
          <Select aria-label={t("ບົດບາດ", "Role")} className="w-auto" value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("ທຸກບົດບາດ", "All roles")} options={d.roles.map((r) => ({ value: r.id, label: name(r) }))} />
          <Select aria-label={t("ສະຖານີ", "Station")} className="w-auto" value={station} onChange={(e) => setStation(e.target.value)} placeholder={t("ທຸກສະຖານີ", "All stations")} options={d.stations.map((s) => ({ value: s.code, label: s.code }))} />
        </>}
        toolbar={manage && <Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>{t("ເພີ່ມຜູ້ໃຊ້", "Add user")}</Button>} />
    </Panel>
    {edit && <UserForm user={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
    <Dialog open={blocked} onClose={() => setDel(null)} size="sm" title={t(`ລຶບ ${del?.username ?? ""} ບໍ່ໄດ້`, `${del?.username ?? ""} cannot be deleted`)} footer={<>
      <Button onClick={() => setDel(null)}>{t("ປິດ", "Close")}</Button>
      {del && !isSelf && del.active && <Button variant="primary" onClick={() => { toggle(del, false); setDel(null); }}>{t("ປິດໃຊ້ແທນ", "Deactivate instead")}</Button>}
    </>}>
      <p className="text-sm">{isSelf ? t("ນີ້ແມ່ນບັນຊີທີ່ທ່ານກໍາລັງໃຊ້ຢູ່. ໃຫ້ຜູ້ດູແລລະບົບຄົນອື່ນດໍາເນີນການ.", "This is the account you are signed in with. Ask another administrator.") : t(`${del ? nameOf(del) : ""} ມີປະຫວັດການເຮັດວຽກ ${refs} ລາຍການ. ເພື່ອຮັກສາປະຫວັດການເຄື່ອນໄຫວ ໃຫ້ປິດໃຊ້ບັນຊີແທນການລຶບ.`, `${del ? nameOf(del) : ""} has ${refs} recorded actions. To keep the audit trail complete, deactivate the account instead of deleting it.`)}</p>
    </Dialog>
    <Confirm open={!!del && !blocked} onClose={() => setDel(null)} danger title={t(`ລຶບຜູ້ໃຊ້ ${del?.username ?? ""}?`, `Delete user ${del?.username ?? ""}?`)} body={t("ບັນຊີນີ້ຍັງບໍ່ມີປະຫວັດການເຮັດວຽກ. ການລຶບຈະຖືກບັນທຶກໃນປະຫວັດການເຄື່ອນໄຫວ.", "This account has no recorded actions. The deletion is written to the audit trail.")} confirmLabel={t("ລຶບຜູ້ໃຊ້", "Delete user")} onConfirm={() => { if (!del) return; if (!keepsManager(d.users.filter((x) => x.id !== del.id), d.roles)) { toast(t("ຕ້ອງມີຜູ້ໃຊ້ຢ່າງໜ້ອຍ 1 ຄົນທີ່ຈັດການສິດທິໄດ້", "At least one active user must be able to manage users."), "bad"); return; } removeFrom("users", del.id); toast(t(`ລຶບ ${del.username} ແລ້ວ`, `${del.username} deleted`)); }} />
  </>;
}

function UserForm({ user, onClose }: { user?: User; onClose: () => void }) {
  const d = useDb(); const t = useT(); const name = useName();
  const [f, setF] = useState<User>(user ?? { id: "", nameLo: "", nameEn: "", username: "", roleId: "", station: d.session.station, active: true });
  const [tried, setTried] = useState(false);
  const set = (p: Partial<User>) => setF((x) => ({ ...x, ...p }));
  const isSelf = user?.id === d.session.userId;
  const req = t("ກະລຸນາປ້ອນຂໍ້ມູນນີ້", "Enter this field");
  const uname = f.username.trim().toLowerCase();
  const errs = {
    username: !/^[a-z0-9._]{3,}$/.test(uname) ? t("ໃຊ້ຕົວພິມນ້ອຍອັງກິດ ຕົວເລກ ຈຸດ ຫຼື ຂີດລຸ່ມ ຢ່າງໜ້ອຍ 3 ຕົວ", "Use at least 3 lowercase letters, digits, dots or underscores") : d.users.some((u) => u.id !== f.id && u.username.toLowerCase() === uname) ? t(`ມີຊື່ຜູ້ໃຊ້ ${uname} ແລ້ວ. ກະລຸນາໃຊ້ຊື່ອື່ນ`, `${uname} is taken. Choose another username`) : "",
    nameLo: f.nameLo.trim() ? "" : req, nameEn: f.nameEn.trim() ? "" : req,
    roleId: f.roleId ? "" : t("ກະລຸນາເລືອກບົດບາດ", "Choose a role"), station: f.station ? "" : t("ກະລຸນາເລືອກສະຖານີ", "Choose a station"),
  };
  const e = (k: keyof typeof errs) => (tried ? errs[k] : "") || undefined;
  const [lockErr, setLockErr] = useState("");
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return;
    const item: User = { ...f, username: uname, nameLo: f.nameLo.trim(), nameEn: f.nameEn.trim(), id: f.id || newId("U") };
    const next = user ? d.users.map((u) => (u.id === item.id ? item : u)) : [...d.users, item];
    if (!keepsManager(next, d.roles)) { setLockErr(t("ການປ່ຽນນີ້ຈະເຮັດໃຫ້ບໍ່ມີໃຜຈັດການສິດທິໄດ້. ກະລຸນາມອບສິດໃຫ້ຜູ້ໃຊ້ຄົນອື່ນກ່ອນ", "This change would leave nobody able to manage users. Give another active user that permission first.")); return; }
    upsert("users", item, !user); toast(user ? t(`ບັນທຶກ ${uname} ແລ້ວ`, `${uname} saved`) : t(`ເພີ່ມຜູ້ໃຊ້ ${uname} ແລ້ວ`, `User ${uname} added`)); onClose();
  };
  return <Dialog open onClose={onClose} title={user ? t(`ແກ້ໄຂຜູ້ໃຊ້ ${user.username}`, `Edit user ${user.username}`) : t("ເພີ່ມຜູ້ໃຊ້", "Add user")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{user ? t("ບັນທຶກການແກ້ໄຂ", "Save changes") : t("ເພີ່ມຜູ້ໃຊ້", "Add user")}</Button></>}>
    {lockErr && <div className="mb-3"><Callout tone="bad">{lockErr}</Callout></div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("ຊື່ຜູ້ໃຊ້", "Username")} required error={e("username")}><Input className="font-mono" value={f.username} autoCapitalize="none" onChange={(x) => set({ username: x.target.value })} /></Field>
      <Field label={t("ບົດບາດ", "Role")} required error={e("roleId")}><Select value={f.roleId} onChange={(x) => set({ roleId: x.target.value })} placeholder={t("ເລືອກບົດບາດ", "Choose a role")} options={d.roles.map((r) => ({ value: r.id, label: name(r) }))} /></Field>
      <Field label={t("ຊື່ພາສາລາວ", "Name in Lao")} required error={e("nameLo")}><Input value={f.nameLo} onChange={(x) => set({ nameLo: x.target.value })} /></Field>
      <Field label={t("ຊື່ພາສາອັງກິດ", "Name in English")} required error={e("nameEn")}><Input value={f.nameEn} onChange={(x) => set({ nameEn: x.target.value })} /></Field>
      <Field label={t("ສະຖານີ", "Station")} required error={e("station")}><Select value={f.station} onChange={(x) => set({ station: x.target.value })} options={d.stations.filter((s) => s.active || s.code === f.station).map((s) => ({ value: s.code, label: `${s.code} · ${name(s)}` }))} /></Field>
      <div className="self-end pb-2"><Checkbox label={t("ບັນຊີນີ້ເປີດໃຊ້ຢູ່", "This account is active")} checked={f.active} disabled={isSelf} onChange={(v) => set({ active: v })} /></div>
    </div>
  </Dialog>;
}

function RolesTab({ manage }: { manage: boolean }) {
  const d = useDb(); const t = useT(); const name = useName();
  const [edit, setEdit] = useState<Role | "new" | null>(null); const [del, setDel] = useState<Role | null>(null);
  const holders = (id: string) => d.users.filter((u) => u.roleId === id);
  const flip = (r: Role, p: PermKey, on: boolean) => {
    const item = { ...r, perms: on ? [...r.perms, p] : r.perms.filter((x) => x !== p) };
    if (!keepsManager(d.users, d.roles.map((x) => (x.id === r.id ? item : x)))) { toast(t("ຕ້ອງມີຜູ້ໃຊ້ຢ່າງໜ້ອຍ 1 ຄົນທີ່ຈັດການສິດທິໄດ້. ກະລຸນາມອບສິດໃຫ້ບົດບາດອື່ນກ່ອນ", "At least one active user must be able to manage users. Give that permission to another role first."), "bad"); return; }
    upsert("roles", item, false);
  };
  const held = del ? holders(del.id) : [];
  return <>
    <Panel flush title={t("ຕາຕະລາງສິດທິ", "Permission matrix")} actions={manage && <Button variant="primary" icon={Plus} onClick={() => setEdit("new")}>{t("ເພີ່ມບົດບາດ", "Add role")}</Button>}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: 300 + d.roles.length * 132 }}>
          <thead>
            <tr className="border-b border-line-strong bg-surface-2 text-left align-bottom">
              <th scope="col" className="sticky left-0 z-10 min-w-[280px] bg-surface-2 px-3 py-2 text-xs font-semibold text-ink-2">{t("ສິດທິ", "Permission")}</th>
              {d.roles.map((r) => <th key={r.id} scope="col" className="w-[132px] min-w-[132px] px-2 py-2 text-center text-xs font-semibold">
                <div className="leading-4">{name(r)}</div>
                <div className="tnum font-normal text-ink-2">{t(`${holders(r.id).length} ຄົນ · ${r.perms.length} ສິດ`, `${holders(r.id).length} users · ${r.perms.length} perms`)}</div>
                {manage && <div className="mt-0.5 flex justify-center"><IconButton icon={Pencil} label={t(`ແກ້ໄຂ ${name(r)}`, `Edit ${name(r)}`)} onClick={() => setEdit(r)} /><IconButton icon={Trash2} label={t(`ລຶບ ${name(r)}`, `Delete ${name(r)}`)} onClick={() => setDel(r)} /></div>}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {PERM_GROUPS.map((g) => <Fragment key={g.en}>
              <tr className="border-b border-line bg-surface-2/60"><th scope="colgroup" colSpan={d.roles.length + 1} className="sticky left-0 px-3 py-1.5 text-left text-xs font-semibold text-ink-2">{t(g.lo, g.en)}</th></tr>
              {g.perms.map((p) => <tr key={p} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                <th scope="row" className="sticky left-0 bg-surface px-3 py-1.5 text-left font-normal">{t(PERM_LABEL[p][0], PERM_LABEL[p][1])}</th>
                {d.roles.map((r) => <td key={r.id} className="px-2 py-1.5 text-center"><input type="checkbox" className="h-4 w-4 accent-[var(--brand)] align-middle" aria-label={`${name(r)}: ${t(PERM_LABEL[p][0], PERM_LABEL[p][1])}`} checked={r.perms.includes(p)} disabled={!manage} onChange={(e) => flip(r, p, e.target.checked)} /></td>)}
              </tr>)}
            </Fragment>)}
          </tbody>
        </table>
      </div>
    </Panel>
    {edit && <RoleForm role={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
    <Dialog open={!!del && held.length > 0} onClose={() => setDel(null)} size="sm" title={t("ລຶບບົດບາດນີ້ບໍ່ໄດ້", "This role cannot be deleted")} footer={<Button onClick={() => setDel(null)}>{t("ປິດ", "Close")}</Button>}>
      <p className="mb-2 text-sm">{t(`ຜູ້ໃຊ້ ${held.length} ຄົນຍັງໃຊ້ບົດບາດ ${name(del ?? undefined)}. ກະລຸນາຍ້າຍເຂົາເຈົ້າໄປບົດບາດອື່ນກ່ອນ ໃນແຖບຜູ້ໃຊ້.`, `${held.length} users still hold the role ${name(del ?? undefined)}. Move them to another role on the Users tab first.`)}</p>
      <ul className="list-disc space-y-0.5 pl-5 text-sm">{held.map((u) => <li key={u.id}>{t(u.nameLo, u.nameEn)} <span className="font-mono text-[13px] text-ink-2">{u.username}</span></li>)}</ul>
    </Dialog>
    <Confirm open={!!del && held.length === 0} onClose={() => setDel(null)} danger title={t(`ລຶບບົດບາດ ${name(del ?? undefined)}?`, `Delete role ${name(del ?? undefined)}?`)} body={t("ບໍ່ມີຜູ້ໃຊ້ໃດໃຊ້ບົດບາດນີ້. ການລຶບຈະຖືກບັນທຶກໃນປະຫວັດການເຄື່ອນໄຫວ.", "No user holds this role. The deletion is written to the audit trail.")} confirmLabel={t("ລຶບບົດບາດ", "Delete role")} onConfirm={() => { if (del) { removeFrom("roles", del.id); toast(t("ລຶບບົດບາດແລ້ວ", "Role deleted")); } }} />
  </>;
}

function RoleForm({ role, onClose }: { role?: Role; onClose: () => void }) {
  const d = useDb(); const t = useT();
  const [f, setF] = useState<Role>(role ?? { id: "", nameLo: "", nameEn: "", perms: [] });
  const [tried, setTried] = useState(false); const [lockErr, setLockErr] = useState("");
  const req = t("ກະລຸນາປ້ອນຂໍ້ມູນນີ້", "Enter this field");
  const dup = (v: string, k: "nameLo" | "nameEn") => d.roles.some((r) => r.id !== f.id && r[k].trim().toLowerCase() === v.trim().toLowerCase());
  const errs = {
    nameLo: !f.nameLo.trim() ? req : dup(f.nameLo, "nameLo") ? t("ມີຊື່ບົດບາດນີ້ແລ້ວ", "A role already has this name") : "",
    nameEn: !f.nameEn.trim() ? req : dup(f.nameEn, "nameEn") ? t("ມີຊື່ບົດບາດນີ້ແລ້ວ", "A role already has this name") : "",
  };
  const has = (p: PermKey) => f.perms.includes(p);
  const setPerm = (p: PermKey, on: boolean) => setF((x) => ({ ...x, perms: on ? [...x.perms.filter((y) => y !== p), p] : x.perms.filter((y) => y !== p) }));
  const setGroup = (ps: PermKey[], on: boolean) => setF((x) => ({ ...x, perms: on ? [...new Set([...x.perms, ...ps])] : x.perms.filter((y) => !ps.includes(y)) }));
  const save = () => {
    setTried(true); if (Object.values(errs).some(Boolean)) return;
    const item: Role = { ...f, nameLo: f.nameLo.trim(), nameEn: f.nameEn.trim(), id: f.id || newId("R"), perms: ALL_PERMS.filter((p) => f.perms.includes(p)) };
    if (role && !keepsManager(d.users, d.roles.map((r) => (r.id === item.id ? item : r)))) { setLockErr(t("ການປ່ຽນນີ້ຈະເຮັດໃຫ້ບໍ່ມີໃຜຈັດການສິດທິໄດ້. ກະລຸນາມອບສິດໃຫ້ບົດບາດອື່ນກ່ອນ", "This change would leave nobody able to manage users. Give that permission to another role first.")); return; }
    upsert("roles", item, !role); toast(role ? t("ບັນທຶກບົດບາດແລ້ວ", "Role saved") : t("ເພີ່ມບົດບາດແລ້ວ", "Role added")); onClose();
  };
  return <Dialog open onClose={onClose} size="lg" title={role ? t("ແກ້ໄຂບົດບາດ", "Edit role") : t("ເພີ່ມບົດບາດ", "Add role")} footer={<><Button onClick={onClose}>{t("ຍົກເລີກ", "Cancel")}</Button><Button variant="primary" onClick={save}>{role ? t("ບັນທຶກການແກ້ໄຂ", "Save changes") : t("ເພີ່ມບົດບາດ", "Add role")}</Button></>}>
    {lockErr && <div className="mb-3"><Callout tone="bad">{lockErr}</Callout></div>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      <Field label={t("ຊື່ພາສາລາວ", "Name in Lao")} required error={tried && errs.nameLo || undefined}><Input value={f.nameLo} onChange={(x) => setF({ ...f, nameLo: x.target.value })} /></Field>
      <Field label={t("ຊື່ພາສາອັງກິດ", "Name in English")} required error={tried && errs.nameEn || undefined}><Input value={f.nameEn} onChange={(x) => setF({ ...f, nameEn: x.target.value })} /></Field>
    </div>
    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {PERM_GROUPS.map((g) => { const all = g.perms.every(has); return <fieldset key={g.en}>
        <legend className="mb-1 flex w-full items-center justify-between gap-2 border-b border-line pb-1 text-sm font-semibold">{t(g.lo, g.en)}<button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => setGroup(g.perms, !all)}>{all ? t("ເອົາອອກທັງໝົດ", "Clear all") : t("ເລືອກທັງໝົດ", "Select all")}</button></legend>
        <div className="flex flex-col gap-1.5">{g.perms.map((p) => <Checkbox key={p} label={t(PERM_LABEL[p][0], PERM_LABEL[p][1])} checked={has(p)} onChange={(v) => setPerm(p, v)} />)}</div>
      </fieldset>; })}
    </div>
  </Dialog>;
}
