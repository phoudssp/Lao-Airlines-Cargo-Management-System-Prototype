import type { Awb, AwbEvent, ChargeLine, Customer, Db, Flight, FlightLoad, MailBag, PermKey, Receipt, Scope, StageCode, Tariff, User } from "./types";
import { dateAdd, isoDate } from "./format";
import { awbNo, STAGES, withCheckDigit } from "./pricing";

export const DB_VERSION = 4;

// Deterministic generator so every viewer sees the same demonstration data.
function rng(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

const ALL: PermKey[] = ["master.manage","users.manage","rates.approve","tariff.approve","crm.manage","booking.manage","booking.approve","awb.issue","awb.void","screening.record","flight.dispatch","messages.manage","wms.operate","mail.manage","import.operate","customs.manage","cash.operate","cash.approve","invoice.manage","reports.view"];

export function buildSeed(): Db {
  const r = rng(627);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const today = isoDate(new Date());
  const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`).toISOString();

  const stations: Db["stations"] = [
    { code: "VTE", nameLo: "ວຽງຈັນ (ວັດໄຕ)", nameEn: "Vientiane (Wattay)", countryEn: "Laos", scope: "domestic", branchLo: "ສໍານັກງານໃຫຍ່ ພະແນກຂົນສົ່ງສິນຄ້າ", branchEn: "Cargo Department Head Office", phone: "+856 21 512 010", active: true, isHub: true },
    { code: "LPQ", nameLo: "ຫຼວງພະບາງ", nameEn: "Luang Prabang", countryEn: "Laos", scope: "domestic", branchLo: "ສໍານັກງານໜ້າບິນ ຫຼວງພະບາງ", branchEn: "Luang Prabang Airport Office", phone: "+856 71 212 172", active: true },
    { code: "PKZ", nameLo: "ປາກເຊ", nameEn: "Pakse", countryEn: "Laos", scope: "domestic", branchLo: "ສໍານັກງານໜ້າບິນ ປາກເຊ", branchEn: "Pakse Airport Office", phone: "+856 31 212 252", active: true },
    { code: "ZVK", nameLo: "ສະຫວັນນະເຂດ", nameEn: "Savannakhet", countryEn: "Laos", scope: "domestic", branchLo: "ສໍານັກງານໜ້າບິນ ສະຫວັນນະເຂດ", branchEn: "Savannakhet Airport Office", phone: "+856 41 212 140", active: true },
    { code: "XKH", nameLo: "ຊຽງຂວາງ", nameEn: "Xieng Khouang", countryEn: "Laos", scope: "domestic", branchLo: "ສໍານັກງານໜ້າບິນ ຊຽງຂວາງ", branchEn: "Xieng Khouang Airport Office", phone: "+856 61 312 027", active: true },
    { code: "ODY", nameLo: "ອຸດົມໄຊ", nameEn: "Oudomxay", countryEn: "Laos", scope: "domestic", branchLo: "ສໍານັກງານໜ້າບິນ ອຸດົມໄຊ", branchEn: "Oudomxay Airport Office", phone: "+856 81 312 146", active: true },
    { code: "BKK", nameLo: "ບາງກອກ", nameEn: "Bangkok", countryEn: "Thailand", scope: "international", branchLo: "ສໍານັກງານ ບາງກອກ", branchEn: "Bangkok Office", phone: "+66 2 000 0100", active: true },
    { code: "HAN", nameLo: "ຮ່າໂນ້ຍ", nameEn: "Hanoi", countryEn: "Vietnam", scope: "international", branchLo: "ສໍານັກງານ ຮ່າໂນ້ຍ", branchEn: "Hanoi Office", phone: "+84 24 0000 0100", active: true },
    { code: "SGN", nameLo: "ໂຮຈິມິນ", nameEn: "Ho Chi Minh City", countryEn: "Vietnam", scope: "international", branchLo: "ສໍານັກງານ ໂຮຈິມິນ", branchEn: "Ho Chi Minh City Office", phone: "+84 28 0000 0100", active: true },
    { code: "KMG", nameLo: "ຄຸນໝິງ", nameEn: "Kunming", countryEn: "China", scope: "international", branchLo: "ສໍານັກງານ ຄຸນໝິງ", branchEn: "Kunming Office", phone: "+86 871 0000 0100", active: true },
  ];
  const roles: Db["roles"] = [
    { id: "R-ADMIN", nameLo: "ຜູ້ດູແລລະບົບ", nameEn: "System Administrator", perms: [...ALL] },
    { id: "R-MGR", nameLo: "ຜູ້ຈັດການພະແນກ", nameEn: "Cargo Manager", perms: ["rates.approve","tariff.approve","booking.approve","booking.manage","awb.void","cash.approve","crm.manage","reports.view","invoice.manage","customs.manage"] },
    { id: "R-ACC", nameLo: "ພະນັກງານຮັບສິນຄ້າ", nameEn: "Acceptance Officer", perms: ["crm.manage","booking.manage","awb.issue","screening.record","flight.dispatch","messages.manage","reports.view"] },
    { id: "R-WH", nameLo: "ພະນັກງານສາງ", nameEn: "Warehouse Officer", perms: ["wms.operate","mail.manage","import.operate","flight.dispatch","screening.record"] },
    { id: "R-IMP", nameLo: "ພະນັກງານສິນຄ້າຂາເຂົ້າ", nameEn: "Import Officer", perms: ["import.operate","customs.manage","wms.operate","crm.manage"] },
    { id: "R-CASH", nameLo: "ພະນັກງານການເງິນ", nameEn: "Cashier", perms: ["cash.operate","invoice.manage","reports.view"] },
  ];
  const users: User[] = [
    ["U-01","ສົມພອນ ວົງສາ","Somphone Vongsa","somphone","R-MGR","VTE"],["U-02","ແສງດາວ ພົມມະຈັນ","Sengdao Phommachan","sengdao","R-ACC","VTE"],
    ["U-03","ບຸນມີ ສີສະຫວັດ","Bounmy Sisavath","bounmy","R-WH","VTE"],["U-04","ມະນີວັນ ແກ້ວມະນີ","Manivanh Keomany","manivanh","R-CASH","VTE"],
    ["U-05","ທອງໃສ ຈັນທະລາ","Thongsay Chanthala","thongsay","R-IMP","VTE"],["U-06","ວິໄລ ໄຊຍະວົງ","Vilay Xayavong","vilay","R-ADMIN","VTE"],
    ["U-07","ຄໍາຫຼ້າ ສຸວັນນະລາດ","Khamla Souvannarath","khamla","R-ACC","LPQ"],["U-08","ນ້ອຍ ພິມມະສອນ","Noy Phimmasone","noy","R-WH","PKZ"],
    ["U-09","ພອນສະຫວັນ ອິນທະວົງ","Phonesavanh Inthavong","phonesavanh","R-CASH","LPQ"],["U-10","ລັດສະໝີ ດວງປັນຍາ","Latsamy Douangpanya","latsamy","R-ACC","BKK"],
  ].map(([id,nameLo,nameEn,username,roleId,station]) => ({ id,nameLo,nameEn,username,roleId,station,active:true,lastLogin:at(dateAdd(today,-int(0,3)),"08:0"+int(0,9)) }));

  const aircraft: Db["aircraft"] = [
    { code: "AT7", nameEn: "ATR 72-600", maxCargoKg: 1500, maxCargoM3: 10 },
    { code: "320", nameEn: "Airbus A320-200", maxCargoKg: 3500, maxCargoM3: 28 },
  ];
  const pairs: [string,string,string,string,string,string,string][] = [
    ["QV101","VTE","LPQ","07:30","08:15","AT7","domestic"],["QV102","LPQ","VTE","09:00","09:45","AT7","domestic"],
    ["QV301","VTE","PKZ","10:30","11:45","AT7","domestic"],["QV302","PKZ","VTE","12:30","13:45","AT7","domestic"],
    ["QV311","VTE","ZVK","14:00","15:00","AT7","domestic"],["QV312","ZVK","VTE","15:40","16:40","AT7","domestic"],
    ["QV201","VTE","XKH","08:00","08:35","AT7","domestic"],["QV202","XKH","VTE","09:15","09:50","AT7","domestic"],
    ["QV445","VTE","BKK","12:10","13:25","320","international"],["QV446","BKK","VTE","14:30","15:40","320","international"],
    ["QV321","VTE","HAN","16:00","17:05","320","international"],["QV322","HAN","VTE","18:00","19:05","320","international"],
    ["QV513","VTE","KMG","09:40","12:00","320","international"],["QV514","KMG","VTE","13:10","13:40","320","international"],
    ["QV345","PKZ","SGN","13:50","15:05","AT7","international"],["QV346","SGN","PKZ","15:50","17:05","AT7","international"],
  ];
  const routes: Db["routes"] = pairs.map(([,o,d,,,,s],i)=>({ id:`RT-${i+1}`, origin:o, dest:d, scope:s as Scope, active:true }));
  const flights: Flight[] = [];
  for (let off = -9; off <= 6; off++) {
    const date = dateAdd(today, off);
    pairs.forEach(([no,origin,dest,std,sta,ac,scope]) => flights.push({ id:`F-${no}-${date}`, no, date, std, sta, origin, dest, aircraft: ac, scope: scope as Scope, status: off < 0 ? "arrived" : "open" }));
  }
  const flight = (no: string, off: number) => flights.find((f) => f.no === no && f.date === dateAdd(today, off))!;

  const currencies: Db["currencies"] = [
    { code:"LAK", nameLo:"ເງິນກີບ", nameEn:"Lao Kip", symbol:"₭", active:true },{ code:"USD", nameLo:"ໂດລາສະຫະລັດ", nameEn:"US Dollar", symbol:"$", active:true },
    { code:"THB", nameLo:"ເງິນບາດ", nameEn:"Thai Baht", symbol:"฿", active:true },{ code:"VND", nameLo:"ເງິນດົ່ງ", nameEn:"Vietnamese Dong", symbol:"₫", active:false },
  ];
  const rates: Db["rates"] = [
    { id:"XR-1", currency:"USD", toLak:22350, effectiveFrom:dateAdd(today,-30), status:"approved", requestedBy:"U-04", decidedBy:"U-01", createdAt:at(dateAdd(today,-31),"09:00") },
    { id:"XR-2", currency:"THB", toLak:645, effectiveFrom:dateAdd(today,-30), status:"approved", requestedBy:"U-04", decidedBy:"U-01", createdAt:at(dateAdd(today,-31),"09:02") },
    { id:"XR-3", currency:"USD", toLak:22480, effectiveFrom:dateAdd(today,-2), status:"approved", requestedBy:"U-04", decidedBy:"U-01", createdAt:at(dateAdd(today,-3),"09:00") },
    { id:"XR-4", currency:"THB", toLak:652, effectiveFrom:dateAdd(today,-2), status:"approved", requestedBy:"U-04", decidedBy:"U-01", createdAt:at(dateAdd(today,-3),"09:05") },
    { id:"XR-5", currency:"USD", toLak:22560, effectiveFrom:dateAdd(today,1), status:"pending", requestedBy:"U-04", createdAt:at(today,"08:40"), note:"ອັດຕາ ທະນາຄານ ມື້ນີ້ / Bank rate today" },
  ];
  const stock: Db["awbStock"] = [
    { id:"ST-1", prefix:"627", from:4410000, to:4414999, assigneeType:"station", assignee:"VTE", nextSerial:4410000, voided:3, createdAt:at(dateAdd(today,-60),"10:00"), active:true },
    { id:"ST-2", prefix:"627", from:4415000, to:4416999, assigneeType:"station", assignee:"LPQ", nextSerial:4415210, voided:1, createdAt:at(dateAdd(today,-60),"10:05"), active:true },
    { id:"ST-3", prefix:"627", from:4417000, to:4417999, assigneeType:"station", assignee:"PKZ", nextSerial:4417120, voided:0, createdAt:at(dateAdd(today,-60),"10:06"), active:true },
    { id:"ST-4", prefix:"627", from:4418000, to:4418499, assigneeType:"agent", assignee:"C-101", nextSerial:4418044, voided:0, createdAt:at(dateAdd(today,-40),"10:06"), active:true },
    { id:"ST-5", prefix:"627", from:4418500, to:4418999, assigneeType:"station", assignee:"BKK", nextSerial:4418630, voided:2, createdAt:at(dateAdd(today,-40),"10:10"), active:true },
  ];
  const eff = dateAdd(today, -120);
  const T = (id: string, category: Tariff["category"], code: string, nameLo: string, nameEn: string, scope: Scope, basis: Tariff["basis"], rate: number, minCharge: number, currency: string, extra: Partial<Tariff> = {}): Tariff => ({ id, category, code, nameLo, nameEn, scope, basis, rate, minCharge, currency, effectiveFrom: eff, status:"approved", source: scope==="international"&&(category==="general"||category==="special")?"IATA TACT":"ຂໍ້ຕົກລົງພາຍໃນ / Internal", requestedBy:"U-02", decidedBy:"U-01", ...extra });
  const gen = (id:string,o:string,d:string,scope:Scope,rate:number,min:number,cur:string)=>T(id,"general",`GCR-${o}${d}`,`ສິນຄ້າທົ່ວໄປ ${o}-${d}`,`General cargo ${o}-${d}`,scope,"per_kg",rate,min,cur,{origin:o,dest:d});
  const spc = (id:string,o:string,d:string,shc:string,lo:string,en:string,scope:Scope,rate:number,min:number,cur:string)=>T(id,"special",`SCR-${shc}-${o}${d}`,`${lo} ${o}-${d}`,`${en} ${o}-${d}`,scope,"per_kg",rate,min,cur,{origin:o,dest:d,shc});
  const tariffs: Tariff[] = [
    gen("TF-1","VTE","LPQ","domestic",11000,110000,"LAK"),gen("TF-2","VTE","PKZ","domestic",13000,130000,"LAK"),gen("TF-3","VTE","ZVK","domestic",12000,120000,"LAK"),gen("TF-4","VTE","XKH","domestic",9500,95000,"LAK"),
    gen("TF-5","VTE","BKK","international",1.05,35,"USD"),gen("TF-6","VTE","HAN","international",1.3,40,"USD"),gen("TF-7","VTE","KMG","international",1.65,45,"USD"),gen("TF-8","PKZ","SGN","international",1.45,40,"USD"),
    spc("TF-9","VTE","BKK","PER","ສິນຄ້າເນົ່າເສຍງ່າຍ","Perishables","international",1.4,45,"USD"),spc("TF-10","VTE","BKK","VAL","ສິນຄ້າມີຄ່າ","Valuables","international",3.2,80,"USD"),spc("TF-11","VTE","LPQ","PER","ສິນຄ້າເນົ່າເສຍງ່າຍ","Perishables","domestic",15000,150000,"LAK"),spc("TF-12","VTE","PKZ","PER","ສິນຄ້າເນົ່າເສຍງ່າຍ","Perishables","domestic",17500,170000,"LAK"),spc("TF-13","VTE","HAN","AVI","ສັດມີຊີວິດ","Live animals","international",2.6,70,"USD"),
    T("TF-14","service","XRY-D","ຄ່າກວດ X-Ray (ພາຍໃນ)","X-Ray screening (domestic)","domestic","per_kg",500,20000,"LAK"),T("TF-15","service","XRY-I","ຄ່າກວດ X-Ray (ຕ່າງປະເທດ)","X-Ray screening (international)","international","per_kg",0.05,3,"USD"),
    T("TF-16","service","PKG-D","ຄ່າຫຸ້ມຫໍ່ (ພາຍໃນ)","Packaging (domestic)","domestic","flat",50000,0,"LAK"),T("TF-17","service","PKG-I","ຄ່າຫຸ້ມຫໍ່ (ຕ່າງປະເທດ)","Packaging (international)","international","flat",5,0,"USD"),
    T("TF-18","service","COL-D","ຄ່າຫ້ອງເຢັນ (ພາຍໃນ)","Cold room (domestic)","domestic","per_kg",1500,50000,"LAK"),T("TF-19","service","COL-I","ຄ່າຫ້ອງເຢັນ (ຕ່າງປະເທດ)","Cold room (international)","international","per_kg",0.12,8,"USD"),
    T("TF-20","service","FSC-D","ຄ່າທໍານຽມນໍ້າມັນ (ພາຍໃນ)","Fuel surcharge (domestic)","domestic","percent",8,0,"LAK"),T("TF-21","service","FSC-I","ຄ່າທໍານຽມນໍ້າມັນ (ຕ່າງປະເທດ)","Fuel surcharge (international)","international","percent",12,0,"USD"),
    T("TF-22","service","AWB-D","ຄ່າອອກ AWB (ພາຍໃນ)","AWB fee (domestic)","domestic","flat",30000,0,"LAK"),T("TF-23","service","AWB-I","ຄ່າອອກ AWB (ຕ່າງປະເທດ)","AWB fee (international)","international","flat",3,0,"USD"),
    T("TF-24","storage","STO-D","ຄ່າຝາກສາງ (ສາຍພາຍໃນ)","Storage fee (domestic)","domestic","per_kg_day",300,10000,"LAK",{freeDays:0}),T("TF-25","storage","STO-I","ຄ່າຝາກສາງ (ສາຍຕ່າງປະເທດ)","Storage fee (international)","international","per_kg_day",600,20000,"LAK",{freeDays:0}),
    T("TF-26","mail","MAIL-D","ຄ່າຖົງເມ (ສາຍພາຍໃນ)","Mail bag fee (domestic)","domestic","per_kg",2500,15000,"LAK"),T("TF-27","mail","MAIL-I","ຄ່າຖົງເມ (ສາຍຕ່າງປະເທດ)","Mail bag fee (international)","international","per_kg",5500,30000,"LAK"),
    T("TF-28","general","GCR-VTELPQ","ສິນຄ້າທົ່ວໄປ VTE-LPQ (ອັດຕາໃໝ່)","General cargo VTE-LPQ (new rate)","domestic","per_kg",11800,118000,"LAK",{origin:"VTE",dest:"LPQ",effectiveFrom:dateAdd(today,7),status:"pending",decidedBy:undefined,note:"ປັບຕາມຕົ້ນທຶນນໍ້າມັນ / Adjusted for fuel cost"}),
  ];

  const cust = (id:string,code:string,name:string,nameEn:string,type:Customer["type"],contact:string,phone:string,wa:boolean,limit:number,days:number,addr:string,station="VTE",portal?:string):Customer=>({ id,code,name,nameEn,type,contact,phone,whatsapp:wa?phone:undefined,email:`contact${code.toLowerCase()}@example.la`,address:addr,station,creditLimit:limit,creditDays:days,portalUser:portal,active:true,createdAt:at(dateAdd(today,-int(100,600)),"10:00") });
  const customers: Customer[] = [
    cust("C-101","AG101","ບໍລິສັດ ວຽງຄໍາ ໂລຈິສຕິກ ຈໍາກັດ","Vieng Kham Logistics Co., Ltd","agent","ທ່ານ ອານຸສອນ","020 5512 0101",true,300000000,30,"ບ້ານ ໂພນທັນ, ເມືອງ ໄຊເສດຖາ, ນະຄອນຫຼວງວຽງຈັນ","VTE","viengkham"),
    cust("C-102","AG102","ບໍລິສັດ ສາຍຟ້າ ຄາໂກ້ ຈໍາກັດ","Saifa Cargo Co., Ltd","agent","ທ່ານ ນາງ ດາລາວັນ","020 5512 0202",true,200000000,30,"ບ້ານ ໜອງບົວທອງ, ເມືອງ ສີໂຄດຕະບອງ, ນະຄອນຫຼວງວຽງຈັນ","VTE","saifa"),
    cust("C-103","AG103","ບໍລິສັດ ແມ່ຂອງ ຟໍເວີດເດີ ຈໍາກັດ","Mekong Forwarder Co., Ltd","agent","ທ່ານ ສົມສັກ","020 5512 0303",true,150000000,15,"ບ້ານ ປາກເຊໃຕ້, ເມືອງ ປາກເຊ, ແຂວງ ຈໍາປາສັກ","PKZ","mekongfw"),
    cust("C-104","AG104","Siam Link Air Freight Co., Ltd","Siam Link Air Freight Co., Ltd","agent","Khun Narong","+66 81 200 0404",true,250000000,30,"Lat Krabang, Bangkok","BKK"),
    cust("C-201","CP201","ບໍລິສັດ ກາເຟພູພຽງ ຈໍາກັດ","Phou Phieng Coffee Co., Ltd","corporate","ທ່ານ ນາງ ບົວໄຂ","020 5533 0201",true,120000000,30,"ບ້ານ ຫຼັກ 35, ເມືອງ ປາກຊ່ອງ, ແຂວງ ຈໍາປາສັກ","PKZ"),
    cust("C-202","CP202","ໂຮງໝໍ ມິດຕະພາບ (ຝ່າຍຈັດຊື້)","Mittaphap Hospital (Procurement)","corporate","ທ່ານ ວັນນະສອນ","020 5533 0202",false,80000000,30,"ບ້ານ ດົງໂດກ, ເມືອງ ໄຊທານີ, ນະຄອນຫຼວງວຽງຈັນ"),
    cust("C-203","CP203","ບໍລິສັດ ໄໝລາວ ຫັດຖະກໍາ ຈໍາກັດ","Lao Silk Craft Co., Ltd","corporate","ທ່ານ ນາງ ຄໍາແພງ","020 5533 0203",true,60000000,15,"ບ້ານ ວັດໃຕ້, ເມືອງ ຫຼວງພະບາງ, ແຂວງ ຫຼວງພະບາງ","LPQ"),
    cust("C-204","CP204","ບໍລິສັດ ອາໄຫຼ່ ເອເຊຍ ຈໍາກັດ","Asia Spare Parts Co., Ltd","corporate","ທ່ານ ບຸນເລີດ","020 5533 0204",true,100000000,30,"ບ້ານ ສີເມືອງ, ເມືອງ ສີສັດຕະນາກ, ນະຄອນຫຼວງວຽງຈັນ"),
    cust("C-205","CP205","ຮ້ານ ຜັກປອດສານ ພູຄູນ","Phou Khoun Organic Vegetables","corporate","ທ່ານ ນາງ ພອນ","020 5533 0205",true,30000000,7,"ເມືອງ ພູຄູນ, ແຂວງ ຫຼວງພະບາງ","LPQ"),
    cust("C-301","GN301","ທ່ານ ສີສຸກ ພັນທະວົງ","Sisouk Phanthavong","general","ທ່ານ ສີສຸກ","020 5544 0301",true,0,0,"ບ້ານ ທົ່ງກາງ, ເມືອງ ສີສັດຕະນາກ, ນະຄອນຫຼວງວຽງຈັນ"),
    cust("C-302","GN302","ທ່ານ ນາງ ແສງຈັນ ບຸບຜາ","Sengchan Bouppha","general","ທ່ານ ນາງ ແສງຈັນ","020 5544 0302",false,0,0,"ບ້ານ ໂພນໄຊ, ເມືອງ ໄຊເສດຖາ, ນະຄອນຫຼວງວຽງຈັນ"),
    cust("C-303","GN303","ທ່ານ ວິລະສັກ ມະນີວົງ","Virasak Manivong","general","ທ່ານ ວິລະສັກ","020 5544 0303",true,0,0,"ບ້ານ ຫາດຊາຍຟອງ, ນະຄອນຫຼວງວຽງຈັນ"),
    cust("C-304","GN304","ທ່ານ ນາງ ມາລີ ສຸລິຍະ","Mali Souliya","general","ທ່ານ ນາງ ມາລີ","020 5544 0304",false,0,0,"ບ້ານ ນາສ້ຽວ, ເມືອງ ນາຊາຍທອງ, ນະຄອນຫຼວງວຽງຈັນ"),
    cust("C-305","GN305","Tran Van Minh","Tran Van Minh","general","Tran Van Minh","+84 90 000 0305",true,0,0,"Cau Giay, Hanoi","HAN"),
    cust("C-306","GN306","Wang Lei Trading","Wang Lei Trading","general","Wang Lei","+86 138 0000 0306",false,0,0,"Guandu, Kunming","KMG"),
  ];
  const zones: Db["zones"] = [
    ["Z-1","VTE","A1","ໂຊນ A ສິນຄ້າທົ່ວໄປ ຂາອອກ","Zone A General export","general",12000],["Z-2","VTE","B1","ໂຊນ B ສິນຄ້າທົ່ວໄປ ຂາເຂົ້າ","Zone B General import","general",15000],
    ["Z-3","VTE","C1","ຫ້ອງເຢັນ","Cold room","cold",2500],["Z-4","VTE","V1","ຕູ້ນິລະໄພ ສິນຄ້າມີຄ່າ","Valuables vault","valuable",300],
    ["Z-5","VTE","D1","ໂຊນສິນຄ້າອັນຕະລາຍ","Dangerous goods cage","dg",800],["Z-6","VTE","M1","ໂຊນຖົງເມ","Mail room","mail",1500],["Z-7","VTE","T1","ໂຊນຖ່າຍລໍາ","Transit area","transit",3000],
    ["Z-8","LPQ","A1","ໂຊນ A ທົ່ວໄປ","Zone A General","general",3000],["Z-9","PKZ","A1","ໂຊນ A ທົ່ວໄປ","Zone A General","general",3500],
  ].map(([id,station,code,nameLo,nameEn,type,capacityKg])=>({id:id as string,station:station as string,code:code as string,nameLo:nameLo as string,nameEn:nameEn as string,type:type as any,capacityKg:capacityKg as number,active:true}));

  const templates: Db["templates"] = [
    { id:"TM-1", key:"arrival", nameLo:"ແຈ້ງສິນຄ້າມາຮອດ", nameEn:"Arrival notice", bodyLo:"ສະບາຍດີ {name}. ສິນຄ້າ AWB {awb} ຈໍານວນ {pieces} ກ່ອງ ມາຮອດ {station} ແລ້ວ ໂດຍຖ້ຽວບິນ {flight}. ກະລຸນາມາຮັບທີ່ສາງສິນຄ້າ ພະແນກຂົນສົ່ງສິນຄ້າ ການບິນລາວ. ຮັບພາຍໃນມື້ ບໍ່ເສຍຄ່າຝາກສາງ.", bodyEn:"Hello {name}. Cargo AWB {awb}, {pieces} piece(s), has arrived at {station} on flight {flight}. Please collect it at the Lao Airlines cargo warehouse. Same-day pickup has no storage fee.", active:true },
    { id:"TM-2", key:"aging", nameLo:"ແຈ້ງສິນຄ້າຄ້າງສາງ", nameEn:"Aging reminder", bodyLo:"ສະບາຍດີ {name}. ສິນຄ້າ AWB {awb} ຄ້າງສາງ {days} ວັນແລ້ວ ຄ່າຝາກສາງປະຈຸບັນ {fee}. ກະລຸນາມາຮັບໂດຍໄວ.", bodyEn:"Hello {name}. Cargo AWB {awb} has been in storage for {days} days. Current storage fee: {fee}. Please collect it soon.", active:true },
    { id:"TM-3", key:"offload", nameLo:"ແຈ້ງສິນຄ້າອ໋ອບໂຫຼດ", nameEn:"Offload notice", bodyLo:"ສະບາຍດີ {name}. ສິນຄ້າ AWB {awb} ຖືກອ໋ອບໂຫຼດຈາກຖ້ຽວບິນ {flight} ຍ້ອນ {reason}. ຖ້ຽວບິນໃໝ່: {next}.", bodyEn:"Hello {name}. Cargo AWB {awb} was offloaded from flight {flight} due to {reason}. New flight: {next}.", active:true },
    { id:"TM-4", key:"booking", nameLo:"ແຈ້ງຜົນການຈອງ", nameEn:"Booking result", bodyLo:"ສະບາຍດີ {name}. ການຈອງ {booking} ຖ້ຽວບິນ {flight}: {status}. {reason}", bodyEn:"Hello {name}. Booking {booking} on flight {flight}: {status}. {reason}", active:true },
  ];

  // ---------- shipments ----------
  const awbs: Awb[] = []; const loads: FlightLoad[] = []; let serialVte = 4410000; let ev = 1;
  const commodities: [string,string[]][] = [["ກາເຟດິບ / Green coffee",[]],["ເອກະສານ / Documents",[]],["ອາໄຫຼ່ເຄື່ອງຈັກ / Machine parts",[]],["ຜ້າໄໝ / Silk textiles",[]],["ຜັກສົດ / Fresh vegetables",["PER"]],["ດອກໄມ້ສົດ / Fresh flowers",["PER"]],["ຢາ ແລະ ອຸປະກອນການແພດ / Medical supplies",["PHA"]],["ເຄື່ອງເອເລັກໂຕຣນິກ / Electronics",[]],["ເຄື່ອງນຸ່ງຫົ່ມ / Garments",[]],["ຫັດຖະກໍາ / Handicrafts",[]],["ເຄື່ອງປະດັບ / Jewellery",["VAL"]],["ປາສົດ / Fresh fish",["PER"]]];
  const stageIdx = (s: StageCode) => STAGES.indexOf(s);
  const ageOffset: Partial<Record<StageCode, number>> = { BKD:-180, RCS:-120, SCR:-90, MAN:-60, DEP:0, ARR:80, RCF:110, NFD:130, CUS:200, DLV:300 };
  function mkAwb(o: { dir: Awb["direction"]; origin: string; dest: string; flight?: Flight; flightNo?: string; stage: StageCode; arrivedDaysAgo?: number; shipper: string; consignee: string; agent?: string; paid?: boolean; payMode?: Awb["payMode"]; cond?: Awb["condition"]; condNote?: string; comm?: [string,string[]]; zone?: string; pcs?: number; wt?: number; note?: string; screen?: "pass"|"fail"|"pending" }): Awb {
    const comm = o.comm ?? pick(commodities);
    const pcs = o.pcs ?? int(1, 12);
    const wt = o.wt ?? (pcs * int(4, 38));
    const l = int(30,80), w = int(25,60), h = int(20,55);
    const lines = [{ id:`PL-${ev++}`, pieces:pcs, lengthCm:l, widthCm:w, heightCm:h, weightKg:wt }];
    const volumeKg = Math.round(((l*w*h*pcs)/6000)*10)/10;
    const ch = Math.ceil(Math.max(wt, volumeKg)*2)/2;
    const scope: Scope = stations.find(s=>s.code===o.origin)?.scope==="international"||stations.find(s=>s.code===o.dest)?.scope==="international" ? "international" : "domestic";
    const cur = scope==="international" ? "USD" : "LAK";
    const rate = scope==="international" ? 1.3 : 12000;
    const freight = Math.max(rate*ch, scope==="international"?35:110000);
    const charges: ChargeLine[] = [
      { id:`CL-${ev++}`, code: comm[1].length?"SCR":"GCR", nameLo: comm[1].length?"ຄ່າຂົນສົ່ງ ສິນຄ້າພິເສດ":"ຄ່າຂົນສົ່ງ ສິນຄ້າທົ່ວໄປ", nameEn: comm[1].length?"Special cargo freight":"General cargo freight", amount:freight, currency:cur, kind:"freight" },
      { id:`CL-${ev++}`, code: scope==="international"?"FSC-I":"FSC-D", nameLo:"ຄ່າທໍານຽມນໍ້າມັນ", nameEn:"Fuel surcharge", amount:freight*(scope==="international"?.12:.08), currency:cur, kind:"service" },
      { id:`CL-${ev++}`, code: scope==="international"?"XRY-I":"XRY-D", nameLo:"ຄ່າກວດ X-Ray", nameEn:"X-Ray screening", amount:Math.max(scope==="international"?.05*ch:500*ch, scope==="international"?3:20000), currency:cur, kind:"service" },
      { id:`CL-${ev++}`, code: scope==="international"?"AWB-I":"AWB-D", nameLo:"ຄ່າອອກ AWB", nameEn:"AWB fee", amount:scope==="international"?3:30000, currency:cur, kind:"service" },
    ];
    const total = charges.reduce((s,c)=>s+c.amount,0);
    const baseDate = o.arrivedDaysAgo!=null ? dateAdd(today,-o.arrivedDaysAgo) : (o.flight?.date ?? today);
    const baseTs = new Date(`${baseDate}T${o.flight?.std ?? "10:00"}:00`).getTime();
    const staffOf: Partial<Record<StageCode,string>> = { BKD:"U-02", RCS:"U-02", SCR:"U-03", MAN:"U-02", DEP:"U-03", ARR:"U-05", RCF:"U-03", NFD:"U-05", CUS:"U-05", DLV:"U-05" };
    const events: AwbEvent[] = [];
    for (const s of STAGES.slice(0, stageIdx(o.stage)+1)) {
      if (o.dir==="export" && ["CUS","NFD"].includes(s)) continue;
      const when = new Date(baseTs + (ageOffset[s] ?? 0)*60000);
      const clamp = when.getTime() > Date.now() && !["BKD","RCS","SCR"].includes(s) ? new Date(Date.now()-3600000) : when.getTime() > Date.now() ? new Date(Date.now()-((10-stageIdx(s))*1800000)) : when;
      events.push({ id:`EV-${ev++}`, code:s, ts:clamp.toISOString(), station: stageIdx(s)>=5 ? o.dest : o.origin, userId:staffOf[s]!, flightNo:["MAN","DEP","ARR"].includes(s)?(o.flight?.no ?? o.flightNo):undefined, pieces:pcs });
    }
    const serial = withCheckDigit(serialVte++);
    const rec = stageIdx(o.stage)>=stageIdx("RCF");
    const a: Awb = {
      id:`AWB-${serial}`, prefix:"627", serial, no:awbNo("627",serial), direction:o.dir, status:"active", shipperId:o.shipper, consigneeId:o.consignee, agentId:o.agent,
      origin:o.origin, dest:o.dest, flightId:o.flight?.id, station:stageIdx(o.stage)>=stageIdx("ARR")?o.dest:o.origin,
      commodity:comm[0], shc:comm[1], lines, pieces:pcs, grossKg:wt, volumeKg, chargeableKg:ch, roundedTo:.5, charges, total, currency:cur,
      payMode:o.payMode??(o.agent?"credit":"cash"), paid:o.paid??!!o.agent, events, stage:o.stage,
      screening: stageIdx(o.stage)>=stageIdx("SCR") ? { result:o.screen??"pass", method:"X-Ray", machine:"XR-02", operator:"U-03", at:events.find(e=>e.code==="SCR")?.ts??events[0].ts, fee:charges[2].amount } : undefined,
      houses:[], zoneId:o.zone, receivedPieces:rec?pcs:(stageIdx(o.stage)>=1?pcs:0), loadedPieces:stageIdx(o.stage)>=stageIdx("DEP")?pcs:0, deliveredPieces:o.stage==="DLV"?pcs:0, condition:o.cond??"good", conditionNote:o.condNote,
      arrivedAt:o.arrivedDaysAgo!=null?at(baseDate,o.flight?.sta??"11:00"):undefined, deliveredAt:o.stage==="DLV"?events[events.length-1].ts:undefined, issuedBy:"U-02", issuedAt:events[0].ts, offloadedPieces:0, staffNote:o.note,
    };
    if (o.dir==="import" && o.stage==="DLV") a.delivery = { receiverName:pick(["ທ່ານ ສົມຈິດ","ທ່ານ ນາງ ວັນນີ","ທ່ານ ຄໍາພອນ"]), receiverPhone:"020 5"+int(1000000,9999999), signedAt:a.deliveredAt!, pieces:pcs, storageDays:0, storageFee:0, currency:"LAK", documentsChecked:true, by:"U-05" };
    awbs.push(a);
    return a;
  }
  const agents=["C-101","C-102","C-103"]; const corp=["C-201","C-202","C-203","C-204","C-205"]; const gens=["C-301","C-302","C-303","C-304"];
  const anyC=()=>pick([...corp,...gens]);
  // Export at VTE for today's and tomorrow's flights
  const exportFlights:[string,number,string][]=[["QV445",0,"BKK"],["QV101",0,"LPQ"],["QV301",0,"PKZ"],["QV311",0,"ZVK"],["QV321",0,"HAN"],["QV513",1,"KMG"],["QV445",1,"BKK"],["QV101",1,"LPQ"]];
  exportFlights.forEach(([no,off,dest])=>{
    const f=flight(no,off);
    (off===0?["MAN","MAN","SCR","SCR","RCS","RCS"]:["RCS","RCS","BKD"]).forEach((st,i)=>{
      const ag=r()<.4?pick(agents):undefined;
      const a=mkAwb({dir:"export",origin:"VTE",dest,flight:f,stage:st as StageCode,shipper:ag??anyC(),consignee:pick(gens),agent:ag,zone:st==="BKD"?undefined:"Z-1",paid:ag?true:r()<.7});
      if(st==="MAN"){ loads.push({id:`L-${a.id}`,flightId:f.id,awbId:a.id,pieces:a.pieces,weightKg:a.grossKg,status:i===0?"loaded":"planned",scannedBy:i===0?"U-03":undefined,scannedAt:i===0?new Date().toISOString():undefined}); if(i===0)a.loadedPieces=a.pieces; }
    });
  });
  // Departed exports (recent)
  for(let i=1;i<=7;i++){ for(const [no,dest] of [["QV445","BKK"],["QV301","PKZ"],["QV101","LPQ"]] as const){ const f=flight(no,-i); if(!f)continue; const a=mkAwb({dir:"export",origin:"VTE",dest,flight:f,stage:r()<.7?"ARR":"DLV",shipper:anyC(),consignee:pick(gens),paid:true}); loads.push({id:`L-${a.id}`,flightId:f.id,awbId:a.id,pieces:a.pieces,weightKg:a.grossKg,status:"loaded",scannedBy:"U-03",scannedAt:a.events[0].ts}); } }
  // Import to VTE at various ages, including every aging band
  const importAges=[0,0,0,0,1,1,2,3,4,5,7,9,12,16,21,28,33,38,45,52,58,63,70,78,84,87,89,96,104,118];
  importAges.forEach((age,i)=>{
    const [no,origin]=pick([["QV446","BKK"],["QV322","HAN"],["QV514","KMG"],["QV102","LPQ"],["QV302","PKZ"],["QV312","ZVK"],["QV202","XKH"]] as [string,string][]);
    const f=age<=9?flight(no,-age):undefined;
    const stage:StageCode=age===0&&i<2?"ARR":age===0?"RCF":"NFD";
    const scope=stations.find(s=>s.code===origin)!.scope;
    const a=mkAwb({dir:"import",origin,dest:"VTE",flight:f,flightNo:no,stage,arrivedDaysAgo:age,shipper:scope==="international"?pick(["C-104","C-305","C-306"]):pick(corp),consignee:anyC(),zone:stage==="ARR"?undefined:(r()<.1?"Z-3":"Z-2"),paid:true,cond:i===6?"damage":i===14?"wet":i===20?"broken":"good",condNote:i===6?"ກ່ອງບຸບ ດ້ານຂ້າງ / Side of carton dented":i===14?"ກ່ອງປຽກນໍ້າ / Carton wet":i===20?"ສິນຄ້າແຕກ 1 ກ່ອງ / One carton broken":undefined});
    if(scope==="international"&&stage!=="ARR"){ a.customs={declarationNo:i%3===0?`LA${today.slice(2,4)}-${int(100000,999999)}`:"",status:i%3===0?"cleared":i%3===1?"submitted":"pending",method:"manual",updatedAt:a.events[a.events.length-1].ts,updatedBy:"U-05"}; }
  });
  // Delivered imports, recent
  for(let i=0;i<14;i++){ mkAwb({dir:"import",origin:pick(["BKK","HAN","LPQ","PKZ"]),dest:"VTE",stage:"DLV",arrivedDaysAgo:int(1,9),shipper:pick(corp),consignee:anyC(),zone:undefined,paid:true,flightNo:"QV446"}); }
  // Transit
  [["BKK","PKZ"],["HAN","LPQ"],["KMG","LPQ"]].forEach(([o,d],i)=>{ const a=mkAwb({dir:"transit",origin:o,dest:d,stage:"RCF",arrivedDaysAgo:i,shipper:"C-104",consignee:pick(corp),zone:"Z-7",flightNo:"QV446",paid:true,agent:"C-104"}); a.nextFlightId=flight(d==="PKZ"?"QV301":"QV101",i===0?0:1).id; });
  // Houses on two consolidated shipments
  const consol=awbs.find(a=>a.agentId==="C-101"&&a.direction==="export"&&a.stage==="MAN"); if(consol){ consol.houses=[{id:"H-1",hawb:"VK-260115",pieces:Math.ceil(consol.pieces/2),weightKg:Math.ceil(consol.grossKg/2),commodity:"Garments",shipper:"Sisouk Phanthavong",consignee:"Bangkok Trading"},{id:"H-2",hawb:"VK-260116",pieces:Math.floor(consol.pieces/2),weightKg:Math.floor(consol.grossKg/2),commodity:"Handicrafts",shipper:"Lao Silk Craft",consignee:"Bangkok Trading"}]; }
  // A voided one
  const v=awbs.find(a=>a.stage==="BKD"); if(v){ v.status="voided"; v.voidReason="ລູກຄ້າຍົກເລີກການສົ່ງ / Customer cancelled the shipment"; v.events.push({id:`EV-${ev++}`,code:"VOID",ts:new Date().toISOString(),station:"VTE",userId:"U-01",note:v.voidReason}); }
  stock[0].nextSerial=serialVte;

  const bookings: Db["bookings"] = [];
  const bk=(i:number,c:string,no:string,off:number,dest:string,p:number,w:number,comm:string,shc:string[],st:Db["bookings"][number]["status"],ch:"portal"|"counter",reason?:string)=>bookings.push({id:`BK-${2600+i}`,no:`BK${today.replace(/-/g,"").slice(2,6)}-${2600+i}`,customerId:c,flightId:flight(no,off).id,origin:flight(no,off).origin,dest,pieces:p,weightKg:w,volumeM3:Math.round(w/167*10)/10,commodity:comm,shc,status:st,reason,decidedBy:st==="requested"?undefined:"U-01",decidedAt:st==="requested"?undefined:new Date().toISOString(),channel:ch,createdAt:at(dateAdd(today,-int(0,2)),"09:1"+int(0,9))});
  bk(1,"C-101","QV445",1,"BKK",24,420,"ເຄື່ອງນຸ່ງຫົ່ມ / Garments",[],"requested","portal");
  bk(2,"C-102","QV513",1,"KMG",10,180,"ອາໄຫຼ່ເຄື່ອງຈັກ / Machine parts",[],"requested","portal");
  bk(3,"C-205","QV101",1,"LPQ",6,90,"ຜັກສົດ / Fresh vegetables",["PER"],"requested","counter");
  bk(4,"C-201","QV445",2,"BKK",40,800,"ກາເຟດິບ / Green coffee",[],"confirmed","counter");
  bk(5,"C-204","QV321",2,"HAN",14,260,"ອາໄຫຼ່ເຄື່ອງຈັກ / Machine parts",[],"confirmed","portal");
  bk(6,"C-103","QV301",1,"PKZ",60,1400,"ກາເຟຄົ່ວ / Roasted coffee",[],"waitlisted","portal","ນໍ້າໜັກເກີນພື້ນທີ່ຍັງເຫຼືອ ລໍຖ້າຖ້ຽວຖັດໄປ / Exceeds remaining space, waiting for next flight");
  bk(7,"C-301","QV311",1,"ZVK",2,1600,"ເຄື່ອງຈັກ / Heavy machinery",[],"rejected","counter","ນໍ້າໜັກເກີນຄວາມຈຸ ATR 72 / Exceeds ATR 72 capacity");
  bk(8,"C-303","QV101",2,"LPQ",3,45,"ເອກະສານ / Documents",[],"confirmed","counter");
  bk(9,"C-102","QV321",1,"HAN",8,130,"ເຄື່ອງເອເລັກໂຕຣນິກ / Electronics",[],"cancelled","portal","ລູກຄ້າຂໍຍົກເລີກ / Customer request");

  const mail: MailBag[]=[];
  const mb=(i:number,origin:string,dest:string,scope:Scope,dir:"outbound"|"inbound",status:MailBag["status"],bags:number,w:number,cat:MailBag["category"],fl?:Flight,paid=false)=>{const rate=scope==="international"?5500:2500;mail.push({id:`MB-${i}`,no:`${origin}${dest}${cat}${String(2600+i)}`,origin,dest,scope,flightId:fl?.id,bags,weightKg:w,category:cat,direction:dir,status,fee:Math.max(rate*w,scope==="international"?30000:15000),currency:"LAK",passNo:status==="received"?undefined:`MP-${2600+i}`,paid,receivedBy:"U-03",receivedAt:at(dateAdd(today,dir==="inbound"?-int(0,3):0),"08:3"+int(0,9)),postOffice:scope==="international"?"ໄປສະນີລາວ / Lao Post (International)":"ໄປສະນີລາວ / Lao Post"})};
  mb(1,"VTE","BKK","international","outbound","manifested",6,84,"LC",flight("QV445",0),true);mb(2,"VTE","LPQ","domestic","outbound","received",3,22,"CP",flight("QV101",1));mb(3,"VTE","PKZ","domestic","outbound","manifested",4,41,"EMS",flight("QV301",0),true);mb(4,"BKK","VTE","international","inbound","arrived",5,63,"LC",flight("QV446",-1),true);mb(5,"HAN","VTE","international","inbound","arrived",2,18,"EMS",flight("QV322",-2),true);mb(6,"LPQ","VTE","domestic","inbound","delivered",3,27,"CP",flight("QV102",-3),true);mb(7,"VTE","HAN","international","outbound","dispatched",4,55,"LC",flight("QV321",-1),true);mb(8,"PKZ","VTE","domestic","inbound","arrived",2,15,"LC",flight("QV302",-1),false);

  const irregularities: Db["irregularities"]=awbs.filter(a=>a.condition!=="good").map((a,i)=>({id:`IR-${i+1}`,no:`DMR-${2600+i}`,awbId:a.id,type:a.condition as any,pieces:1,note:a.conditionNote??"",status:i===0?"investigating":"open",station:a.dest,reportedBy:"U-03",reportedAt:a.events[a.events.length-1].ts}));
  const lostOne=awbs.find(a=>a.direction==="import"&&a.stage==="NFD"&&a.condition==="good"); if(lostOne) irregularities.push({id:"IR-90",no:"DMR-2690",awbId:lostOne.id,type:"short",pieces:1,note:"ຮັບຕົວຈິງຂາດ 1 ກ່ອງ ທຽບກັບ Manifest / One piece short against Manifest",status:"open",station:"VTE",reportedBy:"U-03",reportedAt:lostOne.events[lostOne.events.length-1].ts});

  const notifications: Db["notifications"]=[]; let n=1;
  awbs.filter(a=>a.direction==="import"&&a.stage==="NFD").slice(0,20).forEach(a=>{const c=customers.find(x=>x.id===a.consigneeId)!;notifications.push({id:`NT-${n++}`,ts:a.events[a.events.length-1].ts,channel:c.whatsapp?"whatsapp":"staff_note",templateKey:"arrival",customerId:c.id,awbId:a.id,to:c.whatsapp,body:c.whatsapp?templates[0].bodyLo.replace("{name}",c.contact).replace("{awb}",a.no).replace("{pieces}",String(a.pieces)).replace("{station}","VTE").replace("{flight}",a.events.find(e=>e.flightNo)?.flightNo??"QV446"):"ລູກຄ້າບໍ່ມີ WhatsApp: ໃຫ້ພະນັກງານໂທແຈ້ງ / Customer has no WhatsApp: staff to call",status:c.whatsapp?pick(["delivered","read","read","sent"]):"staff_note",by:"U-05"});});

  // Today's receipts and the open shift
  const shiftId="SH-1";
  const receipts: Receipt[]=[]; let rc=1;
  awbs.filter(a=>a.direction==="export"&&a.payMode==="cash"&&a.paid&&a.events.some(e=>e.ts.slice(0,10)===today)).slice(0,12).forEach(a=>{ const rate=a.currency==="USD"?22480:1; const method=rc%4===0?"transfer":"cash"; const rcpt:Receipt={id:`RC-${rc}`,no:`RV${today.replace(/-/g,"").slice(2)}-${String(rc).padStart(4,"0")}`,ts:a.events[0].ts,station:"VTE",scope:a.currency==="USD"?"international":"domestic",cashierId:"U-04",customerId:a.shipperId,payerName:customers.find(c=>c.id===a.shipperId)!.name,awbIds:[a.id],mailIds:[],lines:a.charges.map(c=>({description:c.nameEn,ref:a.no,amount:c.amount,currency:c.currency})),total:a.total,currency:a.currency,rateToLak:rate,lakEquivalent:a.total*rate,method,transferRef:method==="transfer"?`BCEL${int(100000,999999)}`:undefined,shiftId,status:"valid"}; receipts.push(rcpt); a.receiptId=rcpt.id; rc++; });
  const shifts: Db["shifts"]=[
    {id:shiftId,station:"VTE",cashierId:"U-04",date:today,openedAt:at(today,"07:30"),openingLak:5000000,openingUsd:200,status:"open"},
    {id:"SH-0",station:"VTE",cashierId:"U-04",date:dateAdd(today,-1),openedAt:at(dateAdd(today,-1),"07:30"),openingLak:5000000,openingUsd:200,status:"handed_over",countedLak:42350000,countedUsd:1290.5,expectedLak:42350000,expectedUsd:1290.5,closedAt:at(dateAdd(today,-1),"18:10"),handedTo:"U-01",approvedBy:"U-01"},
    {id:"SH-L1",station:"LPQ",cashierId:"U-09",date:dateAdd(today,-1),openedAt:at(dateAdd(today,-1),"07:45"),openingLak:2000000,openingUsd:0,status:"closed",countedLak:11240000,countedUsd:0,expectedLak:11390000,expectedUsd:0,closedAt:at(dateAdd(today,-1),"17:30"),note:"ຂາດ 150,000 ກີບ / Short by 150,000 LAK"},
  ];
  const invoices: Db["invoices"]=[]; let iv=1;
  agents.forEach((ag,ai)=>{ const list=awbs.filter(a=>a.agentId===ag&&!a.invoiceId).slice(0,4); if(!list.length)return; const byCur=list.filter(a=>a.currency==="LAK").length>=list.length/2?"LAK":"USD"; const rel=list.filter(a=>a.currency===byCur); if(!rel.length)return; const amount=rel.reduce((s,a)=>s+a.total,0); const issue=dateAdd(today,-(ai===0?5:ai===1?20:48)); const inv={id:`INV-${iv}`,no:`INV26-${String(1000+iv)}`,customerId:ag,station:"VTE",awbIds:rel.map(a=>a.id),lines:rel.map(a=>({description:a.commodity,ref:a.no,amount:a.total,currency:a.currency})),amount,paidAmount:ai===1?amount*.4:0,currency:byCur,issueDate:issue,dueDate:dateAdd(issue,30),status:(ai===1?"partial":"issued") as "partial"|"issued",createdBy:"U-04"}; invoices.push(inv); rel.forEach(a=>a.invoiceId=inv.id); iv++; });

  const audit: Db["audit"]=[
    {id:"AUD-1",ts:at(today,"07:31"),userId:"U-04",station:"VTE",action:"open_shift",entity:"CashShift",entityId:"SH-1",detail:"ເປີດກະ ແຄັດເຊຍ / Opened cashier shift"},
    {id:"AUD-2",ts:at(today,"08:40"),userId:"U-04",station:"VTE",action:"request_rate",entity:"ExchangeRate",entityId:"XR-5",detail:"ຂໍປ່ຽນອັດຕາ USD ເປັນ 22,560 / Requested USD rate 22,560"},
    {id:"AUD-3",ts:at(dateAdd(today,-1),"16:05"),userId:"U-01",station:"VTE",action:"approve_tariff",entity:"Tariff",entityId:"TF-5",detail:"ອະນຸມັດອັດຕາ VTE-BKK / Approved VTE-BKK rate"},
    {id:"AUD-4",ts:at(dateAdd(today,-1),"10:12"),userId:"U-06",station:"VTE",action:"update_user",entity:"User",entityId:"U-08",detail:"ປ່ຽນສະຖານີເປັນ PKZ / Station changed to PKZ"},
  ];
  // The audit trail reflects the cargo events above, so the trail looks like a system in use.
  const AUDIT_OF: Partial<Record<string,[string,string]>>={RCS:["issue_awb","ອອກ AWB ແລະ ຮັບສິນຄ້າ / AWB issued, cargo accepted"],SCR:["screening","ຜ່ານການກວດ X-Ray / Passed X-Ray"],MAN:["plan_load","ເພີ່ມເຂົ້າ Manifest / Added to manifest"],RCF:["receive","ຮັບເຂົ້າສາງ / Received into warehouse"],NFD:["notify_arrival","ແຈ້ງຜູ້ຮັບແລ້ວ / Consignee notified"],DLV:["deliver","ມອບສິນຄ້າແລ້ວ / Cargo delivered"],OFLD:["offload","ອ໋ອບໂຫຼດ / Offloaded"]};
  const cutoff=dateAdd(today,-3);
  awbs.flatMap(a=>a.events.filter(e=>AUDIT_OF[e.code]&&e.ts.slice(0,10)>=cutoff).map(e=>({a,e}))).sort((x,y)=>y.e.ts.localeCompare(x.e.ts)).slice(0,70).forEach(({a,e},i)=>{const[action,detail]=AUDIT_OF[e.code]!;audit.push({id:`AUD-${100+i}`,ts:e.ts,userId:e.userId,station:e.station,action,entity:"AWB",entityId:a.no,detail});});
  audit.sort((x,y)=>y.ts.localeCompare(x.ts));

  // Message drafts ready to review on the FFM/FWB/FHL screen.
  const dm=(iso:string)=>{const dt=new Date(`${iso.slice(0,10)}T00:00:00`);return `${String(dt.getDate()).padStart(2,"0")}${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][dt.getMonth()]}`;};
  const up=(s:string)=>(s.split(" / ")[1]??s).toUpperCase();
  const line=(a:Awb)=>`${a.prefix}-${a.serial}${a.origin}${a.dest}/T${a.pieces}K${a.grossKg}/${up(a.commodity).slice(0,15)}${a.shc.length?`/${a.shc.join("/")}`:""}`;
  const messages:Db["messages"]=[];
  flights.filter(f=>f.date===today&&f.origin==="VTE"&&loads.some(l=>l.flightId===f.id)).slice(0,2).forEach((f,i)=>{const list=loads.filter(l=>l.flightId===f.id).map(l=>awbs.find(a=>a.id===l.awbId)!).filter(Boolean);messages.push({id:`MSG-${i+1}`,type:"FFM",ref:`${f.no} ${f.date}`,flightId:f.id,body:["FFM/8",`1/${f.no}/${dm(f.date)}/${f.origin}`,f.dest,...list.map(line),"LAST"].join("\n"),status:i===0?"draft":"exported",createdAt:at(today,"06:50"),by:"U-02"});});
  awbs.filter(a=>a.direction==="export"&&a.stage==="MAN").slice(0,2).forEach((a,i)=>{const sh=customers.find(c=>c.id===a.shipperId),co=customers.find(c=>c.id===a.consigneeId);messages.push({id:`MSG-${i+11}`,type:"FWB",ref:a.no,awbId:a.id,body:["FWB/17",line(a),`RTG/${a.dest}QV`,"SHP",`/${sh?.nameEn.toUpperCase()}`,"CNE",`/${co?.nameEn.toUpperCase()}`,`CVD/${a.currency}//${a.payMode==="cash"?"PP":"CC"}/NVD/NCV/XXX`].join("\n"),status:"draft",createdAt:at(today,"07:10"),by:"U-02"});});
  if(consol)messages.push({id:"MSG-21",type:"FHL",ref:consol.no,awbId:consol.id,body:["FHL/4",`MBI/${consol.prefix}-${consol.serial}${consol.origin}${consol.dest}/T${consol.pieces}K${consol.grossKg}`,...consol.houses.map(h=>`HBS/${h.hawb}/${consol.origin}${consol.dest}/${h.pieces}/K${h.weightKg}//${h.commodity.toUpperCase()}`)].join("\n"),status:"draft",createdAt:at(today,"07:15"),by:"U-02"});

  return {
    version:DB_VERSION, seededAt:new Date().toISOString(), stations, roles, users, audit, aircraft, routes, flights, currencies, rates, awbStock:stock, tariffs,
    customers, bookings, awbs, loads, zones, mail, irregularities, templates, notifications, messages, receipts, shifts, invoices, exportLogs:[
      {id:"EX-1",ts:at(dateAdd(today,-1),"17:40"),report:"ລາຍງານການຂາຍປະຈໍາວັນ / Daily Sales",format:"Excel",filters:"VTE",rows:42,by:"U-01"},
      {id:"EX-2",ts:at(dateAdd(today,-2),"09:15"),report:"ສິນຄ້າຄ້າງສາງ / Overdue Cargo",format:"PDF",filters:"VTE",rows:3,by:"U-01"},
    ],
    session:{ userId:null, station:"VTE", lang:"lo" }, counters:{},
  };
}
