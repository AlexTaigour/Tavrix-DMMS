import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ShoppingCart, X, Utensils, ClipboardList, CheckCircle2, Search, Plus, Minus, Trash2, Receipt, Wifi, Navigation, ArrowRight, Clock3, Flame, MapPin } from 'lucide-react';
import { fetchMenu, fetchTables, placeOrder, fetchOrderGateStatus } from '../api/client';
import { getSocket } from '../api/socket';
import { MenuCard } from '../components/MenuCard';
import ItemDetailModal from '../components/ItemDetailModal';
import BrewingLoader from '../components/BrewingLoader';
import AnimatedList from '../components/reactbits/AnimatedList';
import ClickSpark from '../components/reactbits/ClickSpark';
import ShinyButton from '../components/reactbits/ShinyButton';
import CountUp from '../components/reactbits/CountUp';
import { CAFE_NAME, CAFE_TAGLINE, CAFE_LOGO } from '../utils/brand';
import { getTrackedOrders, rememberOrder } from '../utils/trackedOrders';

// Returning customers skip retyping their details.
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem('tvx_customer') || '{}');
  } catch {
    return {};
  }
})();

// One-shot browser GPS read for the in-café geofence. Rejects on denial/timeout
// so the caller can tell the customer what to do. Needs https (the live site).
function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no-geo'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}

const CustomerView = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const menuUrl = `${location.pathname}${location.search}${location.hash}`;
  const qrTable = useMemo(
    () => (new URLSearchParams(window.location.search).get('table') || '').trim(),
    []
  );
  const tableQrToken = useMemo(
    () => (new URLSearchParams(window.location.search).get('qr') || '').trim(),
    []
  );
  const [menu, setMenu] = useState(null);
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState({});
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showTrackOrder, setShowTrackOrder] = useState(false);
  const [trackCode, setTrackCode] = useState('');
  const [detailItemId, setDetailItemId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // In-café gate. allowed=true unless a check blocks; needLocation → prompt for
  // GPS; tooFar → location shared but outside the café. Fail open on errors.
  const [gate, setGate] = useState({ allowed: true, needLocation: false, tooFar: false, distance: null });
  const [locating, setLocating] = useState(false);
  const [geoErr, setGeoErr] = useState('');
  const coordsRef = useRef(null); // last GPS fix, sent with the order
  const orderSheetTouch = useRef(null);
  const activeOverlayRef = useRef(null);
  const canOrder = gate.allowed;
  const [formData, setFormData] = useState({
    name: saved.name || '',
    phone: saved.phone || '',
    table: qrTable,
    orderType: 'dine',
    note: '',
  });
  const trackable = useMemo(() => getTrackedOrders().length > 0, []);
  activeOverlayRef.current = showOrderForm ? 'order' : detailItemId != null ? 'item' : null;

  const openItemDetail = (itemId) => {
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      state: { ...location.state, customerOverlay: 'item' },
    });
    setDetailItemId(itemId);
  };
  const closeItemDetail = () => {
    setDetailItemId(null);
    if (location.state?.customerOverlay === 'item') navigate(-1);
  };

  const openOrderForm = () => {
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      state: { customerOverlay: 'order' },
    });
    setShowOrderForm(true);
  };
  const closeOrderForm = () => {
    setShowOrderForm(false);
    if (location.state?.customerOverlay === 'order') navigate(-1);
  };

  // Derived from the live menu so socket menu:updated refreshes flow into an
  // open modal (e.g. it flips to sold-out live); closes if the item is deleted.
  const detailItem = useMemo(
    () => (menu && detailItemId != null ? menu.find((m) => m.id === detailItemId) || null : null),
    [menu, detailItemId]
  );
  useEffect(() => {
    if (detailItemId != null && menu && !detailItem) closeItemDetail();
  }, [detailItemId, menu, detailItem, location.state, navigate]);

  useEffect(() => {
    const locked = showOrderForm || detailItemId != null;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showOrderForm, detailItemId]);

  useEffect(() => {
    const handlePopState = () => {
      if (activeOverlayRef.current === 'order') setShowOrderForm(false);
      if (activeOverlayRef.current === 'item') setDetailItemId(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Ask the server whether this device may order. Optional coords feed the GPS
  // geofence. Fail open — a check error must never block a real customer.
  const checkGate = async (coords) => {
    try {
      const s = await fetchOrderGateStatus(coords);
      if (s.allowed) {
        setGate({ allowed: true, needLocation: false, tooFar: false, distance: null });
      } else if (s.needLocation && !coords) {
        setGate({ allowed: false, needLocation: true, tooFar: false, distance: null });
      } else {
        // blocked; if we already shared a location, it's a distance/other fail
        setGate({ allowed: false, needLocation: false, tooFar: !!coords && s.geoRequired, distance: s.distance ?? null });
      }
    } catch {
      setGate({ allowed: true, needLocation: false, tooFar: false, distance: null });
    }
  };

  // Customer taps "I'm at the café" → read GPS, re-check, remember for submit.
  const confirmLocation = async () => {
    setGeoErr('');
    setLocating(true);
    try {
      const loc = await getBrowserLocation();
      coordsRef.current = loc;
      await checkGate(loc);
    } catch {
      setGeoErr('Please allow location access, then tap again.');
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    Promise.all([fetchMenu(), fetchTables()])
      .then(([m, t]) => { setMenu(m); setTables(t); })
      .catch(() => setMenu([]));

    checkGate(null); // first pass without location

    // live menu updates when the owner edits items
    const socket = getSocket();
    const refresh = () => fetchMenu().then(setMenu).catch(() => {});
    socket.on('menu:updated', refresh);
    return () => socket.off('menu:updated', refresh);
  }, []);

  const categories = useMemo(
    () => (menu ? ['All', ...new Set(menu.map((i) => i.category))] : ['All']),
    [menu]
  );
  const filteredMenu = useMemo(() => {
    if (!menu) return [];
    let list = activeCategory === 'All' ? menu : menu.filter((i) => i.category === activeCategory);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q));
    return list;
  }, [activeCategory, menu, search]);
  const menuSections = useMemo(() => {
    if (!menu) return [];
    const sectionCategories = activeCategory === 'All' ? categories.slice(1) : [activeCategory];
    return sectionCategories
      .map((category) => ({
        category,
        items: filteredMenu.filter((item) => item.category === category),
      }))
      .filter((section) => section.items.length > 0);
  }, [activeCategory, categories, filteredMenu, menu]);
  const cartItems = useMemo(() => {
    if (!menu) return [];
    return Object.entries(cart).map(([id, qty]) => {
      const item = menu.find((m) => m.id === Number(id));
      return { id: Number(id), name: item?.name || '', qty, price: item?.price || 0 };
    });
  }, [cart, menu]);
  const total = cartItems.reduce((s, i) => s + i.qty * i.price, 0);
  const itemCount = cartItems.reduce((s, i) => s + i.qty, 0);

  const updateQty = (id, delta) => {
    setCart((p) => {
      const next = (p[id] || 0) + delta;
      if (next <= 0) {
        const { [id]: _, ...rest } = p;
        return rest;
      }
      return { ...p, [id]: Math.min(next, 20) };
    });
  };
  const removeItem = (id) => {
    setCart((p) => {
      const { [id]: _, ...rest } = p;
      return rest;
    });
  };

  // If the last line is removed inside the modal there is nothing to confirm.
  useEffect(() => {
    if (showOrderForm && cartItems.length === 0) closeOrderForm();
  }, [showOrderForm, cartItems.length, location.state, navigate]);

  const submitOrder = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || submitting) return;
    if (!canOrder) {
      setError(
        gate.needLocation
          ? 'Please tap “I’m at the café” to share your location first.'
          : gate.tooFar
          ? 'You appear to be too far from the café to order.'
          : 'Ordering is only available inside the café. Please connect to the café Wi-Fi.'
      );
      return;
    }
    const takeaway = formData.orderType === 'takeaway';
    if (!takeaway && !formData.table) {
      setError('Please pick your table number');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const order = await placeOrder({
        name: formData.name,
        phone: formData.phone,
        orderType: formData.orderType,
        table: takeaway ? undefined : formData.table,
        tableQrToken,
        note: formData.note,
        // include the last GPS fix so the server can verify the geofence
        ...(coordsRef.current ? { lat: coordsRef.current.lat, lng: coordsRef.current.lng } : {}),
        items: cartItems.map((i) => ({ menuItemId: i.id, qty: i.qty })),
      });
      try {
        localStorage.setItem('tvx_customer', JSON.stringify({ name: formData.name, phone: formData.phone }));
        rememberOrder(order.publicCode);
      } catch {}
      setCart({});
      setShowOrderForm(false);
      navigate(`/track/${order.publicCode}`, {
        replace: true,
        state: { returnTo: menuUrl },
      });
    } catch (err) {
      // Server is the real gate — it may reject if the network/location changed.
      if (err.status === 403) checkGate(coordsRef.current);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openMyOrder = () => {
    if (trackable) {
      navigate('/orders', { state: { returnTo: menuUrl } });
      return;
    }
    setTrackCode('');
    setShowTrackOrder(true);
  };

  const submitTrackCode = (e) => {
    e.preventDefault();
    const code = trackCode.trim().toUpperCase();
    if (!code) return;
    setShowTrackOrder(false);
    navigate(`/track/${encodeURIComponent(code)}`, { state: { returnTo: menuUrl } });
  };

  if (!menu) {
    return <BrewingLoader splash label="Brewing your menu" />;
  }

  const featuredItem = menu.find((item) => item.image && item.isAvailable !== false) || menu.find((item) => item.image);

  return (
    <div className="max-w-[1440px] mx-auto min-h-screen px-4 sm:px-6 pb-28 lg:pb-12">
      <header className="pt-4 sm:pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={CAFE_LOGO}
              alt=""
              fetchPriority="high"
              decoding="async"
              className="h-12 w-12 shrink-0 rounded-full border border-espresso/10 bg-white object-contain p-1 shadow-sm sm:h-14 sm:w-14"
            />
            <div className="min-w-0">
              <p className="truncate font-bold leading-tight text-bean sm:text-lg">{CAFE_NAME}</p>
              <p className="mt-1 truncate text-xs text-bean/60 sm:text-sm">{CAFE_TAGLINE}</p>
            </div>
          </div>
          <button
            onClick={openMyOrder}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-espresso/15 bg-white px-3 text-xs font-bold text-bean shadow-sm transition hover:border-chiya hover:text-chiya sm:px-4 sm:text-sm"
          >
            <Receipt size={15} /> My order
          </button>
        </div>

        <div className="relative mt-5 min-h-[220px] overflow-hidden rounded-[28px] bg-[#a51f29] text-white shadow-lg sm:min-h-[300px] lg:min-h-[340px]">
          {featuredItem && (
            <img
              src={featuredItem.image}
              alt=""
              fetchPriority="high"
              decoding="async"
              className="absolute inset-y-0 right-0 h-full w-full object-cover object-center opacity-45 sm:w-[68%] sm:opacity-100"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#8f1d27] via-[#8f1d27]/90 to-[#8f1d27]/15 sm:via-[#8f1d27]/80" />
          <div className="relative z-10 flex min-h-[220px] max-w-2xl flex-col items-start justify-center p-5 sm:min-h-[300px] sm:p-10 lg:min-h-[340px] lg:p-14">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">
              <Flame size={14} /> Fresh from our kitchen
            </p>
            <h1 className="max-w-xl font-serif text-2xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              A little taste<br className="hidden sm:block" /> of Nepal.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85 sm:mt-4 sm:text-base">
              Comforting chiya, local favourites, and warm hospitality — made fresh for you.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-6">
              <a
                href="#menu"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-espresso shadow-md transition hover:bg-cream"
              >
                Explore the menu <ArrowRight size={16} />
              </a>
              {formData.table && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/15 px-4 py-3 text-sm font-semibold">
                  <MapPin size={15} /> Table {formData.table}
                </span>
              )}
            </div>
          </div>
          {!featuredItem && (
            <div className="pointer-events-none absolute -right-8 -top-10 h-64 w-64 rounded-full border-[36px] border-white/5 sm:right-12 sm:top-10" />
          )}
        </div>
      </header>

      <nav id="menu" className="sticky top-0 z-40 -mx-4 mt-5 border-b border-espresso/10 bg-[#fff8f6]/95 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                aria-pressed={activeCategory === cat}
                className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activeCategory === cat
                    ? 'bg-chiya text-white shadow-sm'
                    : 'border border-espresso/10 bg-white text-bean/75 hover:border-chiya/40 hover:text-chiya'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative w-full md:max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-bean/45" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find something delicious"
              aria-label="Search the menu"
              className="w-full rounded-full border border-espresso/10 bg-white py-3 pl-10 pr-10 text-sm font-medium text-bean outline-none transition focus:border-chiya focus:ring-2 focus:ring-chiya/15"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-bean/55 hover:bg-cream"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main>
      {!canOrder && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 sm:p-4">
          <div className="shrink-0 rounded-xl bg-chiya p-2 text-white">
            {gate.needLocation ? <Navigation size={20} /> : <Wifi size={20} />}
          </div>
          <div className="min-w-0">
            {gate.needLocation ? (
              <>
                <p className="font-black text-rose-900">Confirm you're at the café</p>
                <p className="mt-0.5 text-sm font-medium text-rose-800">
                  Share your location so we know you're here, then you can order. ☕
                </p>
                <button
                  onClick={confirmLocation}
                  disabled={locating}
                  className="mt-2.5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-chiya px-4 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60"
                >
                  {locating ? 'Checking…' : <><Navigation size={15} /> I'm at the café</>}
                </button>
                {geoErr && <p className="text-red-600 text-xs font-bold mt-2">{geoErr}</p>}
              </>
            ) : gate.tooFar ? (
              <>
                <p className="font-black text-rose-900">You seem too far from the café</p>
                <p className="mt-0.5 text-sm font-medium text-rose-800">
                  {gate.distance != null ? `You're about ${gate.distance} m away. ` : ''}
                  Please order from inside the café. You can still browse the menu below.
                </p>
              </>
            ) : (
              <>
                <p className="font-black text-rose-900">Ordering is for café guests</p>
                <p className="mt-0.5 text-sm font-medium text-rose-800">
                  Please connect to the café Wi-Fi to place an order. You can still browse the menu below. ☕
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <ClickSpark>
        <div className="space-y-9">
          {menuSections.map((section) => (
            <section key={section.category} aria-labelledby={`category-${section.category.replace(/\W+/g, '-').toLowerCase()}`}>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-chiya">Made with care</p>
                  <h2
                    id={`category-${section.category.replace(/\W+/g, '-').toLowerCase()}`}
                    className="font-serif text-2xl font-bold text-bean sm:text-3xl"
                  >
                    {section.category}
                  </h2>
                </div>
                <span className="shrink-0 pb-1 text-xs font-medium text-bean/50">
                  {section.items.length} {section.items.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <AnimatedList
                items={section.items}
                keyOf={(item) => item.id}
                className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4"
                renderItem={(item) => (
                  <MenuCard
                    item={item}
                    quantity={cart[item.id] || 0}
                    onUpdateQuantity={updateQty}
                    onOpenDetail={openItemDetail}
                  />
                )}
              />
            </section>
          ))}
        </div>
        {!filteredMenu.length && (
          <div className="rounded-3xl border border-dashed border-espresso/20 bg-white/70 py-16 text-center text-bean/55">
            <Utensils size={38} className="mx-auto mb-4 text-chiya/60" />
            <p className="font-semibold text-bean">{search ? `Nothing matches “${search}”` : 'The menu is getting ready'}</p>
            {search && (
              <button onClick={() => setSearch('')} className="mt-3 text-sm font-bold text-chiya hover:underline">
                Clear search
              </button>
            )}
          </div>
        )}
      </ClickSpark>
        </main>

        <aside className="sticky top-24 hidden lg:block">
          <div className="overflow-hidden rounded-3xl border border-espresso/10 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-espresso/10 px-5 py-4">
              <h2 className="flex items-center gap-2 font-bold text-bean">
                <ShoppingCart size={18} className="text-chiya" /> Your order
              </h2>
              <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-espresso">{itemCount}</span>
            </div>
            {cartItems.length ? (
              <>
                <div className="max-h-[42vh] space-y-4 overflow-y-auto px-5 py-4">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-bean">{item.name}</p>
                        <p className="mt-1 text-xs text-bean/55">Rs. {item.price} each</p>
                      </div>
                      <div className="flex items-center gap-1 rounded-full border border-espresso/10 bg-cream/70 p-1">
                        <button onClick={() => updateQty(item.id, -1)} aria-label={`Remove one ${item.name}`} className="flex h-11 w-11 items-center justify-center rounded-full text-espresso hover:bg-white">
                          <Minus size={14} />
                        </button>
                        <span className="min-w-4 text-center text-xs font-bold">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} aria-label={`Add one ${item.name}`} className="flex h-11 w-11 items-center justify-center rounded-full text-espresso hover:bg-white">
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="w-16 text-right text-xs font-bold text-bean">Rs. {item.qty * item.price}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-dashed border-espresso/15 px-5 py-4">
                  <div className="flex justify-between text-sm text-bean/60">
                    <span>Subtotal</span><span>Rs. {total}</span>
                  </div>
                  <div className="mt-3 flex justify-between font-bold text-bean">
                    <span>Total</span><span>Rs. {total}</span>
                  </div>
                  <button
                    onClick={openOrderForm}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-chiya px-4 py-3 text-sm font-bold text-white transition hover:bg-espresso"
                  >
                    Continue to checkout <ArrowRight size={16} />
                  </button>
                  {formData.table && (
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-bean/55">
                      <MapPin size={13} /> Order will be served at table {formData.table}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="px-5 py-7 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-cream text-chiya">
                  <ShoppingCart size={19} />
                </div>
                <p className="text-sm font-semibold text-bean">Your order is waiting</p>
                <p className="mt-1 text-xs leading-relaxed text-bean/55">Add something you love and it will show up here.</p>
              </div>
            )}
            <div className="flex items-center justify-center gap-1.5 border-t border-espresso/10 bg-cream/60 px-4 py-3 text-[11px] text-bean/60">
              <Clock3 size={13} /> Freshly prepared when you order
            </div>
          </div>
        </aside>
      </div>

      {cartItems.length > 0 && !showOrderForm && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 lg:hidden">
          <ShinyButton
            onClick={openOrderForm}
            className="w-full bg-chiya text-white p-4 rounded-2xl shadow-xl font-black"
          >
            <span className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart size={22} /> {itemCount} {itemCount === 1 ? 'item' : 'items'} · View order
              </span>
              <CountUp value={total} prefix="Rs. " />
            </span>
          </ShinyButton>
        </div>
      )}

      <AnimatePresence>
        {detailItem && (
          <ItemDetailModal
            key={detailItem.id}
            item={detailItem}
            quantity={cart[detailItem.id] || 0}
            onUpdateQuantity={updateQty}
            onClose={closeItemDetail}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOrderForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4"
            onClick={closeOrderForm}
          >
            <motion.div
              initial={{ y: 500 }}
              animate={{ y: 0 }}
              exit={{ y: 500 }}
              transition={{ duration: 0.32, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(event) => {
              if (event.target.closest('button, input, textarea, select')) {
                orderSheetTouch.current = null;
                return;
              }
              const touch = event.touches[0];
              orderSheetTouch.current = {
                x: touch.clientX,
                y: touch.clientY,
                scrollTop: event.currentTarget.scrollTop,
              };
            }}
            onTouchEnd={(event) => {
              const start = orderSheetTouch.current;
              orderSheetTouch.current = null;
              if (!start || start.scrollTop > 0) return;
              const touch = event.changedTouches[0];
              const deltaY = touch.clientY - start.y;
              const deltaX = touch.clientX - start.x;
              if (deltaY > 100 && deltaY > Math.abs(deltaX) * 1.25) closeOrderForm();
            }}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
          >
            <div className="sm:hidden w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-black handwritten text-espresso flex items-center gap-2">
                <ClipboardList size={24} /> Your Order
              </h2>
              <button onClick={closeOrderForm} aria-label="Close your order" className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100">
                <X size={20} />
              </button>
            </div>

            {/* editable cart review — change your mind without leaving the sheet */}
            <div className="bg-cream rounded-2xl p-3 mb-4 space-y-1">
              {cartItems.map((it) => (
                <div key={it.id} className="flex items-center gap-2 py-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-bean truncate">{it.name}</p>
                    <p className="text-xs text-gray-500">Rs. {it.price} each</p>
                  </div>
                  <div className="flex items-center gap-1 bg-white rounded-full border border-latte/40 px-1">
                    <button
                      type="button"
                      onClick={() => updateQty(it.id, -1)}
                      className="flex h-11 w-11 items-center justify-center text-espresso active:scale-90"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-black text-sm w-5 text-center">{it.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(it.id, 1)}
                      className="flex h-11 w-11 items-center justify-center text-espresso active:scale-90"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="font-bold text-sm w-16 text-right">Rs. {it.qty * it.price}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="flex h-11 w-11 items-center justify-center text-red-400 hover:text-red-600 active:scale-90"
                    aria-label={`Remove ${it.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <div className="flex justify-between font-black border-t border-latte/40 pt-2 mt-1">
                <span>Total</span>
                <span>Rs. {total}</span>
              </div>
            </div>

            <form onSubmit={submitOrder} className="space-y-4">
              <input
                required
                placeholder="Name"
                maxLength={80}
                autoComplete="name"
                aria-label="Your name"
                className="w-full p-3 rounded-xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-chiya outline-none transition-all font-medium"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                required
                type="tel"
                inputMode="tel"
                placeholder="Phone"
                maxLength={20}
                autoComplete="tel"
                pattern="[0-9+\-\s]{4,20}"
                title="Digits, +, - and spaces only"
                aria-label="Your phone number"
                className="w-full p-3 rounded-xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-chiya outline-none transition-all font-medium"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
              />

              {/* Dine-in at a table, or takeaway from the counter */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setFormData((p) => ({ ...p, orderType: 'dine' })); setError(''); }}
                  className={`min-h-11 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                    formData.orderType === 'dine'
                      ? 'bg-espresso text-white shadow-md'
                      : 'border-2 border-gray-100 hover:border-espresso/40'
                  }`}
                >
                  🪑 Dine in
                </button>
                <button
                  type="button"
                  onClick={() => { setFormData((p) => ({ ...p, orderType: 'takeaway' })); setError(''); }}
                  className={`min-h-11 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                    formData.orderType === 'takeaway'
                      ? 'bg-espresso text-white shadow-md'
                      : 'border-2 border-gray-100 hover:border-espresso/40'
                  }`}
                >
                  🥡 Takeaway
                </button>
              </div>

              {formData.orderType === 'dine' ? (
                <div className={qrTable && tableQrToken ? '' : 'grid grid-cols-5 gap-2'}>
                  <p className={qrTable && tableQrToken ? 'text-center font-bold' : 'col-span-5 text-center font-bold'}>
                    Table No.
                  </p>
                  {qrTable && tableQrToken ? (
                    <div className="mt-2 bg-chiya text-white rounded-lg py-2.5 text-center font-bold">
                      {qrTable}
                      <span className="block text-[10px] uppercase tracking-wider opacity-80">Locked from QR</span>
                    </div>
                  ) : (
                    <p className="col-span-5 rounded-xl bg-amber-50 px-3 py-3 text-center text-xs font-bold text-amber-800">
                      Scan the QR code at your table to place a dine-in order.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center text-xs font-bold text-gray-400 bg-cream rounded-xl py-3">
                  You'll get a pickup token — collect at the counter when it's ready.
                </p>
              )}

              <textarea
                placeholder="Note for the kitchen (optional — e.g. less sugar)"
                maxLength={500}
                className="w-full p-3 rounded-xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-chiya outline-none transition-all font-medium h-20"
                value={formData.note}
                onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
              />

              {!canOrder && (
                <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-xl py-2.5 px-3 text-xs font-bold text-center">
                  {gate.needLocation ? (
                    <button
                      type="button"
                      onClick={confirmLocation}
                      disabled={locating}
                      className="inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <Navigation size={14} /> {locating ? 'Checking…' : "Tap to confirm you're at the café"}
                    </button>
                  ) : gate.tooFar ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Navigation size={14} /> You seem too far from the café to order
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Wifi size={14} /> Connect to the café Wi-Fi to place this order
                    </span>
                  )}

                  {showTrackOrder && (
                    <div
                      className="fixed inset-0 z-[60] flex items-end justify-center bg-bean/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
                      onClick={() => setShowTrackOrder(false)}
                    >
                      <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="track-order-title"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md rounded-t-3xl border border-espresso/10 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-chiya">Order tracking</p>
                            <h2 id="track-order-title" className="mt-1 text-xl font-black text-bean">Find your order</h2>
                            <p className="mt-1 text-sm text-bean/55">Enter the order code from your confirmation to view its details and live status.</p>
                          </div>
                          <button
                            onClick={() => setShowTrackOrder(false)}
                            aria-label="Close order tracking"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream text-bean/60 hover:text-chiya"
                          >
                            <X size={17} />
                          </button>
                        </div>
                        <form onSubmit={submitTrackCode} className="space-y-3">
                          <label htmlFor="track-order-code" className="text-xs font-bold text-bean/60">Order code</label>
                          <input
                            id="track-order-code"
                            autoFocus
                            required
                            minLength={3}
                            maxLength={32}
                            pattern="[A-Za-z0-9-]+"
                            title="Enter the order code shown on your confirmation"
                            value={trackCode}
                            onChange={(e) => setTrackCode(e.target.value)}
                            placeholder="e.g. TVX-ABC123"
                            className="min-h-12 w-full rounded-xl border border-espresso/15 bg-[#fff8f6] px-4 font-mono text-sm font-bold uppercase tracking-wide text-bean outline-none focus:border-chiya focus:ring-2 focus:ring-chiya/15"
                          />
                          <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-chiya px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700">
                            Track order <ArrowRight size={16} />
                          </button>
                        </form>
                        </div>
                      </div>
                    )}
                </div>
              )}
              {error && <p className="text-red-500 text-sm font-bold text-center">{error}</p>}

              <ShinyButton
                type="submit"
                disabled={submitting || !canOrder}
                className="w-full bg-espresso text-white py-4 rounded-xl font-black disabled:opacity-60"
              >
                <CheckCircle2 size={20} /> {submitting ? 'Placing…' : `Confirm · Rs. ${total}`}
              </ShinyButton>
            </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerView;
