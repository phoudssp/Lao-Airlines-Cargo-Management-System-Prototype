import { lazy, Suspense, useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./shell/Shell";
import Login from "./pages/Login";

// Every screen is loaded ahead of time once the app is idle, so moving between screens is instant.
const loaders: (() => Promise<unknown>)[] = [];
const L = (f: () => Promise<{ default: React.ComponentType }>) => { loaders.push(f); const C = lazy(f); return <C />; };
function preloadScreens() { const run = (i: number) => { if (i >= loaders.length) return; loaders[i]().catch(() => {}).finally(() => setTimeout(() => run(i + 1), 0)); }; run(0); }
export function App() {
  useEffect(() => { const id = setTimeout(preloadScreens, 300); return () => clearTimeout(id); }, []);
  // v7_startTransition keeps the current screen visible until the next one is ready.
  return <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Suspense fallback={<div className="p-8 text-ink-2">…</div>}><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/portal/*" element={L(() => import("./pages/portal/Portal"))} />
    <Route path="/scanner/*" element={L(() => import("./pages/scanner/Scanner"))} />
    <Route element={<Shell />}>
      <Route path="/" element={L(() => import("./pages/reports/Dashboard"))} />
      <Route path="/crm" element={L(() => import("./pages/crm/Customers"))} />
      <Route path="/crm/:id" element={L(() => import("./pages/crm/CustomerDetail"))} />
      <Route path="/bookings" element={L(() => import("./pages/crm/Bookings"))} />
      <Route path="/export/awb" element={L(() => import("./pages/export/AwbList"))} />
      <Route path="/export/awb/new" element={L(() => import("./pages/export/AwbNew"))} />
      <Route path="/export/awb/:id" element={L(() => import("./pages/export/AwbDetail"))} />
      <Route path="/export/screening" element={L(() => import("./pages/export/Screening"))} />
      <Route path="/export/dispatch" element={L(() => import("./pages/export/Dispatch"))} />
      <Route path="/export/dispatch/:id" element={L(() => import("./pages/export/FlightDetail"))} />
      <Route path="/export/messages" element={L(() => import("./pages/export/Messages"))} />
      <Route path="/wms/inbound" element={L(() => import("./pages/wms/Inbound"))} />
      <Route path="/wms/storage" element={L(() => import("./pages/wms/Storage"))} />
      <Route path="/wms/transfer" element={L(() => import("./pages/wms/Transfer"))} />
      <Route path="/wms/mail" element={L(() => import("./pages/wms/MailBags"))} />
      <Route path="/wms/irregularities" element={L(() => import("./pages/wms/Irregularities"))} />
      <Route path="/import/arrivals" element={L(() => import("./pages/import/Arrivals"))} />
      <Route path="/import/aging" element={L(() => import("./pages/import/Aging"))} />
      <Route path="/import/customs" element={L(() => import("./pages/import/Customs"))} />
      <Route path="/import/delivery" element={L(() => import("./pages/import/Delivery"))} />
      <Route path="/finance/cashier" element={L(() => import("./pages/finance/Cashier"))} />
      <Route path="/finance/receipts" element={L(() => import("./pages/finance/Receipts"))} />
      <Route path="/finance/cash" element={L(() => import("./pages/finance/CashClose"))} />
      <Route path="/finance/invoices" element={L(() => import("./pages/finance/Invoices"))} />
      <Route path="/reports" element={L(() => import("./pages/reports/Reports"))} />
      <Route path="/master/stations" element={L(() => import("./pages/master/Stations"))} />
      <Route path="/master/flights" element={L(() => import("./pages/master/Flights"))} />
      <Route path="/master/currency" element={L(() => import("./pages/master/Currency"))} />
      <Route path="/master/awb-stock" element={L(() => import("./pages/master/AwbStock"))} />
      <Route path="/master/tariffs" element={L(() => import("./pages/master/Tariffs"))} />
      <Route path="/master/users" element={L(() => import("./pages/master/Users"))} />
      <Route path="/master/templates" element={L(() => import("./pages/master/Templates"))} />
      <Route path="/master/import" element={L(() => import("./pages/master/DataImport"))} />
      <Route path="/master/audit" element={L(() => import("./pages/master/Audit"))} />
    </Route>
  </Routes></Suspense></HashRouter>;
}
