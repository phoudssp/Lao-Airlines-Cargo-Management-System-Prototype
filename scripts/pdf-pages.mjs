// The walkthrough: one screen per page, grouped by the RFQ's modules.
// role: which demo user signs in. steps: optional actions after the page loads.
const btn = (p, hasText, n = 0) => p.locator("a:visible:not(aside a), button:not(th button):not(aside button):visible").filter({ hasText }).nth(n).click({ timeout: 4000 });
const dlg = (p, name) => p.locator("[role=dialog],dialog").last().getByRole("button", { name }).first().click({ timeout: 4000 });
const scroll = (p, y) => p.evaluate((y) => { const m = document.querySelector("main"); if (m && m.scrollHeight > m.clientHeight) m.scrollTop = y; else window.scrollTo(0, y); }, y);
const PHONE = { width: 390, height: 780 };

async function fillAwb(p) {
  const sel = p.locator("main select");
  await sel.nth(0).selectOption({ index: 2 });
  await sel.nth(1).selectOption({ index: 5 });
  await sel.nth(2).selectOption("BKK");
  await p.waitForTimeout(200);
  await sel.nth(3).selectOption({ index: 1 });
  await p.locator("main input:not([type=number]):not([type=checkbox]):not([disabled])").first().fill("ຜັກສົດ ແລະ ຫມາກໄມ້ / Fresh produce");
  await btn(p, /^PER/);
  const nums = p.locator('main input[type="number"], main input[inputmode]');
  const vals = ["12", "60", "40", "35", "180"];
  for (let i = 0; i < vals.length; i++) await nums.nth(i).fill(vals[i]);
  await p.waitForTimeout(250);
}

export const MODULES = [
  { title: "ພາບລວມຂອງລະບົບ", en: "System overview", pages: [
    { route: "/login", role: null, name: "ໜ້າເຂົ້າສູ່ລະບົບ ຕາມບົດບາດ", ref: "ໂມດູນ 01: Identity & Access Management", caption: "ພະນັກງານແຕ່ລະບົດບາດ ເຫັນເມນູ ແລະ ເຮັດວຽກໄດ້ຕາມສິດທິທີ່ກໍານົດ. ຜູ້ພິຈາລະນາເລືອກບົດບາດໃດກໍ່ໄດ້ ເພື່ອທົດລອງລະບົບ." },
    { route: "/", role: "U-01", name: "Dashboard ຜູ້ບໍລິຫານ", ref: "ໂມດູນ 07: BI Dashboard", caption: "ຜູ້ບໍລິຫານເຫັນລາຍຮັບ, ນໍ້າໜັກ, ການໃຊ້ພື້ນທີ່ສາງ, ສິນຄ້າຕາມສະຖານະ ແລະ ບັນຫາທີ່ຕ້ອງຈັດການ ໃນໜ້າດຽວ." },
  ] },
  { title: "ໂມດູນ 01: ຂໍ້ມູນພື້ນຖານ ແລະ ຕັ້ງຄ່າລະບົບ", en: "Core Master Data & Configuration", pages: [
    { route: "/master/stations", role: "U-06", name: "ສາຂາ ແລະ ສະຖານີ", ref: "Station & Branch Management", caption: "ຈັດການສາຂາ, ສໍານັກງານໜ້າບິນ ແລະ ລະຫັດສະຖານີ IATA 3 ຕົວອັກສອນ ທັງພາຍໃນ ແລະ ຕ່າງປະເທດ." },
    { route: "/master/users", role: "U-06", name: "ຜູ້ໃຊ້ງານ", ref: "Identity & Access Management", caption: "ກໍານົດຜູ້ໃຊ້, ບົດບາດ ແລະ ສະຖານີທີ່ເຮັດວຽກ ຂອງພະນັກງານແຕ່ລະຄົນ." },
    { route: "/master/users", role: "U-06", name: "ບົດບາດ ແລະ ສິດທິ (RBAC)", ref: "Identity & Access Management", caption: "ກໍານົດໄດ້ວ່າ ແຕ່ລະບົດບາດ ເຮັດຫຍັງໄດ້ແດ່ ເຊັ່ນ ການອອກ AWB, ອະນຸມັດອັດຕາ ຫຼື ຮັບເງິນ.", steps: (p) => btn(p, /^ບົດບາດ/) },
    { route: "/master/audit", role: "U-06", name: "ປະຫວັດການເຄື່ອນໄຫວ (Audit Trail)", ref: "Identity & Access Management", caption: "ທຸກການສ້າງ, ແກ້ໄຂ, ລຶບ ແລະ ອະນຸມັດ ຖືກບັນທຶກພ້ອມຜູ້ໃຊ້, ສະຖານີ ແລະ ເວລາ. ບັນທຶກນີ້ແກ້ໄຂບໍ່ໄດ້." },
    { route: "/master/flights", role: "U-06", name: "ຕາຕະລາງຖ້ຽວບິນ", ref: "Flight & Routing Management", caption: "ຕາຕະລາງການບິນ ແລະ ເສັ້ນທາງ ທັງພາຍໃນ ແລະ ຕ່າງປະເທດ ພ້ອມຄວາມຈຸສິນຄ້າທີ່ໃຊ້ແລ້ວ ຂອງແຕ່ລະຖ້ຽວ." },
    { route: "/master/flights", role: "U-06", name: "ຄວາມຈຸຕາມປະເພດເຮືອບິນ", ref: "Flight & Routing Management", caption: "ກໍານົດນໍ້າໜັກ ແລະ ປະລິມາດສິນຄ້າສູງສຸດ ຕາມປະເພດເຮືອບິນ. ລະບົບໃຊ້ຄ່ານີ້ກວດພື້ນທີ່ ຕອນຈອງ ແລະ ຕອນໂຫຼດ.", steps: (p) => btn(p, /^ເຮືອບິນ/) },
    { route: "/master/currency", role: "U-01", name: "ອັດຕາແລກປ່ຽນ", ref: "Currency & Exchange Rate", caption: "ຕັ້ງອັດຕາແລກປ່ຽນຕາມວັນທີ ແລະ ສະກຸນເງິນ, ເພີ່ມສະກຸນເງິນໃໝ່ໄດ້ເອງ. ອັດຕາໃໝ່ຕ້ອງຜ່ານການອະນຸມັດກ່ອນໃຊ້ງານ." },
    { route: "/master/awb-stock", role: "U-06", name: "ຊ່ວງເລກ AWB", ref: "AWB Range Allocation", caption: "ຈັດສັນ ແລະ ຄວບຄຸມຊ່ວງເລກ AWB (Prefix & Serial) ໃຫ້ແຕ່ລະສາຂາ ແລະ ຕົວແທນ ພ້ອມຕິດຕາມເລກທີ່ໃຊ້ໄປ ແລະ ເລກທີ່ຍົກເລີກ." },
    { route: "/master/tariffs", role: "U-01", name: "ອັດຕາຄ່າບໍລິການ", ref: "Tariff & Pricing Engine", caption: "ຄ່າຂົນສົ່ງ General ແລະ Special Cargo, ຄ່າບໍລິການ, ຄ່າຝາກສາງ ແລະ ຄ່າຖົງເມ ພ້ອມແຫຼ່ງອ້າງອີງ, ວັນທີເລີ່ມໃຊ້ ແລະ ຂັ້ນຕອນອະນຸມັດ." },
    { route: "/master/tariffs", role: "U-01", name: "ກວດລາຄາກ່ອນໃຊ້ງານ", ref: "Tariff & Pricing Engine", caption: "ທົດລອງຄິດລາຄາຈາກອັດຕາທີ່ອະນຸມັດແລ້ວ ເພື່ອກວດຜົນກ່ອນນໍາໃຊ້ຈິງ.", steps: async (p) => { await btn(p, /^ກວດລາຄາ/); await p.waitForTimeout(200); await p.locator("[role=dialog] select, dialog select").nth(1).selectOption("BKK"); } },
    { route: "/master/templates", role: "U-06", name: "ແບບຟອມແຈ້ງເຕືອນ", ref: "ເພີ່ມຕາມພາກທີ 4: ແບບຟອມຂໍ້ຄວາມ", caption: "ກໍານົດຂໍ້ຄວາມ WhatsApp ພາສາລາວ ແລະ ອັງກິດ ທີ່ລະບົບໃຊ້ແຈ້ງລູກຄ້າ." },
    { route: "/master/import", role: "U-06", name: "ນໍາເຂົ້າຂໍ້ມູນພື້ນຖານ", ref: "ເພີ່ມຕາມພາກທີ 4: Import ຂໍ້ມູນພື້ນຖານ", caption: "ນໍາສະຖານີ, ລູກຄ້າ, ອັດຕາຄ່າບໍລິການ ແລະ ເລກ AWB ຈາກ Excel ເຂົ້າລະບົບ. ລະບົບກວດທຸກແຖວກ່ອນບັນທຶກ.", steps: (p) => btn(p, /ລອງດ້ວຍໄຟລ໌ຕົວຢ່າງ/) },
  ] },
  { title: "ໂມດູນ 02: ລູກຄ້າ ແລະ ການຈອງພື້ນທີ່", en: "Customer & Booking", pages: [
    { route: "/crm", role: "U-02", name: "ລູກຄ້າ ແລະ ຕົວແທນ", ref: "CRM", caption: "ຂໍ້ມູນລູກຄ້າທົ່ວໄປ, ຕົວແທນ (Cargo Agents) ແລະ ປະເພດລູກຄ້າ ພ້ອມຂໍ້ມູນຕິດຕໍ່ ແລະ ວົງເງິນເຊື່ອ." },
    { route: "/crm/C-101", role: "U-02", name: "ປະຫວັດການບໍລິການຂອງລູກຄ້າ", ref: "CRM", caption: "ເບິ່ງ AWB, ການຈອງ, ໃບເກັບເງິນ ແລະ ການແຈ້ງເຕືອນ ຂອງລູກຄ້າແຕ່ລະລາຍ ໃນໜ້າດຽວ." },
    { route: "/bookings", role: "U-01", name: "ການຈອງພື້ນທີ່", ref: "e-Booking System", caption: "ພະນັກງານເຫັນຄໍາຂໍຈອງຈາກ Portal ແລະ ໜ້າເຄົາເຕີ, ກວດພື້ນທີ່ຖ້ຽວບິນ, ສິນຄ້າພິເສດ ແລະ ສະຖານະອະນຸມັດ." },
    { route: "/bookings", role: "U-01", name: "ຄໍາຂໍຈອງທີ່ຖືກປະຕິເສດ ຫຼື ລໍຖ້າພື້ນທີ່", ref: "e-Booking System", caption: "ສະຖານະ Rejected ຫຼື Waitlisted ສະແດງພ້ອມເຫດຜົນ ແລະ ຜູ້ອະນຸມັດ.", steps: (p) => btn(p, /^ປະຕິເສດ/) },
    { route: "/portal", role: null, name: "Portal ລູກຄ້າ: ຕິດຕາມສິນຄ້າ", ref: "Cargo Tracking Portal", caption: "ລູກຄ້າປ້ອນເລກ AWB ເພື່ອຕິດຕາມສິນຄ້າ ໂດຍບໍ່ຕ້ອງເຂົ້າສູ່ລະບົບ ແລະ ເບິ່ງຖ້ຽວບິນປະຈໍາວັນໄດ້." },
    { route: "/portal", role: null, name: "Portal ລູກຄ້າ: ສະຖານະຂອງ AWB", ref: "Cargo Tracking Portal", caption: "ສະແດງທຸກຂັ້ນຕອນຂອງສິນຄ້າ ຈາກຂໍ້ມູນການສະແກນລ່າສຸດ.", steps: (p) => p.locator("a,button").filter({ hasText: /0394/ }).first().click({ timeout: 4000 }) },
    { route: "/portal/flights", role: null, name: "Portal ລູກຄ້າ: ຖ້ຽວບິນປະຈໍາວັນ", ref: "Cargo Tracking Portal", caption: "ລູກຄ້າກວດຖ້ຽວບິນປະຈໍາວັນຂອງແຕ່ລະສະຖານີ." },
    { route: "/portal/book", role: null, name: "Portal ລູກຄ້າ: ຈອງພື້ນທີ່ລ່ວງໜ້າ", ref: "e-Booking System", caption: "ລູກຄ້າ ຫຼື ຕົວແທນ ເຂົ້າລະບົບດ້ວຍບັນຊີຂອງຕົນ ເພື່ອຈອງພື້ນທີ່ຖ້ຽວບິນລ່ວງໜ້າ. ລະບົບສະແດງພື້ນທີ່ວ່າງຂອງຖ້ຽວບິນທັນທີ.", steps: (p) => p.locator("button").filter({ hasText: /viengkham/ }).first().click({ timeout: 4000 }) },
    { route: "/portal/account", role: null, name: "Portal ລູກຄ້າ: ບັນຊີຂອງຕົວແທນ", ref: "ເພີ່ມຕາມພາກທີ 4: ບັນຊີເຂົ້າລະບົບຂອງລູກຄ້າ", caption: "ລູກຄ້າ ແລະ ຕົວແທນ ເຫັນການຈອງ, AWB ແລະ ຂໍ້ມູນຂອງຕົນເອງເທົ່ານັ້ນ.", steps: async (p) => { const b = p.locator("button").filter({ hasText: /viengkham/ }); if (await b.count()) await b.first().click(); } },
  ] },
  { title: "ໂມດູນ 03: ສິນຄ້າຂາອອກ", en: "Export Operations", pages: [
    { route: "/export/awb/new", role: "U-02", name: "ຮັບເຄື່ອງ ແລະ ອອກ AWB", ref: "Acceptance & Documentation · Weight & Volume Calculation", caption: "ລະບົບຄິດ Chargeable Weight ຈາກນໍ້າໜັກຕົວຈິງ ທຽບກັບບໍລິມາດ (ຍາວ x ກວ້າງ x ສູງ / 6000), ປັດນໍ້າໜັກ, ຄິດຄ່າຂັ້ນຕໍ່າ ແລະ ຄ່າບໍລິການເປັນ % ໃຫ້ອັດຕະໂນມັດ.", steps: fillAwb },
    { route: "/export/awb", role: "U-02", name: "ລາຍການ AWB", ref: "Acceptance & Documentation", caption: "ເບິ່ງ AWB ທັງໝົດຂອງສະຖານີ ພ້ອມສະຖານະ ແຕ່ຮັບເຄື່ອງ ຈົນຮອດມອບສິນຄ້າ." },
    { route: "/export/awb/AWB-44100000", role: "U-02", name: "ລາຍລະອຽດ AWB ແລະ ປະຫວັດສະຖານະ", ref: "ເພີ່ມຕາມພາກທີ 4: ປະຫວັດສະຖານະ AWB", caption: "ທຸກການເຄື່ອນໄຫວຂອງ AWB ຖືກບັນທຶກພ້ອມເວລາ, ສະຖານີ ແລະ ຜູ້ເຮັດ. ຂໍ້ມູນນີ້ສົ່ງຕໍ່ໃຫ້ Portal, ການແຈ້ງເຕືອນ ແລະ ລາຍງານ." },
    { route: "/export/awb/AWB-44100000", role: "U-02", name: "ພິມ AWB ຕາມຮູບແບບສາກົນ", ref: "Acceptance & Documentation", caption: "ພິມໃບ AWB ຈາກຂໍ້ມູນໃນລະບົບ ໂດຍບໍ່ຕ້ອງຂຽນຊໍ້າ.", steps: (p) => btn(p, /^ພິມ AWB/) },
    { route: "/export/awb/AWB-44100000", role: "U-02", name: "ພິມປ້າຍ Cargo Label ພ້ອມ Barcode", ref: "Acceptance & Documentation", caption: "ພິມປ້າຍຕິດສິນຄ້າພ້ອມ Barcode ສໍາລັບສະແກນໃນທຸກຂັ້ນຕອນຕໍ່ໄປ.", steps: (p) => btn(p, /^ພິມປ້າຍ/) },
    { route: "/export/awb/AWB-44100000", role: "U-02", name: "ແກ້ໄຂ ແລະ ຍົກເລີກ AWB", ref: "ເພີ່ມຕາມພາກທີ 4: ການຍົກເລີກ ແລະ ແກ້ໄຂ AWB", caption: "ທຸກການແກ້ໄຂ ແລະ ຍົກເລີກ ຕ້ອງລະບຸເຫດຜົນ, ແລະ ຖືກບັນທຶກເພື່ອກວດສອບຍ້ອນຫຼັງໄດ້.", steps: (p) => btn(p, /^ແກ້ໄຂ/) },
    { route: "/export/screening", role: "U-02", name: "ກວດຄວາມປອດໄພ ແລະ X-Ray", ref: "Security & Screening", caption: "ສິນຄ້າຕ້ອງຜ່ານການກວດກ່ອນເຂົ້າ Manifest. ລະບົບບັນທຶກຜົນ, ຜູ້ກວດ ແລະ ຄ່າ X-Ray.", steps: (p) => btn(p, /^ບັນທຶກຜົນ/) },
    { route: "/export/dispatch", role: "U-02", name: "ຖ້ຽວບິນ ແລະ Manifest", ref: "Flight Dispatch & Manifest", caption: "ເບິ່ງຖ້ຽວບິນຂອງມື້ ພ້ອມນໍ້າໜັກ ທຽບກັບຄວາມຈຸ, ຈໍານວນ AWB ແລະ ສິນຄ້າທີ່ສະແກນແລ້ວ." },
    { route: "/export/dispatch/F-QV101-TODAY", role: "U-02", name: "ສະແກນຂຶ້ນເຮືອບິນ ກັນຜິດສະຖານີ", ref: "Flight Dispatch & Manifest", caption: "ເມື່ອສະແກນສິນຄ້າທີ່ໄປຜິດສະຖານີ, ຍັງບໍ່ຜ່ານ X-Ray ຫຼື AWB ຖືກຍົກເລີກ ລະບົບຈະແຈ້ງເຕືອນ ແລະ ບໍ່ໃຫ້ຂຶ້ນເຮືອບິນ.", steps: (p) => btn(p, /ສິນຄ້າໄປ BKK/) },
    { route: "/export/dispatch/F-QV101-TODAY", role: "U-02", name: "ບັນທຶກສິນຄ້າອ໋ອບໂຫຼດ", ref: "Flight Dispatch & Manifest · ພາກທີ 4: ຈອງຖ້ຽວບິນໃໝ່", caption: "ບັນທຶກສາເຫດ, ແຈ້ງລູກຄ້າ, ແກ້ໄຂ Manifest ແລະ ຈອງຖ້ຽວບິນໃໝ່ໃຫ້ສິນຄ້າ.", steps: (p) => btn(p, /^ອ໋ອບໂຫຼດ/) },
    { route: "/export/dispatch/F-QV101-TODAY", role: "U-02", name: "ພິມ Cargo Manifest", ref: "Flight Dispatch & Manifest", caption: "ພິມ ແລະ ສົ່ງອອກ Cargo Manifest ແລະ Mail Manifest ຂອງແຕ່ລະຖ້ຽວບິນ.", steps: (p) => btn(p, /^ພິມ Cargo Manifest/) },
    { route: "/export/messages", role: "U-02", name: "ຮ່າງຂໍ້ຄວາມ FFM, FWB ແລະ FHL", ref: "Cargo-IMP / IATA Messaging", caption: "ສ້າງຮ່າງຂໍ້ຄວາມຈາກຂໍ້ມູນ MAWB ແລະ HAWB ຕາມ Format ແລະ export ເປັນໄຟລ໌.", steps: async (p) => { await p.locator("main table tbody tr").first().click({ timeout: 3000 }); } },
  ] },
  { title: "ໂມດູນ 04: ການຈັດການສາງສິນຄ້າ", en: "Warehouse Management System", pages: [
    { route: "/wms/inbound", role: "U-03", name: "ຮັບເຄື່ອງເຂົ້າສາງ ພ້ອມກວດສະພາບ", ref: "Inbound & Acceptance", caption: "ສະແກນຮັບເຄື່ອງເຂົ້າສາງ ອີງຕາມ Manifest ພ້ອມກວດສະພາບ (Damage, Wet, Broken) ແລະ ກໍານົດໂຊນເກັບ.", steps: (p) => btn(p, /^ຮັບເຂົ້າສາງ/) },
    { route: "/wms/transfer", role: "U-03", name: "ຖ່າຍລໍາ ແລະ Interline", ref: "Inbound & Acceptance", caption: "ສະແກນຈ່າຍເຄື່ອງຂຶ້ນຍົນ ເພື່ອຕໍ່ຖ້ຽວບິນອື່ນ (Transshipment / Interline)." },
    { route: "/wms/storage", role: "U-03", name: "ໂຊນ ແລະ ຕໍາແໜ່ງໃນສາງ", ref: "Storage & Location Management", caption: "ຈັດແບ່ງໂຊນຕາມປະເພດສິນຄ້າ ເຊັ່ນ ຫ້ອງເຢັນ, ຂອງມີຄ່າ, ສິນຄ້າອັນຕະລາຍ ແລະ ເຕືອນເມື່ອສິນຄ້າຢູ່ຜິດໂຊນ." },
    { route: "/wms/mail", role: "U-03", name: "ຖົງເມ", ref: "Mail Bag Management", caption: "ຮັບ-ຈ່າຍຖົງເມ ທັງພາຍໃນ ແລະ ຕ່າງປະເທດ, ຄິດຄ່າບໍລິການຕາມອັດຕາທີ່ອະນຸມັດ." },
    { route: "/wms/mail", role: "U-03", name: "ໃບຜ່ານສາງຖົງເມ", ref: "Mail Bag Management", caption: "ອອກໃບຜ່ານສາງ (Warehouse Pass) ສໍາລັບຖົງເມແຕ່ລະລາຍການ.", steps: (p) => p.getByRole("button", { name: /ພິມໃບຜ່ານສາງ/ }).first().click({ timeout: 4000 }) },
    { route: "/wms/irregularities", role: "U-03", name: "ເສຍຫາຍ, ສິນຄ້າຂາດ-ເກີນ ແລະ ຜິດປົກກະຕິ", ref: "ເພີ່ມຕາມພາກທີ 4: ບັນທຶກຄວາມເສຍຫາຍ", caption: "ເປີດບັນທຶກ, ກວດສອບ ແລະ ປິດບັນທຶກຄວາມຜິດປົກກະຕິ. ຂໍ້ມູນນີ້ສົ່ງເຂົ້າລາຍງານ Compliance." },
  ] },
  { title: "ໂມດູນ 05: ສິນຄ້າຂາເຂົ້າ", en: "Import Operations", pages: [
    { route: "/import/arrivals", role: "U-05", name: "ແຈ້ງສິນຄ້າມາຮອດຜ່ານ WhatsApp", ref: "Arrival Notice & Pre-alert", caption: "ເລືອກສົ່ງແຈ້ງເຕືອນໃຫ້ຜູ້ຮັບສິນຄ້າ ພ້ອມບັນທຶກສະຖານະ ສົ່ງແລ້ວ ແລະ ອ່ານແລ້ວ." },
    { route: "/import/arrivals", role: "U-05", name: "ລູກຄ້າທີ່ບໍ່ມີ WhatsApp", ref: "Arrival Notice & Pre-alert", caption: "ກໍລະນີບໍ່ມີ WhatsApp ລະບົບຈະສະແດງໝາຍເຫດໃຫ້ພະນັກງານໂທແຈ້ງລູກຄ້າ.", steps: (p) => btn(p, /^ໃຫ້ພະນັກງານໂທ/) },
    { route: "/import/aging", role: "U-05", name: "ສິນຄ້າຄ້າງສາງ", ref: "Arrival Notice & Pre-alert", caption: "ແບ່ງສິນຄ້າຄ້າງສາງຕາມຊ່ວງ 0–30, 31–60, 61–85, 86–90 ແລະ ກາຍ 90 ວັນ ພ້ອມຄ່າຝາກສາງ ແລະ ການແຈ້ງເຕືອນລ່າສຸດ." },
    { route: "/import/customs", role: "U-05", name: "ເຊື່ອມຕໍ່ລະບົບພາສີ", ref: "Customs Interface", caption: "ກວດເອກະສານກັບລະບົບພາສີ ເມື່ອໄດ້ຮັບສິດເຂົ້າເຖິງ API. ລະຫວ່າງນັ້ນ ພະນັກງານບັນທຶກເລກໃບແຈ້ງພາສີໄດ້ເອງ." },
    { route: "/import/delivery", role: "U-05", name: "ມອບສິນຄ້າ ແລະ ຄິດຄ່າຝາກສາງ", ref: "Delivery & Pickup · ໂມດູນ 04: Delivery", caption: "ກວດເອກະສານ ແລະ ຄິດຄ່າຝາກສາງອັດຕະໂນມັດຕາມໄລຍະເວລາ. ຮັບພາຍໃນມື້ບໍ່ເສຍຄ່າຝາກສາງ. ຜູ້ມາຮັບເຊັນ ແລະ ໃສ່ຊື່ກັບເບີໂທໃນໃບລາຍການ.", steps: async (p) => { await p.locator("main table tbody tr").nth(3).click({ timeout: 3000 }).catch(() => {}); } },
  ] },
  { title: "ໂມດູນ 06: ການເງິນ ແລະ ການບັນຊີ", en: "Financial & Cashier", pages: [
    { route: "/finance/cashier", role: "U-04", name: "ແຄັດເຊຍ POS", ref: "Cashier & POS", caption: "ຮັບເງິນສົດ ແລະ ເງິນໂອນ ເປັນ LAK, USD ຫຼື ສະກຸນເງິນອື່ນ ໂດຍໃຊ້ອັດຕາແລກປ່ຽນທີ່ອະນຸມັດແລ້ວ.", steps: async (p) => { await p.locator('main table tbody input[type="checkbox"]').first().check({ timeout: 3000 }); } },
    { route: "/finance/receipts", role: "U-04", name: "ໃບຮັບເງິນ", ref: "Cashier & POS", caption: "ໃບຮັບເງິນທຸກໃບ ບັນທຶກຜູ້ຮັບເງິນ, ຜູ້ແກ້ໄຂ ແລະ ຜູ້ອະນຸມັດ." },
    { route: "/finance/receipts", role: "U-04", name: "ພິມໃບຮັບເງິນ", ref: "Cashier & POS · ພາກທີ 4: ຍົກເລີກໃບຮັບເງິນ ແລະ ຄືນເງິນ", caption: "ພິມໃບຮັບເງິນ USD/LAK. ການຍົກເລີກ ແລະ ການຄືນເງິນ ຕ້ອງຜ່ານຜູ້ອະນຸມັດ.", steps: async (p) => { await p.locator("main table tbody tr").first().click({ timeout: 3000 }); } },
    { route: "/finance/cash", role: "U-04", name: "ຄັງເງິນປະຈໍາວັນ", ref: "Cash Management & Reconciliation", caption: "ຕິດຕາມຍອດເງິນສົດ ແລະ ເງິນໂອນຂອງກະ, ແຍກຕາມສາຂາ ພາຍໃນ ແລະ ຕ່າງປະເທດ." },
    { route: "/finance/cash", role: "U-04", name: "ນັບເງິນ, ມອບເງິນ ແລະ ປິດຍອດ", ref: "Cash Management & Reconciliation", caption: "ນັບເງິນທີ່ມີຈິງ ທຽບກັບລະບົບ ແລະ ເຮັດການມອບເງິນ (Cash Handover) ໃຫ້ຜູ້ຈັດການ.", steps: (p) => btn(p, /ນັບເງິນ ແລະ ປິດກະ/) },
    { route: "/finance/invoices", role: "U-04", name: "ໃບເກັບເງິນ ລູກຄ້າຕິດໜີ້", ref: "Billing & Invoicing · ພາກທີ 4: ວົງເງິນເຊື່ອ ແລະ ໜີ້ຄ້າງ", caption: "ອອກໃບເກັບເງິນໃຫ້ລູກຄ້າ Credit Account, ຕິດຕາມວົງເງິນເຊື່ອ, ໜີ້ຄ້າງ ແລະ ໃບທີ່ກາຍກໍານົດ." },
  ] },
  { title: "ໂມດູນ 07: ລາຍງານ ແລະ ສະຖິຕິ", en: "Reporting & Analytics", pages: [
    { route: "/reports", role: "U-01", viewport: { width: 1700, height: 1015 }, name: "ລາຍງານການຂາຍ", ref: "Sales & Revenue Reports", caption: "ລາຍງານການຂາຍປະຈໍາວັນ ແລະ ສັງລວມ ແຍກຕາມ AWB, ຄ່າຜ່ານສາງ ແລະ ລາຍຮັບອື່ນໆ. Filter ຕາມວັນທີ, ສາຂາ ແລະ Route. Export ເປັນ Excel ຫຼື PDF." },
    { route: "/reports", role: "U-01", viewport: { width: 1700, height: 1015 }, name: "ລາຍຮັບພາຍໃນ ແລະ ຕ່າງປະເທດ", ref: "Sales & Revenue Reports", caption: "ສະຫຼຸບລາຍຮັບ ແຍກສາຍພາຍໃນ ແລະ ສາຍຕ່າງປະເທດ.", steps: (p) => btn(p, /^ສະຫຼຸບລາຍຮັບ/) },
    { route: "/reports", role: "U-01", viewport: { width: 1700, height: 1015 }, name: "ປຽບທຽບລາຍເດືອນ ແລະ ລາຍປີ", ref: "ທຸກລາຍງານ", caption: "ປຽບທຽບຜົນລາຍເດືອນ ແລະ ລາຍປີ.", steps: (p) => btn(p, /^ປຽບທຽບລາຍເດືອນ/) },
    { route: "/reports", role: "U-01", viewport: { width: 1700, height: 1015 }, name: "ລາຍງານການຂົນສົ່ງ", ref: "Operational Reports", caption: "ລາຍງານການຂົນສົ່ງ, ຄ່າ X-Ray ແລະ ພະນັກງານຜູ້ອອກບິນ.", steps: (p) => btn(p, /^ລາຍງານການຂົນສົ່ງ/) },
    { route: "/reports", role: "U-01", viewport: { width: 1700, height: 1015 }, name: "ລາຍງານສາງ ຂາອອກ-ຂາເຂົ້າ", ref: "Operational Reports", caption: "ລາຍງານສາງຂາອອກ-ຂາເຂົ້າ ຕາມ Manifest ແລະ ຂໍ້ມູນຜູ້ຮັບ.", steps: (p) => btn(p, /^ສາງ ຂາອອກ/) },
    { route: "/reports", role: "U-01", viewport: { width: 1700, height: 1015 }, name: "ຖົງເມ ແລະ ລາຍຮັບ", ref: "Operational Reports", caption: "ລາຍງານຖົງເມ ພ້ອມສະຫຼຸບລາຍຮັບ.", steps: (p) => btn(p, /^ຖົງເມ ແລະ ລາຍຮັບ/) },
    { route: "/reports", role: "U-01", viewport: { width: 1700, height: 1015 }, name: "ສິນຄ້າຄ້າງສາງກາຍ 90 ວັນ", ref: "Compliance & Audit Reports", caption: "ລາຍງານ Overdue ແລະ Unclaimed Cargo.", steps: (p) => btn(p, /^ສິນຄ້າຄ້າງສາງ/) },
    { route: "/reports", role: "U-01", viewport: { width: 1700, height: 1015 }, name: "ສິນຄ້າເສຍຫາຍ ແລະ ສູນຫາຍ", ref: "Compliance & Audit Reports", caption: "ລາຍງານສິນຄ້າເສຍຫາຍ, ສູນຫາຍ ແລະ ລາຍການຜິດປົກກະຕິ.", steps: (p) => btn(p, /^ສິນຄ້າເສຍຫາຍ/) },
    { route: "/reports", role: "U-01", viewport: { width: 1700, height: 1015 }, name: "ປະຫວັດການ Export", ref: "ທຸກລາຍງານ", caption: "ລະບົບບັນທຶກທຸກການ Export ວ່າ ໃຜ, ເມື່ອໃດ ແລະ ໃຊ້ Filter ແນວໃດ.", steps: (p) => btn(p, /^ປະຫວັດການສົ່ງອອກ/) },
    { route: "/", role: "U-01", name: "BI Dashboard ຕາມສະຖານີ ແລະ ຖ້ຽວບິນ", ref: "BI Dashboard", caption: "ສະຖິຕິພາບລວມ, ປະລິມານນໍ້າໜັກ ແລະ ປະສິດທິພາບຂອງສາງ ສະແດງຕາມ Station, Flight ແລະ Cargo Status.", steps: (p) => scroll(p, 620) },
  ] },
  { title: "ແອັບສະແກນ Android", en: "Added under section 4 of the proposal", pages: [
    { route: "/scanner", role: "U-03", phone: true, viewport: PHONE, name: "ໜ້າຫຼັກແອັບສະແກນ", ref: "ເພີ່ມຕາມພາກທີ 4: ແອັບສະແກນ Android", caption: "ພະນັກງານສາງ ເຮັດວຽກຮັບເຂົ້າສາງ, ໂຫຼດຂຶ້ນຖ້ຽວບິນ, ມອບສິນຄ້າ ແລະ ຍ້າຍໂຊນ ຈາກເຄື່ອງ Handheld." },
    { route: "/scanner", role: "U-03", phone: true, viewport: PHONE, name: "ສະແກນຮັບເຂົ້າສາງ", ref: "ໂມດູນ 04: Inbound & Acceptance", caption: "ສະແກນ Barcode ແລ້ວເລືອກສະພາບສິນຄ້າ ແລະ ໂຊນໄດ້ທັນທີ.", steps: (p) => btn(p, /^ຮັບເຂົ້າສາງ/) },
    { route: "/scanner", role: "U-03", phone: true, viewport: PHONE, name: "ສະແກນຂຶ້ນເຮືອບິນ", ref: "ໂມດູນ 03: Flight Dispatch & Manifest", caption: "ເລືອກຖ້ຽວບິນແລ້ວສະແກນ. ລະບົບແຈ້ງເຕືອນທັນທີ ເມື່ອສິນຄ້າໄປຜິດສະຖານີ.", steps: (p) => btn(p, /^ໂຫຼດຂຶ້ນຖ້ຽວບິນ/) },
    { route: "/scanner", role: "U-03", phone: true, viewport: PHONE, name: "ພັກຂໍ້ມູນຊົ່ວຄາວ ເມື່ອສັນຍານຂາດ", ref: "ເພີ່ມຕາມພາກທີ 4: ແອັບສະແກນ Android", caption: "ເມື່ອສັນຍານຂາດ ແອັບບັນທຶກການສະແກນໄວ້ໃນເຄື່ອງ ແລະ ສົ່ງເຂົ້າລະບົບເມື່ອສັນຍານກັບມາ.", steps: async (p) => { await btn(p, /ອອນລາຍ/); await btn(p, /^ຮັບເຂົ້າສາງ/); await p.waitForTimeout(300); await btn(p, /627-4410/); await p.waitForTimeout(300); await btn(p, /^ປົກກະຕິ/); await btn(p, /^B1$/); await btn(p, /^ຢືນຢັນຮັບເຂົ້າສາງ/); await p.waitForTimeout(400); } },
  ] },
];
