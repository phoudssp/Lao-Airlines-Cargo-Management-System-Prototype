import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, Globe, ScanLine } from "lucide-react";
import { setSession, useDb } from "@/lib/store";
import { useLang, useName, useT } from "@/lib/i18n";
import { cx } from "@/ui/kit";

const DEMO = ["U-01", "U-02", "U-03", "U-05", "U-04", "U-06"];
const HOME: Record<string, string> = { "U-01": "/", "U-02": "/export/awb", "U-03": "/wms/inbound", "U-05": "/import/arrivals", "U-04": "/finance/cashier", "U-06": "/master/stations" };
export default function Login() {
  const d = useDb(); const t = useT(); const name = useName(); const lang = useLang(); const nav = useNavigate();
  function enter(id: string) { const u = d.users.find((x) => x.id === id)!; setSession({ userId: id, station: u.station }); nav(HOME[id] ?? "/"); }
  return <div className="grid min-h-screen lg:grid-cols-[minmax(340px,5fr)_7fr]">
    <div className="flex flex-col justify-between bg-navy p-8 text-white lg:p-12">
      <img src="./logo.png" alt="Lao Airlines" width={239} height={100} className="w-[200px]" />
      <div className="my-10"><h1 className="text-3xl font-semibold leading-[1.4]">{t("ລະບົບຄຸ້ມຄອງການຂົນສົ່ງສິນຄ້າທາງອາກາດ", "Air Cargo Management System")}</h1><p className="mt-3 max-w-md text-navy-text">{t("ສິນຄ້າຂາອອກ, ຂາເຂົ້າ, ສາງ ແລະ ການເງິນ ໃນລະບົບດຽວ ສໍາລັບທຸກສາຂາ ແລະ ສະຖານີ.", "Export, import, warehouse and finance in one system, for every branch and station.")}</p></div>
      <p className="text-sm text-[#9db4ca]">{t("ຕົ້ນແບບເພື່ອການພິຈາລະນາ ໂດຍ Loopware. ຂໍ້ມູນທັງໝົດເປັນຂໍ້ມູນຈໍາລອງ ແລະ ບັນທຶກໄວ້ໃນ Browser ຂອງທ່ານເທົ່ານັ້ນ.", "Prototype for review by Loopware. All data is synthetic and stays in your browser.")}</p>
    </div>
    <div className="flex flex-col justify-center bg-surface p-6 lg:p-14">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">{t("ເລືອກບົດບາດເພື່ອເຂົ້າໃຊ້", "Choose a role to sign in")}</h2><div className="flex overflow-hidden rounded border border-line text-sm">{(["lo", "en"] as const).map((l) => <button key={l} onClick={() => setSession({ lang: l })} aria-pressed={lang === l} className={cx("px-3 py-1", lang === l ? "bg-brand text-white" : "text-ink-2 hover:bg-surface-2")}>{l === "lo" ? "ລາວ" : "EN"}</button>)}</div></div>
        <ul className="divide-y divide-line border-y border-line">{DEMO.map((id) => { const u = d.users.find((x) => x.id === id)!; const r = d.roles.find((x) => x.id === u.roleId); return <li key={id}><button onClick={() => enter(id)} className="group flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-surface-2"><span className="min-w-0 flex-1"><span className="block font-medium">{name(r)}</span><span className="block text-sm text-ink-2">{name(u)} · <span className="font-mono">{u.station}</span></span></span><ArrowRight size={17} aria-hidden className="text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" /></button></li>; })}</ul>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm"><Link to="/portal" className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"><Globe size={15} aria-hidden />{t("Portal ລູກຄ້າ ແລະ ຕົວແທນ", "Customer and agent portal")}</Link><button onClick={() => { setSession({ userId: "U-03", station: "VTE" }); nav("/scanner"); }} className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"><ScanLine size={15} aria-hidden />{t("ແອັບສະແກນ Android", "Android scanner app")}</button></div>
      </div>
    </div>
  </div>;
}
