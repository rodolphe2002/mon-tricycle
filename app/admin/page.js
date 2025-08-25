"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "../components/ToastProvider";
import { useRouter } from "next/navigation";

const TABS = [
  "KYC",
  "Conducteurs",
  "Clients",
  "Trajets",
  "Paiements",
  "Litiges",
  "Tarification",
  "Promotions",
  "Rapports",
];

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState("KYC");

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-amber-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-orange-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5 12a7 7 0 0 1 14 0v6a2 2 0 0 1-2 2h-3a1 1 0 0 1-1-1v-3H11v3a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-6Z"/></svg>
            <span className="font-bold text-slate-800">Admin</span>
          </div>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem('tri_token_admin');
                localStorage.removeItem('tri_user_admin');
              } catch {}
              router.replace('/admin-login');
            }}
            className="text-sm text-orange-700 hover:underline"
          >
            Déconnexion
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-full text-sm border ${tab === t ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-700 border-slate-200'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "KYC" && <KYCTab />}
        {tab === "Conducteurs" && <DriversTab />}
        {tab === "Clients" && <ClientsTab />}
        {tab === "Trajets" && <TripsTab />}
        {tab === "Paiements" && <PaymentsTab />}
        {tab === "Litiges" && <DisputesTab />}
        {tab === "Tarification" && <PricingTab />}
        {tab === "Promotions" && <PromosTab />}
        {tab === "Rapports" && <ReportsTab />}
      </div>

      <div className="h-8" />
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
      {children}
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Table({ columns, rows, empty = "Aucune donnée" }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="px-3 py-6 text-slate-400" colSpan={columns.length}>{empty}</td></tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                {r.map((cell, j) => (
                  <td key={j} className="px-3 py-2 align-middle">{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function KYCTab() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null); // {id, name, phone, plate, status, vehiclePhotoUrl, idPhotoUrl, selfieUrl}

  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
  const abs = (p) => (p && typeof p === 'string' ? (p.startsWith('http') ? p : `${base}${p}`) : '');

  const fetchPending = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/kyc/admin/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Chargement des KYC impossible');
      const data = await res.json();
      const rows = (data.drivers || []).map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        plate: u.plate,
        status: u.kycStatus,
        vehiclePhotoUrl: abs(u.vehiclePhotoUrl),
        idPhotoUrl: abs(u.idPhotoUrl),
        selfieUrl: abs(u.selfieUrl),
        createdAt: u.createdAt,
      }));
      setItems(rows);
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id) => {
    try {
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/kyc/admin/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Échec de la validation');
      setItems((l) => l.map((x) => x.id === id ? { ...x, status: 'approved' } : x));
      toast.success('KYC validé');
    } catch (e) {
      toast.error(e.message || 'Erreur lors de la validation');
    }
  };

  const reject = async (id) => {
    try {
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/kyc/admin/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Échec du rejet');
      setItems((l) => l.map((x) => x.id === id ? { ...x, status: 'rejected' } : x));
      toast.info('KYC rejeté');
    } catch (e) {
      toast.error(e.message || 'Erreur lors du rejet');
    }
  };

  // Charger à l'ouverture
  useEffect(() => { fetchPending(); }, []);

  const rows = items.map((x) => ([
    <button key="n" type="button" className="text-orange-700 hover:underline" onClick={() => setSelected(x)}>{x.name}</button>,
    x.phone,
    x.plate,
    <span key="s" className={`px-2 py-0.5 rounded-full text-xs ${x.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : x.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{x.status}</span>,
    <div key="a" className="flex gap-2">
      <button type="button" onClick={() => approve(x.id)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg px-2 py-1">Valider</button>
      <button type="button" onClick={() => reject(x.id)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg px-2 py-1">Rejeter</button>
    </div>
  ]));

  return (
    <Section
      title="KYC (validation des pièces)"
      right={
        <div className="flex items-center gap-2">
          <button type="button" onClick={fetchPending} className="text-xs text-orange-700 hover:underline">Rafraîchir</button>
        </div>
      }
    >
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Chargement...</div>
      ) : (
        <Table columns={["Nom", "Téléphone", "Immatriculation", "Statut", "Actions"]} rows={rows} empty="Aucun KYC en attente" />
      )}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-800">Détails KYC</div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-700">Fermer</button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="col-span-3 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Nom</div>
                  <div className="font-medium text-slate-800">{selected.name}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Téléphone</div>
                  <div className="font-medium text-slate-800">{selected.phone}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Immatriculation</div>
                  <div className="font-medium text-slate-800">{selected.plate}</div>
                </div>
              </div>
              <div className="col-span-3 grid grid-cols-3 gap-3 mt-2">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Véhicule</div>
                  <img src={selected.vehiclePhotoUrl} alt="Véhicule" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Pièce d'identité</div>
                  <img src={selected.idPhotoUrl} alt="Pièce d'identité" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Selfie</div>
                  <img src={selected.selfieUrl} alt="Selfie" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => { approve(selected.id); setSelected(null); }} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg px-3 py-2 text-sm">Valider</button>
              <button type="button" onClick={() => { reject(selected.id); setSelected(null); }} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-2 text-sm">Rejeter</button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function DriversTab() {
  const router = useRouter();
  const toast = useToast();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/drivers/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Chargement des conducteurs impossible');
      const data = await res.json();
      const rows = (data.drivers || []).map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        rating: typeof d.rating === 'number' ? d.rating : null,
        status: d.driverStatus, // 'active' | 'suspended' | 'banned'
      }));
      setDrivers(rows);
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (id) => {
    try {
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/drivers/admin/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Échec du basculement');
      const data = await res.json();
      setDrivers((l) => l.map((d) => d.id === id ? { ...d, status: data.driverStatus } : d));
      toast.success('Statut conducteur mis à jour');
    } catch (e) {
      toast.error(e.message || 'Erreur');
    }
  };

  const ban = async (id) => {
    try {
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/drivers/admin/${id}/ban`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Échec du bannissement');
      const data = await res.json();
      setDrivers((l) => l.map((d) => d.id === id ? { ...d, status: data.driverStatus } : d));
      toast.warning('Conducteur banni');
    } catch (e) {
      toast.error(e.message || 'Erreur');
    }
  };

  useEffect(() => { fetchDrivers(); }, []);

  const rows = drivers.map((d) => ([
    d.name,
    d.phone,
    d.rating ? `★ ${d.rating.toFixed(1)}` : '—',
    <span key="s" className={`px-2 py-0.5 rounded-full text-xs ${d.status === 'active' ? 'bg-emerald-50 text-emerald-700' : d.status === 'suspended' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{d.status}</span>,
    <div key="a" className="flex gap-2">
      <button type="button" onClick={() => toggle(d.id)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-2 py-1">Basculer</button>
      <button type="button" onClick={() => ban(d.id)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg px-2 py-1">Bannir</button>
    </div>
  ]));

  return (
    <Section
      title="Gestion des conducteurs"
      right={<button type="button" onClick={fetchDrivers} className="text-xs text-orange-700 hover:underline">Rafraîchir</button>}
    >
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Chargement...</div>
      ) : (
        <Table columns={["Nom", "Téléphone", "Note", "Statut", "Actions"]} rows={rows} empty="Aucun conducteur" />
      )}
    </Section>
  );
}

function ClientsTab() {
  const router = useRouter();
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/clients/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Chargement des clients impossible');
      const data = await res.json();
      const rows = (data.clients || []).map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        status: c.clientStatus || 'active',
      }));
      setClients(rows);
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (id) => {
    try {
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/clients/admin/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error("Échec du basculement");
      const data = await res.json();
      setClients((l) => l.map((c) => c.id === id ? { ...c, status: data.clientStatus } : c));
      toast.success('Statut client mis à jour');
    } catch (e) {
      toast.error(e.message || 'Erreur');
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const rows = clients.map((c) => {
    const isActive = c.status === 'active';
    return [
      c.name,
      c.phone,
      <span key="s" className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{isActive ? 'actif' : 'suspendu'}</span>,
      <div key="a" className="flex gap-2">
        <button type="button" onClick={() => toggle(c.id)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-2 py-1">Basculer</button>
      </div>
    ];
  });

  return (
    <Section
      title="Gestion des clients"
      right={<button type="button" onClick={fetchClients} className="text-xs text-orange-700 hover:underline">Rafraîchir</button>}
    >
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Chargement...</div>
      ) : (
        <Table columns={["Nom", "Téléphone", "Statut", "Actions"]} rows={rows} empty="Aucun client" />
      )}
    </Section>
  );
}

function TripsTab() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  const km = (a, b) => {
    if (!a || !b || typeof a.lat !== 'number' || typeof a.lon !== 'number' || typeof b.lat !== 'number' || typeof b.lon !== 'number') return null;
    const R = 6371; // km
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const sinDLat = Math.sin(dLat/2);
    const sinDLon = Math.sin(dLon/2);
    const c = 2 * Math.asin(Math.sqrt(sinDLat*sinDLat + Math.cos(lat1)*Math.cos(lat2)*sinDLon*sinDLon));
    return R * c;
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/orders/admin/list?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Chargement des trajets impossible');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const rows = (orders || []).map((o) => {
    const d = km(o.start, o.destination);
    const distStr = typeof d === 'number' ? `${d.toFixed(1)} km` : '—';
    // Estimation simple: 20 km/h moyenne -> minutes
    const mins = typeof d === 'number' ? Math.round((d / 20) * 60) : null;
    const durStr = typeof mins === 'number' ? `${mins} min` : '—';
    const priceStr = typeof o.priceEstimate === 'number' ? `${o.priceEstimate} CFA` : '—';
    const statusMap = { pending: 'En attente', assigned: 'Assigné', in_progress: 'En cours', completed: 'Terminé', cancelled: 'Annulé' };
    const idShort = o.id ? `#${String(o.id).slice(-4)}` : '#—';
    const from = o.start?.name || '—';
    const to = o.destination?.name || '—';
    const client = o.client?.name ? `${o.client.name}` : '—';
    const driver = o.driver?.name ? `${o.driver.name}` : '—';
    return [
      idShort,
      from,
      to,
      distStr,
      durStr,
      priceStr,
      statusMap[o.status] || o.status,
      client,
      driver,
    ];
  });

  return (
    <Section
      title="Tableau des trajets"
      right={<button type="button" onClick={fetchOrders} className="text-xs text-orange-700 hover:underline">Rafraîchir</button>}
    >
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Chargement...</div>
      ) : (
        <Table columns={["ID", "Départ", "Destination", "Distance", "Durée", "Prix", "Statut", "Client", "Conducteur"]} rows={rows} empty="Aucun trajet" />
      )}
    </Section>
  );
}

function PaymentsTab() {
  const router = useRouter();
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/orders/admin/payments?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Chargement des paiements impossible');
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, []);

  const rows = (payments || []).map((p) => {
    const pid = p.paymentId ? `#${p.paymentId}`.replace('#P-', '#P-') : '#—';
    const oidShort = p.orderId ? `#${String(p.orderId).slice(-4)}` : '#—';
    const method = p.method ? p.method : '—';
    const amount = typeof p.amount === 'number' ? `${p.amount} CFA` : '—';
    const statusMap = { success: 'Succès', refunded: 'Remboursé', pending: 'En attente' };
    return [pid, oidShort, method, amount, statusMap[p.status] || p.status];
  });

  return (
    <Section
      title="Paiements"
      right={<button type="button" onClick={fetchPayments} className="text-xs text-orange-700 hover:underline">Rafraîchir</button>}
    >
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Chargement...</div>
      ) : (
        <Table columns={["ID Paiement", "ID Trajet", "Moyen", "Montant", "Statut"]} rows={rows} empty="Aucun paiement" />
      )}
    </Section>
  );
}

function DisputesTab() {
  const [rows] = useState([
    ["#D-21", "#1244", "Annulation tardive", "Frais appliqués", "Ouvert"],
  ]);
  return (
    <Section title="Litiges & Annulations">
      <Table columns={["ID Litige", "Trajet", "Motif", "Action", "Statut"]} rows={rows} />
    </Section>
  );
}

function PricingTab() {
  const router = useRouter();
  const toast = useToast();
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
  const [form, setForm] = useState({ base: 300, perKm: 150, perMin: 40, peak: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'peak' ? e.target.checked : Number(e.target.value) }));

  const loadPricing = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/pricing/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Chargement de la tarification impossible');
      const data = await res.json();
      setForm({ base: data.base ?? 300, perKm: data.perKm ?? 150, perMin: data.perMin ?? 40, peak: !!data.peakEnabled });
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const savePricing = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('tri_token_admin');
      const body = {
        base: Number(form.base),
        perKm: Number(form.perKm),
        perMin: Number(form.perMin),
        peakEnabled: !!form.peak,
        // peakMultiplier fixed to 1.5 per spec
        peakMultiplier: 1.5,
      };
      const res = await fetch(`${base}/api/pricing/admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Enregistrement échoué');
      toast.success('Tarification enregistrée');
    } catch (e) {
      toast.error(e.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { loadPricing(); }, []);

  return (
    <Section title="Tarification" right={<button type="button" onClick={loadPricing} className="text-xs text-orange-700 hover:underline">Rafraîchir</button>}>
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Chargement...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Frais de base</div>
              <input type="number" value={form.base} onChange={update('base')} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Prix / km</div>
              <input type="number" value={form.perKm} onChange={update('perKm')} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Prix / min</div>
              <input type="number" value={form.perMin} onChange={update('perMin')} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 mt-6">
              <input type="checkbox" checked={form.peak} onChange={update('peak')} />
              <span>Heures de pointe (x1.5)</span>
            </label>
          </div>
          <div className="mt-3 text-right">
            <button type="button" onClick={savePricing} disabled={saving} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl px-4 py-2 text-sm">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </>
      )}
    </Section>
  );
}

function PromosTab() {
  const router = useRouter();
  const toast = useToast();
  const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
  const [promos, setPromos] = useState([]); // {id, code, type, value, active}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ code: '', type: 'percent', value: 10 });
  const [apply, setApply] = useState({ open: false, code: '', orderId: '' });

  const fetchPromos = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/promos/admin/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Chargement des promos impossible');
      const data = await res.json();
      setPromos(data.promos || []);
    } catch (e) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPromos(); }, []);

  const createPromo = async () => {
    try {
      const token = localStorage.getItem('tri_token_admin');
      const body = { code: form.code.trim().toUpperCase(), type: form.type, value: Number(form.value) };
      const res = await fetch(`${base}/api/promos/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error((await res.json()).error || 'Création échouée');
      setForm({ code: '', type: 'percent', value: 10 });
      fetchPromos();
      toast.success('Code promo créé');
    } catch (e) {
      toast.error(e.message || 'Erreur');
    }
  };

  const toggle = async (id) => {
    try {
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/promos/admin/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Échec du basculement');
      const data = await res.json();
      setPromos((l) => l.map((p) => p.id === id ? { ...p, active: data.active } : p));
      toast.info('Statut du code mis à jour');
    } catch (e) {
      toast.error(e.message || 'Erreur');
    }
  };

  const remove = async (id) => {
    try {
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/promos/admin/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      if (!res.ok) throw new Error('Échec de la suppression');
      setPromos((l) => l.filter((p) => p.id !== id));
      toast.warning('Code promo supprimé');
    } catch (e) {
      toast.error(e.message || 'Erreur');
    }
  };

  const applyToOrder = (code) => {
    setApply({ open: true, code, orderId: '' });
  };

  const confirmApply = async () => {
    const orderId = apply.orderId.trim();
    if (!orderId) { toast.error('Veuillez saisir un ID de commande'); return; }
    try {
      const token = localStorage.getItem('tri_token_admin');
      const res = await fetch(`${base}/api/orders/admin/${orderId}/apply-promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: apply.code }),
      });
      if (res.status === 401) { try { localStorage.removeItem('tri_token_admin'); localStorage.removeItem('tri_user_admin'); } catch {} router.replace('/admin-login'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Application échouée');
      toast.success(`Promo appliquée. Avant: ${data.amountBefore} CFA, réduction: ${data.discount} CFA, après: ${data.amountAfter} CFA`);
      setApply({ open: false, code: '', orderId: '' });
    } catch (e) {
      toast.error(e.message || 'Erreur');
    }
  };

  // Construire les lignes du tableau des promos
  const rows = (promos || []).map((p) => [
    p.code,
    p.type === 'amount' ? `${p.value} CFA` : `${p.value}%`,
    <span key="s" className={`px-2 py-0.5 rounded-full text-xs ${p.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
      {p.active ? 'Actif' : 'Inactif'}
    </span>,
    <div key="a" className="flex gap-2">
      <button className="text-xs text-orange-700 hover:underline" onClick={() => toggle(p.id)}>Basculer</button>
      <button className="text-xs text-red-700 hover:underline" onClick={() => remove(p.id)}>Supprimer</button>
      <button className="text-xs text-slate-700 hover:underline" onClick={() => applyToOrder(p.code)}>Appliquer à une commande</button>
    </div>
  ]);

  const [bans] = useState([
    { id: 1, subject: "#DRV-274", reason: "Fraude" },
  ]);

  return (
    <Section
      title="Promotions & Sanctions"
      right={<button type="button" onClick={fetchPromos} className="text-xs text-orange-700 hover:underline">Rafraîchir</button>}
    >
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium text-slate-700 mb-1">Codes promo</div>
          <div className="flex items-end gap-2 text-sm mb-2">
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Code</div>
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="border border-slate-200 rounded-lg px-2 py-1" placeholder="TRI2025" />
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Type</div>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="border border-slate-200 rounded-lg px-2 py-1">
                <option value="percent">%</option>
                <option value="amount">Montant (CFA)</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs text-slate-500 mb-1">Valeur</div>
              <input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className="border border-slate-200 rounded-lg px-2 py-1 w-24" />
            </label>
            <button type="button" onClick={createPromo} className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl px-3 py-1.5">Ajouter</button>
          </div>
          {loading ? (
            <div className="text-sm text-slate-500">Chargement...</div>
          ) : (
            <Table columns={["Code", "Valeur", "Statut", "Actions"]} rows={rows} empty="Aucun code" />
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-slate-700 mb-1">Sanctions</div>
          <Table columns={["Sujet", "Motif"]} rows={bans.map((b) => [b.subject, b.reason])} />
        </div>
      </div>

      {apply.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setApply({ open: false, code: '', orderId: '' })} />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-800">Appliquer le code {apply.code}</div>
              <button type="button" onClick={() => setApply({ open: false, code: '', orderId: '' })} className="text-slate-500 hover:text-slate-700">Fermer</button>
            </div>
            <div className="text-sm">
              <label className="block">
                <div className="text-xs text-slate-500 mb-1">ID de la commande (ObjectId)</div>
                <input value={apply.orderId} onChange={(e) => setApply((a) => ({ ...a, orderId: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2" placeholder="6650f0..." />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setApply({ open: false, code: '', orderId: '' })} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-2 text-sm">Annuler</button>
              <button type="button" onClick={confirmApply} className="bg-orange-600 hover:bg-orange-700 text-white rounded-lg px-3 py-2 text-sm">Appliquer</button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function ReportsTab() {
  // Demos statiques
  const [metrics] = useState({ conversion: 32, retention30: 21 });
  return (
    <Section title="Rapports & Insights">
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <div className="text-xs text-slate-500">Conversion</div>
          <div className="text-xl font-semibold text-slate-800">{metrics.conversion}%</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Rétention 30j</div>
          <div className="text-xl font-semibold text-slate-800">{metrics.retention30}%</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500">Heatmap de la demande</div>
          <div className="text-slate-500 text-xs">(placeholder)</div>
          <div className="mt-2 h-24 bg-gradient-to-tr from-amber-200 via-orange-300 to-red-300 rounded-xl" />
        </Card>
      </div>
      <div className="mt-4 text-xs text-slate-500">Pour des données réelles, brancher les endpoints API et la base.</div>
    </Section>
  );
}
