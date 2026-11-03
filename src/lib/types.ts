// Domain types. Together with lib/mock/* these are the API contract for the future backend.
export type ID = string;
export type Lang = "lo" | "en";
export type Scope = "domestic" | "international";

export interface Station { code: string; nameLo: string; nameEn: string; countryEn: string; scope: Scope; branchLo: string; branchEn: string; phone: string; active: boolean; isHub?: boolean }

export type PermKey =
  | "master.manage" | "users.manage" | "rates.approve" | "tariff.approve"
  | "crm.manage" | "booking.manage" | "booking.approve"
  | "awb.issue" | "awb.void" | "screening.record" | "flight.dispatch" | "messages.manage"
  | "wms.operate" | "mail.manage" | "import.operate" | "customs.manage"
  | "cash.operate" | "cash.approve" | "invoice.manage" | "reports.view";
export interface Role { id: ID; nameLo: string; nameEn: string; perms: PermKey[] }
export interface User { id: ID; nameLo: string; nameEn: string; username: string; roleId: ID; station: string; active: boolean; lastLogin?: string }
export interface AuditEntry { id: ID; ts: string; userId: ID; station: string; action: string; entity: string; entityId: string; detail: string }

export interface Aircraft { code: string; nameEn: string; maxCargoKg: number; maxCargoM3: number }
export interface RouteDef { id: ID; origin: string; dest: string; scope: Scope; active: boolean }
export type FlightStatus = "open" | "closed" | "departed" | "arrived" | "cancelled";
export interface Flight { id: ID; no: string; date: string; std: string; sta: string; origin: string; dest: string; aircraft: string; status: FlightStatus; scope: Scope }

export type ApprovalStatus = "pending" | "approved" | "rejected";
export interface Currency { code: string; nameLo: string; nameEn: string; symbol: string; active: boolean }
export interface ExchangeRate { id: ID; currency: string; toLak: number; effectiveFrom: string; status: ApprovalStatus; requestedBy: ID; decidedBy?: ID; note?: string; createdAt: string }

export interface AwbStock { id: ID; prefix: string; from: number; to: number; assigneeType: "station" | "agent"; assignee: string; nextSerial: number; voided: number; createdAt: string; active: boolean }

export type TariffCategory = "general" | "special" | "service" | "storage" | "mail";
export type TariffBasis = "per_kg" | "flat" | "percent" | "per_kg_day";
export interface Tariff { id: ID; category: TariffCategory; code: string; nameLo: string; nameEn: string; scope: Scope; origin?: string; dest?: string; shc?: string; basis: TariffBasis; rate: number; minCharge: number; currency: string; freeDays?: number; effectiveFrom: string; effectiveTo?: string; status: ApprovalStatus; source: string; requestedBy: ID; decidedBy?: ID; note?: string }

export type CustomerType = "general" | "agent" | "corporate";
export interface Customer { id: ID; code: string; name: string; nameEn: string; type: CustomerType; contact: string; phone: string; whatsapp?: string; email?: string; address: string; station: string; creditLimit: number; creditDays: number; portalUser?: string; active: boolean; createdAt: string; note?: string }

export type BookingStatus = "requested" | "confirmed" | "waitlisted" | "rejected" | "cancelled" | "converted";
export interface Booking { id: ID; no: string; customerId: ID; flightId: ID; origin: string; dest: string; pieces: number; weightKg: number; volumeM3: number; commodity: string; shc: string[]; status: BookingStatus; reason?: string; decidedBy?: ID; decidedAt?: string; channel: "portal" | "counter"; awbId?: ID; createdAt: string }

export type StageCode = "BKD" | "RCS" | "SCR" | "MAN" | "DEP" | "ARR" | "RCF" | "NFD" | "CUS" | "DLV";
export type ExtraEvent = "OFLD" | "TFD" | "DIS" | "VOID" | "EDIT" | "RBK" | "PAY";
export interface AwbEvent { id: ID; code: StageCode | ExtraEvent; ts: string; station: string; userId: ID; note?: string; flightNo?: string; pieces?: number }
export interface PieceLine { id: ID; pieces: number; lengthCm: number; widthCm: number; heightCm: number; weightKg: number }
export interface ChargeLine { id: ID; tariffId?: ID; code: string; nameLo: string; nameEn: string; amount: number; currency: string; kind: "freight" | "service" | "storage" | "other" }
export interface House { id: ID; hawb: string; pieces: number; weightKg: number; commodity: string; shipper: string; consignee: string }
export type AwbDirection = "export" | "import" | "transit";
export type AwbStatus = "active" | "voided" | "closed";
export type Condition = "good" | "damage" | "wet" | "broken";
export type ScreeningResult = "pass" | "fail" | "pending";
export interface Screening { result: ScreeningResult; method: "X-Ray" | "Physical" | "ETD"; machine?: string; operator: ID; at: string; note?: string; fee: number }
export interface Awb {
  id: ID; prefix: string; serial: string; no: string; direction: AwbDirection; status: AwbStatus;
  bookingId?: ID; shipperId: ID; consigneeId: ID; agentId?: ID;
  origin: string; dest: string; flightId?: ID; station: string;
  commodity: string; shc: string[]; lines: PieceLine[]; pieces: number;
  grossKg: number; volumeKg: number; chargeableKg: number; roundedTo: number;
  charges: ChargeLine[]; total: number; currency: string; payMode: "cash" | "credit"; paid: boolean; receiptId?: ID; invoiceId?: ID;
  events: AwbEvent[]; stage: StageCode; screening?: Screening; houses: House[];
  zoneId?: ID; receivedPieces: number; loadedPieces: number; deliveredPieces: number; condition: Condition; conditionNote?: string;
  arrivedAt?: string; deliveredAt?: string; issuedBy: ID; issuedAt: string; voidReason?: string;
  customs?: CustomsRecord; delivery?: DeliveryRecord; staffNote?: string; offloadedPieces: number; offloadReason?: string; nextFlightId?: ID;
}
export interface CustomsRecord { declarationNo: string; status: "pending" | "submitted" | "cleared" | "hold"; method: "manual" | "api"; updatedAt: string; note?: string; updatedBy: ID }
export interface DeliveryRecord { receiverName: string; receiverPhone: string; idNo?: string; signedAt: string; pieces: number; storageDays: number; storageFee: number; currency: string; documentsChecked: boolean; by: ID }

export type LoadStatus = "planned" | "loaded" | "offloaded";
export interface FlightLoad { id: ID; flightId: ID; awbId: ID; pieces: number; weightKg: number; status: LoadStatus; reason?: string; scannedBy?: ID; scannedAt?: string }

export type ZoneType = "general" | "cold" | "valuable" | "dg" | "mail" | "transit";
export interface Zone { id: ID; station: string; code: string; nameLo: string; nameEn: string; type: ZoneType; capacityKg: number; active: boolean }

export type MailStatus = "received" | "manifested" | "dispatched" | "arrived" | "delivered";
export interface MailBag { id: ID; no: string; origin: string; dest: string; scope: Scope; flightId?: ID; bags: number; weightKg: number; category: "LC" | "CP" | "EMS"; direction: "outbound" | "inbound"; status: MailStatus; fee: number; currency: string; passNo?: string; paid: boolean; receivedBy?: ID; receivedAt: string; postOffice: string }

export type IrregularityType = "damage" | "wet" | "broken" | "short" | "over" | "lost" | "misrouted";
export interface Irregularity { id: ID; no: string; awbId: ID; type: IrregularityType; pieces: number; note: string; status: "open" | "investigating" | "closed"; station: string; reportedBy: ID; reportedAt: string; resolution?: string }

export type NotifyChannel = "whatsapp" | "staff_note";
export type NotifyStatus = "sent" | "delivered" | "read" | "failed" | "staff_note" | "done";
export interface MessageTemplate { id: ID; key: "arrival" | "aging" | "offload" | "booking"; nameLo: string; nameEn: string; bodyLo: string; bodyEn: string; active: boolean }
export interface NotificationLog { id: ID; ts: string; channel: NotifyChannel; templateKey: MessageTemplate["key"]; customerId: ID; awbId?: ID; to?: string; body: string; status: NotifyStatus; by: ID; agingBand?: string }

export type MessageType = "FWB" | "FHL" | "FFM";
export interface CargoMessage { id: ID; type: MessageType; ref: string; awbId?: ID; flightId?: ID; body: string; status: "draft" | "exported"; createdAt: string; by: ID }

export type PayMethod = "cash" | "transfer";
export type ReceiptStatus = "valid" | "voided" | "refunded";
export interface ReceiptLine { description: string; ref: string; amount: number; currency: string }
export interface Receipt { id: ID; no: string; ts: string; station: string; scope: Scope; cashierId: ID; customerId?: ID; payerName: string; awbIds: ID[]; mailIds: ID[]; lines: ReceiptLine[]; total: number; currency: string; rateToLak: number; lakEquivalent: number; method: PayMethod; transferRef?: string; shiftId?: ID; status: ReceiptStatus; editedBy?: ID; approvedBy?: ID; voidReason?: string; refundAmount?: number }
export type ShiftStatus = "open" | "closed" | "handed_over";
export interface CashShift { id: ID; station: string; cashierId: ID; date: string; openedAt: string; openingLak: number; openingUsd: number; status: ShiftStatus; countedLak?: number; countedUsd?: number; expectedLak?: number; expectedUsd?: number; closedAt?: string; handedTo?: ID; approvedBy?: ID; note?: string }
export type InvoiceStatus = "draft" | "issued" | "partial" | "paid" | "cancelled";
export interface Invoice { id: ID; no: string; customerId: ID; station: string; awbIds: ID[]; lines: ReceiptLine[]; amount: number; paidAmount: number; currency: string; issueDate: string; dueDate: string; status: InvoiceStatus; createdBy: ID }
export interface ExportLog { id: ID; ts: string; report: string; format: "Excel" | "PDF"; filters: string; rows: number; by: ID }

export interface Db {
  version: number; seededAt: string;
  stations: Station[]; roles: Role[]; users: User[]; audit: AuditEntry[];
  aircraft: Aircraft[]; routes: RouteDef[]; flights: Flight[];
  currencies: Currency[]; rates: ExchangeRate[]; awbStock: AwbStock[]; tariffs: Tariff[];
  customers: Customer[]; bookings: Booking[]; awbs: Awb[]; loads: FlightLoad[];
  zones: Zone[]; mail: MailBag[]; irregularities: Irregularity[];
  templates: MessageTemplate[]; notifications: NotificationLog[]; messages: CargoMessage[];
  receipts: Receipt[]; shifts: CashShift[]; invoices: Invoice[]; exportLogs: ExportLog[];
  session: { userId: ID | null; station: string; lang: Lang };
  counters: Record<string, number>;
}
