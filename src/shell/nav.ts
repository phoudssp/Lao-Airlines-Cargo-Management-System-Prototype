import { Settings, BarChart3, Boxes, Building2, CalendarClock, ClipboardList, Coins, FileText, Gauge, Globe, History, Landmark, Mail, MessageSquare, Package, PackageCheck, PackageOpen, Plane, PlaneLanding, PlaneTakeoff, Receipt, ScanLine, ScrollText, Send, Shield, ShieldCheck, Smartphone, Tag, TriangleAlert, Truck, Users, Upload, UserCog, Wallet, Warehouse, type LucideIcon } from "lucide-react";
import type { PermKey } from "@/lib/types";

export interface NavItem { to: string; lo: string; en: string; icon: LucideIcon; perm?: PermKey; badge?: "bookings" | "screening" | "approvals" | "aging" | "cashier" | "irregular" | "notes" }
export interface NavGroup { id: string; lo: string; en: string; icon: LucideIcon; items: NavItem[] }
/** Always-visible links above the work groups. */
export const TOP: NavItem[] = [
  { to: "/", lo: "Dashboard ຜູ້ບໍລິຫານ", en: "Executive dashboard", icon: Gauge },
  { to: "/reports", lo: "ລາຍງານ ແລະ ສະຖິຕິ", en: "Reports & analytics", icon: BarChart3, perm: "reports.view" },
];
/** Other ways into the system, kept apart at the foot of the sidebar. */
export const CHANNELS: NavItem[] = [
  { to: "/scanner", lo: "ແອັບສະແກນ Android", en: "Android scanner app", icon: ScanLine },
  { to: "/portal", lo: "Portal ລູກຄ້າ", en: "Customer portal", icon: Globe },
];
export const NAV: NavGroup[] = [
  { id: "m2", lo: "ລູກຄ້າ ແລະ ການຈອງ", en: "Customers", icon: Users, items: [
    { to: "/crm", lo: "ລູກຄ້າ ແລະ ຕົວແທນ", en: "Customers & agents", icon: Users },
    { to: "/bookings", lo: "ການຈອງພື້ນທີ່", en: "Space bookings", icon: CalendarClock, badge: "bookings" },
  ] },
  { id: "m3", lo: "ສິນຄ້າຂາອອກ", en: "Export", icon: PlaneTakeoff, items: [
    { to: "/export/awb", lo: "ໃບຂົນສົ່ງ AWB", en: "Air waybills", icon: FileText },
    { to: "/export/screening", lo: "ກວດຄວາມປອດໄພ X-Ray", en: "Security & X-Ray", icon: ShieldCheck, badge: "screening" },
    { to: "/export/dispatch", lo: "ຖ້ຽວບິນ ແລະ Manifest", en: "Flights & manifest", icon: PlaneTakeoff },
    { to: "/export/messages", lo: "ຂໍ້ຄວາມ FFM/FWB/FHL", en: "FFM/FWB/FHL messages", icon: Send },
  ] },
  { id: "m4", lo: "ສາງສິນຄ້າ", en: "Warehouse", icon: Warehouse, items: [
    { to: "/wms/inbound", lo: "ຮັບເຄື່ອງເຂົ້າສາງ", en: "Goods receipt", icon: PackageCheck },
    { to: "/wms/storage", lo: "ໂຊນ ແລະ ຕໍາແໜ່ງ", en: "Zones & storage", icon: Warehouse },
    { to: "/wms/transfer", lo: "ຖ່າຍລໍາ / Interline", en: "Transshipment / Interline", icon: Truck },
    { to: "/wms/mail", lo: "ຖົງເມ", en: "Mail bags", icon: Mail },
    { to: "/wms/irregularities", lo: "ເສຍຫາຍ ແລະ ຜິດປົກກະຕິ", en: "Damage & irregularities", icon: TriangleAlert, badge: "irregular" },
  ] },
  { id: "m5", lo: "ສິນຄ້າຂາເຂົ້າ", en: "Import", icon: PlaneLanding, items: [
    { to: "/import/arrivals", lo: "ສິນຄ້າມາຮອດ ແລະ ແຈ້ງເຕືອນ", en: "Arrivals & notices", icon: PlaneLanding, badge: "notes" },
    { to: "/import/aging", lo: "ສິນຄ້າຄ້າງສາງ", en: "Aging cargo", icon: History, badge: "aging" },
    { to: "/import/customs", lo: "ພາສີ", en: "Customs", icon: Landmark },
    { to: "/import/delivery", lo: "ມອບສິນຄ້າ", en: "Delivery & pickup", icon: PackageOpen },
  ] },
  { id: "m6", lo: "ການເງິນ ແລະ ການບັນຊີ", en: "Finance & cashier", icon: Wallet, items: [
    { to: "/finance/cashier", lo: "ແຄັດເຊຍ POS", en: "Cashier POS", icon: Wallet, badge: "cashier" },
    { to: "/finance/receipts", lo: "ໃບຮັບເງິນ", en: "Receipts", icon: Receipt },
    { to: "/finance/cash", lo: "ຄັງເງິນ ແລະ ປິດຍອດ", en: "Cash & day close", icon: Coins },
    { to: "/finance/invoices", lo: "ໃບເກັບເງິນ ລູກຄ້າຕິດໜີ້", en: "Credit invoices", icon: ScrollText },
  ] },
  { id: "m1", lo: "ຂໍ້ມູນພື້ນຖານ", en: "Master data", icon: Settings, items: [
    { to: "/master/stations", lo: "ສາຂາ ແລະ ສະຖານີ", en: "Stations & branches", icon: Building2 },
    { to: "/master/flights", lo: "ຖ້ຽວບິນ ແລະ ເສັ້ນທາງ", en: "Flights & routes", icon: Plane },
    { to: "/master/currency", lo: "ອັດຕາແລກປ່ຽນ", en: "Exchange rates", icon: Coins, badge: "approvals" },
    { to: "/master/awb-stock", lo: "ຊ່ວງເລກ AWB", en: "AWB ranges", icon: ClipboardList },
    { to: "/master/tariffs", lo: "ອັດຕາຄ່າບໍລິການ", en: "Tariffs & pricing", icon: Tag },
    { to: "/master/users", lo: "ຜູ້ໃຊ້ ແລະ ສິດທິ", en: "Users & roles", icon: UserCog, perm: "users.manage" },
    { to: "/master/templates", lo: "ແບບຟອມແຈ້ງເຕືອນ", en: "Notice templates", icon: MessageSquare },
    { to: "/master/import", lo: "ນໍາເຂົ້າຂໍ້ມູນ", en: "Data import", icon: Upload },
    { to: "/master/audit", lo: "ປະຫວັດການເຄື່ອນໄຫວ", en: "Audit trail", icon: Shield },
  ] },
];
export { Boxes, Package, Smartphone };
