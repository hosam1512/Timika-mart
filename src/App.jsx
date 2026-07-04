import React, { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart, Search, Plus, Minus, Trash2, Lock, X, Package,
  Check, Edit2, Loader2, Store
} from "lucide-react";
import { supabase } from "./supabaseClient";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
`;

const COLORS = {
  bg: "#12161C",
  surface: "#1B212B",
  surfaceHi: "#232A36",
  border: "#2B3340",
  text: "#F3EFE6",
  textDim: "#9AA4B2",
  gold: "#F0B429",
  teal: "#3ECFAF",
  coral: "#EF6461",
};

const orderCode = () => "T-" + Math.floor(100000 + Math.random() * 900000);

const STATUSES = [
  { key: "review", label: "قيد المراجعة", color: COLORS.gold },
  { key: "ordered", label: "اتطلب من المصدر", color: "#5B9BD5" },
  { key: "shipped", label: "في الطريق", color: COLORS.teal },
  { key: "delivered", label: "اتسلّم", color: "#7ED957" },
  { key: "cancelled", label: "ملغي", color: COLORS.coral },
];

// ---- Supabase helpers ----
async function fetchProducts() {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}
async function fetchOrders() {
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map(o => ({
    id: o.id,
    code: o.code,
    items: o.items,
    total: o.total,
    status: o.status,
    createdAt: o.created_at,
    customer: { name: o.customer_name, phone: o.customer_phone, address: o.customer_address, method: o.payment_method, note: o.note },
  }));
}
async function fetchSettings() {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) { console.error(error); return { vodafone: "", instapay: "", bank: "" }; }
  return data;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({ vodafone: "", instapay: "", bank: "" });

  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("الكل");

  const [adminOpen, setAdminOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [adminTab, setAdminTab] = useState("products");
  const [editingProduct, setEditingProduct] = useState(null);

  async function reloadAll() {
    setProducts(await fetchProducts());
    setOrders(await fetchOrders());
    setSettings(await fetchSettings());
  }

  useEffect(() => {
    (async () => {
      await reloadAll();
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => ["الكل", ...Array.from(new Set(products.map(p => p.category)))], [products]);

  const filtered = useMemo(() => {
    return products.filter(p =>
      (activeCat === "الكل" || p.category === activeCat) &&
      p.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [products, activeCat, query]);

  const cartItems = useMemo(() => {
    return Object.entries(cart).map(([id, qty]) => {
      const prod = products.find(p => p.id === id);
      return prod ? { ...prod, qty } : null;
    }).filter(Boolean);
  }, [cart, products]);

  const cartTotal = cartItems.reduce((s, i) => s + Number(i.price) * i.qty, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  function addToCart(id) {
    setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  }
  function changeQty(id, delta) {
    setCart(c => {
      const next = { ...c, [id]: (c[id] || 0) + delta };
      if (next[id] <= 0) delete next[id];
      return next;
    });
  }
  function removeFromCart(id) {
    setCart(c => {
      const next = { ...c };
      delete next[id];
      return next;
    });
  }

  async function submitOrder(customer) {
    setSubmitting(true);
    const code = orderCode();
    const payload = {
      code,
      items: cartItems.map(i => ({ productId: i.id, name: i.name, price: i.price, qty: i.qty })),
      total: cartTotal,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_address: customer.address,
      payment_method: customer.method,
      note: customer.note,
      status: "review",
    };
    const { data, error } = await supabase.from("orders").insert(payload).select().single();
    setSubmitting(false);
    if (error) {
      console.error(error);
      alert("حصل خطأ في إرسال الطلب، حاول تاني");
      return;
    }
    setCart({});
    setCheckoutOpen(false);
    setCartOpen(false);
    setConfirmedOrder({ code: data.code, total: data.total });
    setOrders(await fetchOrders());
  }

  async function addProduct(record) {
    const { error } = await supabase.from("products").insert({
      name: record.name, category: record.category, image: record.image, cost: record.cost, price: record.price,
    });
    if (error) console.error(error);
    setProducts(await fetchProducts());
  }
  async function updateProduct(id, record) {
    const { error } = await supabase.from("products").update({
      name: record.name, category: record.category, image: record.image, cost: record.cost, price: record.price,
    }).eq("id", id);
    if (error) console.error(error);
    setProducts(await fetchProducts());
  }
  async function deleteProduct(id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) console.error(error);
    setProducts(await fetchProducts());
  }
  async function updateOrderStatus(id, status) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) console.error(error);
    setOrders(await fetchOrders());
  }
  async function deleteOrder(id) {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) console.error(error);
    setOrders(await fetchOrders());
  }
  async function saveSettings(next) {
    const { error } = await supabase.from("settings").update({
      vodafone: next.vodafone, instapay: next.instapay, bank: next.bank,
    }).eq("id", 1);
    if (error) console.error(error);
    setSettings(await fetchSettings());
  }

  function tryLogin() {
    if (pwInput === "1234") {
      setAuthed(true);
      setPwError(false);
      setPwInput("");
    } else {
      setPwError(true);
    }
  }

  if (loading) {
    return (
      <div style={{ background: COLORS.bg, color: COLORS.text, minHeight: "100vh" }} className="flex items-center justify-center">
        <style>{FONTS}</style>
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ background: COLORS.bg, color: COLORS.text, minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <style>{FONTS}</style>

      <header style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface }} className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div style={{ background: COLORS.gold, color: "#1A1300" }} className="w-9 h-9 rounded-xl flex items-center justify-center font-bold">
            <Store size={18} />
          </div>
          <span style={{ fontFamily: "Cairo, sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: 0.5 }}>Timika Mart</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAdminOpen(true)} style={{ color: COLORS.textDim }} className="p-2 hover:text-white transition">
            <Lock size={19} />
          </button>
          <button onClick={() => setCartOpen(true)} className="relative p-2" style={{ color: COLORS.text }}>
            <ShoppingCart size={21} />
            {cartCount > 0 && (
              <span style={{ background: COLORS.coral }} className="absolute -top-0.5 -left-0.5 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="px-4 pt-4">
        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }} className="flex items-center gap-2 rounded-xl px-3 py-2.5">
          <Search size={17} style={{ color: COLORS.textDim }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="دور على منتج..."
            style={{ background: "transparent", color: COLORS.text }}
            className="w-full outline-none text-sm"
          />
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              style={{
                background: activeCat === cat ? COLORS.gold : COLORS.surface,
                color: activeCat === cat ? "#1A1300" : COLORS.textDim,
                border: `1px solid ${activeCat === cat ? COLORS.gold : COLORS.border}`,
                whiteSpace: "nowrap",
              }}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 py-5 grid grid-cols-2 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-16" style={{ color: COLORS.textDim }}>
            <Package className="mx-auto mb-2" size={28} />
            <p className="text-sm">مفيش منتجات كده دلوقتي</p>
          </div>
        )}
        {filtered.map(p => (
          <div key={p.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }} className="rounded-2xl overflow-hidden flex flex-col transition hover:-translate-y-0.5">
            <div style={{ aspectRatio: "1/1", background: COLORS.surfaceHi }} className="overflow-hidden">
              <img src={p.image} alt={p.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} />
            </div>
            <div className="p-3 flex flex-col gap-1.5 flex-1">
              <span style={{ color: COLORS.textDim, fontSize: 10 }} className="uppercase tracking-wide">{p.category}</span>
              <span className="text-sm font-medium leading-snug">{p.name}</span>
              <div className="mt-auto flex items-center justify-between pt-2">
                <span style={{ fontFamily: "JetBrains Mono, monospace", color: COLORS.gold }} className="font-semibold">{p.price} ج.م</span>
                <button
                  onClick={() => addToCart(p.id)}
                  style={{ background: COLORS.gold, color: "#1A1300" }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 transition"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </main>

      {cartOpen && (
        <div className="fixed inset-0 z-40 flex justify-end" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => setCartOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: COLORS.surface, width: "min(88%, 380px)" }} className="h-full flex flex-col">
            <div style={{ borderBottom: `1px solid ${COLORS.border}` }} className="p-4 flex items-center justify-between">
              <span style={{ fontFamily: "Cairo, sans-serif" }} className="font-bold text-lg">السلة</span>
              <button onClick={() => setCartOpen(false)}><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {cartItems.length === 0 && <p style={{ color: COLORS.textDim }} className="text-sm text-center mt-10">السلة فاضية</p>}
              {cartItems.map(i => (
                <div key={i.id} className="flex gap-3 items-center">
                  <img src={i.image} className="w-14 h-14 rounded-lg object-cover" style={{ background: COLORS.surfaceHi }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{i.name}</p>
                    <p style={{ fontFamily: "JetBrains Mono, monospace", color: COLORS.gold, fontSize: 13 }}>{i.price} ج.م</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeQty(i.id, -1)} style={{ border: `1px solid ${COLORS.border}` }} className="w-6 h-6 rounded-md flex items-center justify-center"><Minus size={12} /></button>
                    <span className="text-sm w-4 text-center">{i.qty}</span>
                    <button onClick={() => changeQty(i.id, 1)} style={{ border: `1px solid ${COLORS.border}` }} className="w-6 h-6 rounded-md flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                  <button onClick={() => removeFromCart(i.id)} style={{ color: COLORS.coral }}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            {cartItems.length > 0 && (
              <div style={{ borderTop: `1px solid ${COLORS.border}` }} className="p-4">
                <div className="flex justify-between mb-3 text-sm">
                  <span style={{ color: COLORS.textDim }}>الإجمالي</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace" }} className="font-bold">{cartTotal} ج.م</span>
                </div>
                <button
                  onClick={() => setCheckoutOpen(true)}
                  style={{ background: COLORS.gold, color: "#1A1300" }}
                  className="w-full py-3 rounded-xl font-bold text-sm"
                >
                  إتمام الطلب
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {checkoutOpen && (
        <CheckoutModal
          total={cartTotal}
          settings={settings}
          submitting={submitting}
          onClose={() => setCheckoutOpen(false)}
          onSubmit={submitOrder}
        />
      )}

      {confirmedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }} className="rounded-2xl p-6 max-w-sm w-full text-center">
            <div style={{ background: COLORS.teal }} className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check size={26} color="#0B1F1A" />
            </div>
            <p style={{ fontFamily: "Cairo, sans-serif" }} className="font-bold text-lg mb-1">اتسجل طلبك</p>
            <p style={{ fontFamily: "JetBrains Mono, monospace", color: COLORS.gold }} className="mb-3">{confirmedOrder.code}</p>
            <p style={{ color: COLORS.textDim }} className="text-sm mb-4">
              حوّل مبلغ {confirmedOrder.total} ج.م على الرقم اللي ظهرلك، وهيتم تأكيد الطلب بعد التحويل.
            </p>
            <button onClick={() => setConfirmedOrder(null)} style={{ background: COLORS.gold, color: "#1A1300" }} className="w-full py-2.5 rounded-xl font-bold text-sm">
              تمام
            </button>
          </div>
        </div>
      )}

      {adminOpen && !authed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }} className="rounded-2xl p-6 max-w-xs w-full">
            <div className="flex justify-between items-center mb-4">
              <span style={{ fontFamily: "Cairo, sans-serif" }} className="font-bold">دخول الأدمن</span>
              <button onClick={() => { setAdminOpen(false); setPwError(false); setPwInput(""); }}><X size={18} /></button>
            </div>
            <input
              type="password"
              value={pwInput}
              onChange={e => setPwInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && tryLogin()}
              placeholder="كلمة السر"
              style={{ background: COLORS.surfaceHi, border: `1px solid ${pwError ? COLORS.coral : COLORS.border}`, color: COLORS.text }}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none mb-2"
            />
            {pwError && <p style={{ color: COLORS.coral }} className="text-xs mb-2">كلمة السر غلط</p>}
            <p style={{ color: COLORS.textDim }} className="text-[11px] mb-3">حماية أساسية بس — غيّرها من ملف App.jsx قبل ما تنشر الموقع فعليًا.</p>
            <button onClick={tryLogin} style={{ background: COLORS.gold, color: "#1A1300" }} className="w-full py-2.5 rounded-xl font-bold text-sm">
              دخول
            </button>
          </div>
        </div>
      )}

      {adminOpen && authed && (
        <AdminPanel
          products={products}
          orders={orders}
          settings={settings}
          onClose={() => { setAdminOpen(false); setAuthed(false); }}
          onAddProduct={addProduct}
          onUpdateProduct={updateProduct}
          onDeleteProduct={deleteProduct}
          onUpdateOrderStatus={updateOrderStatus}
          onDeleteOrder={deleteOrder}
          onSaveSettings={saveSettings}
          tab={adminTab}
          setTab={setAdminTab}
          editingProduct={editingProduct}
          setEditingProduct={setEditingProduct}
        />
      )}
    </div>
  );
}

function CheckoutModal({ total, settings, submitting, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [method, setMethod] = useState("vodafone");
  const [note, setNote] = useState("");

  const methodLabel = { vodafone: "فودافون كاش", instapay: "انستاباي", bank: "تحويل بنكي" };
  const methodValue = { vodafone: settings.vodafone, instapay: settings.instapay, bank: settings.bank };

  function submit() {
    if (!name.trim() || !phone.trim() || !address.trim()) return;
    onSubmit({ name, phone, address, method: methodLabel[method], note });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }} className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <span style={{ fontFamily: "Cairo, sans-serif" }} className="font-bold text-lg">بيانات التوصيل</span>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم" style={inputStyle} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="رقم الموبايل" style={inputStyle} />
          <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="العنوان بالتفصيل" rows={2} style={inputStyle} />

          <div>
            <p style={{ color: COLORS.textDim }} className="text-xs mb-1.5">وسيلة الدفع</p>
            <div className="flex gap-2">
              {Object.entries(methodLabel).map(([k, label]) => (
                <button key={k} onClick={() => setMethod(k)} style={{
                  background: method === k ? COLORS.gold : COLORS.surfaceHi,
                  color: method === k ? "#1A1300" : COLORS.text,
                  border: `1px solid ${method === k ? COLORS.gold : COLORS.border}`,
                }} className="flex-1 py-2 rounded-lg text-xs font-semibold">
                  {label}
                </button>
              ))}
            </div>
            <div style={{ background: COLORS.surfaceHi, border: `1px dashed ${COLORS.border}` }} className="mt-2 p-2.5 rounded-lg text-xs">
              حوّل على: <span style={{ fontFamily: "JetBrains Mono, monospace", color: COLORS.gold }}>{methodValue[method]}</span>
            </div>
          </div>

          <input value={note} onChange={e => setNote(e.target.value)} placeholder="رقم عملية التحويل (اختياري)" style={inputStyle} />

          <div className="flex justify-between items-center mt-1 mb-2">
            <span style={{ color: COLORS.textDim }} className="text-sm">الإجمالي</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace" }} className="font-bold">{total} ج.م</span>
          </div>

          <button onClick={submit} disabled={submitting} style={{ background: COLORS.gold, color: "#1A1300", opacity: submitting ? 0.6 : 1 }} className="w-full py-3 rounded-xl font-bold text-sm">
            {submitting ? "جاري الإرسال..." : "تأكيد الطلب"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  background: COLORS.surfaceHi,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
  width: "100%",
};

function AdminPanel({ products, orders, settings, onClose, onAddProduct, onUpdateProduct, onDeleteProduct, onUpdateOrderStatus, onDeleteOrder, onSaveSettings, tab, setTab, editingProduct, setEditingProduct }) {
  return (
    <div className="fixed inset-0 z-50" style={{ background: COLORS.bg }}>
      <div style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface }} className="sticky top-0 flex items-center justify-between px-4 py-3">
        <span style={{ fontFamily: "Cairo, sans-serif" }} className="font-bold">لوحة التحكم</span>
        <button onClick={onClose}><X size={20} /></button>
      </div>
      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {[
          { key: "products", label: "المنتجات" },
          { key: "orders", label: "الطلبات" },
          { key: "settings", label: "الإعدادات" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            background: tab === t.key ? COLORS.gold : COLORS.surface,
            color: tab === t.key ? "#1A1300" : COLORS.textDim,
            border: `1px solid ${tab === t.key ? COLORS.gold : COLORS.border}`,
          }} className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap">
            {t.label}
          </button>
        ))}
      </div>
      <div className="px-4 pb-8 overflow-y-auto" style={{ height: "calc(100vh - 110px)" }}>
        {tab === "products" && (
          <ProductsTab products={products} onAddProduct={onAddProduct} onUpdateProduct={onUpdateProduct} onDeleteProduct={onDeleteProduct} editingProduct={editingProduct} setEditingProduct={setEditingProduct} />
        )}
        {tab === "orders" && <OrdersTab orders={orders} onUpdateOrderStatus={onUpdateOrderStatus} onDeleteOrder={onDeleteOrder} />}
        {tab === "settings" && <SettingsTab settings={settings} onSaveSettings={onSaveSettings} />}
      </div>
    </div>
  );
}

function ProductsTab({ products, onAddProduct, onUpdateProduct, onDeleteProduct, editingProduct, setEditingProduct }) {
  const empty = { name: "", category: "", image: "", cost: "", price: "" };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    setForm(editingProduct ? { ...editingProduct } : empty);
  }, [editingProduct]);

  function save() {
    if (!form.name.trim() || !form.price) return;
    const record = {
      name: form.name,
      category: form.category || "عام",
      image: form.image || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500",
      cost: Number(form.cost) || 0,
      price: Number(form.price) || 0,
    };
    if (editingProduct) {
      onUpdateProduct(editingProduct.id, record);
    } else {
      onAddProduct(record);
    }
    setEditingProduct(null);
    setForm(empty);
  }

  return (
    <div>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }} className="rounded-2xl p-4 mb-5">
        <p style={{ fontFamily: "Cairo, sans-serif" }} className="font-bold mb-3 text-sm">{editingProduct ? "تعديل منتج" : "منتج جديد"}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم المنتج" style={inputStyle} className="col-span-2" />
          <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="الفئة (أي حاجة)" style={inputStyle} className="col-span-2" />
          <input value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="رابط الصورة" style={inputStyle} className="col-span-2" />
          <input value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="سعر المصدر" style={inputStyle} type="number" />
          <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="سعر البيع" style={inputStyle} type="number" />
        </div>
        {form.cost && form.price && (
          <p style={{ color: COLORS.teal }} className="text-xs mt-2">ربحك: {Number(form.price) - Number(form.cost)} ج.م لكل قطعة</p>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={save} style={{ background: COLORS.gold, color: "#1A1300" }} className="flex-1 py-2.5 rounded-xl font-bold text-sm">
            {editingProduct ? "حفظ التعديل" : "إضافة المنتج"}
          </button>
          {editingProduct && (
            <button onClick={() => setEditingProduct(null)} style={{ border: `1px solid ${COLORS.border}` }} className="px-4 rounded-xl text-sm">إلغاء</button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {products.map(p => (
          <div key={p.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }} className="rounded-xl p-3 flex items-center gap-3">
            <img src={p.image} className="w-12 h-12 rounded-lg object-cover" style={{ background: COLORS.surfaceHi }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p style={{ color: COLORS.textDim }} className="text-xs">{p.category} · بيع {p.price} ج.م · تكلفة {p.cost} ج.م</p>
            </div>
            <button onClick={() => setEditingProduct(p)} style={{ color: COLORS.gold }}><Edit2 size={16} /></button>
            <button onClick={() => onDeleteProduct(p.id)} style={{ color: COLORS.coral }}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrdersTab({ orders, onUpdateOrderStatus, onDeleteOrder }) {
  if (orders.length === 0) {
    return <p style={{ color: COLORS.textDim }} className="text-sm text-center mt-10">لسه مفيش طلبات</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map(o => {
        const st = STATUSES.find(s => s.key === o.status) || STATUSES[0];
        return (
          <div key={o.id} style={{ background: COLORS.surface, border: `1px dashed ${COLORS.border}` }} className="rounded-xl p-4 relative overflow-hidden">
            <div style={{ background: st.color, color: "#12161C", transform: "rotate(-6deg)" }} className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded">
              {st.label}
            </div>
            <p style={{ fontFamily: "JetBrains Mono, monospace", color: COLORS.gold }} className="font-bold mb-1">{o.code}</p>
            <p className="text-sm font-medium">{o.customer.name} · {o.customer.phone}</p>
            <p style={{ color: COLORS.textDim }} className="text-xs mb-2">{o.customer.address}</p>
            <div style={{ borderTop: `1px dashed ${COLORS.border}` }} className="pt-2 mb-2">
              {o.items.map((it, idx) => (
                <p key={idx} className="text-xs flex justify-between">
                  <span>{it.name} × {it.qty}</span>
                  <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{it.price * it.qty} ج.م</span>
                </p>
              ))}
            </div>
            <div className="flex justify-between items-center mb-3">
              <span style={{ color: COLORS.textDim }} className="text-xs">{o.customer.method}{o.customer.note ? ` · ${o.customer.note}` : ""}</span>
              <span style={{ fontFamily: "JetBrains Mono, monospace" }} className="font-bold text-sm">{o.total} ج.م</span>
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={o.status}
                onChange={e => onUpdateOrderStatus(o.id, e.target.value)}
                style={{ background: COLORS.surfaceHi, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
                className="flex-1 rounded-lg px-2 py-1.5 text-xs outline-none"
              >
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button onClick={() => onDeleteOrder(o.id)} style={{ color: COLORS.coral }}><Trash2 size={16} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SettingsTab({ settings, onSaveSettings }) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setForm(settings); }, [settings]);

  function save() {
    onSaveSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}` }} className="rounded-2xl p-4">
      <p style={{ fontFamily: "Cairo, sans-serif" }} className="font-bold mb-3 text-sm">بيانات الدفع اللي هتظهر للعميل</p>
      <div className="flex flex-col gap-2.5">
        <div>
          <p style={{ color: COLORS.textDim }} className="text-xs mb-1">فودافون كاش</p>
          <input value={form.vodafone || ""} onChange={e => setForm(f => ({ ...f, vodafone: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <p style={{ color: COLORS.textDim }} className="text-xs mb-1">انستاباي</p>
          <input value={form.instapay || ""} onChange={e => setForm(f => ({ ...f, instapay: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <p style={{ color: COLORS.textDim }} className="text-xs mb-1">تحويل بنكي</p>
          <input value={form.bank || ""} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} style={inputStyle} />
        </div>
        <button onClick={save} style={{ background: COLORS.gold, color: "#1A1300" }} className="w-full py-2.5 rounded-xl font-bold text-sm mt-1">
          {saved ? "اتحفظ ✓" : "حفظ"}
        </button>
      </div>
    </div>
  );
}
