import React, { lazy, Suspense, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Coffee, TrendingUp, Menu as MenuIcon, Users, QrCode, LogOut, ClipboardList,
  ChefHat, KeyRound, Sunset, NotebookPen, History, Wifi, ChevronRight, Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import { CAFE_NAME, PLATFORM_NAME } from '../../utils/brand';

const AnalyticsTab = lazy(() => import('./AnalyticsTab'));
const MenuTab = lazy(() => import('./MenuTab'));
const UsersTab = lazy(() => import('./UsersTab'));
const QrTab = lazy(() => import('./QrTab'));
const OrderGateTab = lazy(() => import('./OrderGateTab'));
const DayReportTab = lazy(() => import('./DayReportTab'));
const CreditTab = lazy(() => import('./CreditTab'));
const OrderHistoryTab = lazy(() => import('./OrderHistoryTab'));

const TABS = [
  { to: '/owner', end: true, icon: TrendingUp, label: 'Overview' },
  { to: '/owner/history', icon: History, label: 'History' },
  { to: '/owner/day-report', icon: Sunset, label: 'Day Report' },
  { to: '/owner/credit', icon: NotebookPen, label: 'Udhaaro' },
  { to: '/owner/menu', icon: MenuIcon, label: 'Menu' },
  { to: '/owner/users', icon: Users, label: 'Users' },
  { to: '/owner/qr', icon: QrCode, label: 'Table QR' },
  { to: '/owner/ordering', icon: Wifi, label: 'In-Café Lock' },
];

export default function OwnerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showChangePw, setShowChangePw] = useState(false);
  const activeTab = TABS.find((tab) => (
    tab.end ? location.pathname === tab.to : location.pathname.startsWith(tab.to)
  )) || TABS[0];

  const linkClass = ({ isActive }) =>
    `flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors md:w-full md:px-4 ${
      isActive
        ? 'bg-chiya text-white shadow-sm'
        : 'text-bean/70 hover:bg-cream hover:text-espresso'
    }`;

  const utilityClass =
    'flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-bean/70 transition-colors hover:bg-cream hover:text-espresso md:w-full md:px-4 md:text-sm';

  return (
    <div className="min-h-screen bg-[#fff8f6] text-bean md:flex">
      <aside className="sticky top-0 z-40 border-b border-espresso/10 bg-white md:fixed md:inset-y-0 md:left-0 md:flex md:w-64 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chiya text-white shadow-sm">
              <Coffee size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-bean md:text-base">{CAFE_NAME}</p>
              <p className="mt-1 truncate text-[10px] font-medium text-bean/50">{user?.displayName} · Owner</p>
            </div>
          </div>
          <span className="hidden rounded-full bg-cream px-2.5 py-1 text-[10px] font-bold text-espresso md:block">ADMIN</span>
        </div>

        <nav aria-label="Owner sections" className="scrollbar-hide flex gap-1 overflow-x-auto border-t border-espresso/5 px-3 py-2 md:flex-col md:gap-1 md:overflow-y-auto md:border-0 md:px-3 md:py-2">
          <p className="hidden px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-bean/35 md:block">Workspace</p>
          {TABS.map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className={linkClass}>
              <tab.icon size={18} className="shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="scrollbar-hide flex gap-1 overflow-x-auto border-t border-espresso/10 bg-cream/50 px-3 py-2 md:mt-auto md:flex-col md:gap-1 md:overflow-visible md:bg-white md:px-3 md:py-4">
          <button onClick={() => navigate('/staff')} className={utilityClass}>
            <ClipboardList size={17} /> Counter
          </button>
          <button onClick={() => navigate('/kitchen')} className={utilityClass}>
            <ChefHat size={17} /> Kitchen
          </button>
          <button onClick={() => setShowChangePw(true)} className={utilityClass}>
            <KeyRound size={17} /> My Password
          </button>
          <button
            onClick={() => logout().then(() => navigate('/login'))}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-chiya transition-colors hover:bg-rose-50 md:w-full md:px-4 md:text-sm"
          >
            <LogOut size={17} /> Logout
          </button>
          <p className="hidden px-4 pt-3 text-[10px] text-bean/40 md:block">Powered by {PLATFORM_NAME}™</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-8 pt-5 sm:px-6 md:ml-64 md:px-8 md:pt-8 xl:px-10">
        <div className="mb-5 hidden items-center justify-between border-b border-espresso/10 pb-5 md:flex">
          <div>
            <p className="text-xs font-semibold text-bean/45">Owner workspace <ChevronRight size={12} className="mx-1 inline" /> {activeTab.label}</p>
            <h1 className="mt-1 text-sm font-bold text-bean">{activeTab.label}</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-espresso/10 bg-white px-3 py-2 text-xs font-semibold text-bean/65">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Signed in as {user?.displayName || 'Owner'}
          </div>
        </div>
        <Suspense fallback={<div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-chiya" size={32} /></div>}>
        <Routes>
          <Route index element={<AnalyticsTab />} />
          <Route path="history" element={<OrderHistoryTab />} />
          <Route path="day-report" element={<DayReportTab />} />
          <Route path="credit" element={<CreditTab />} />
          <Route path="menu" element={<MenuTab />} />
          <Route path="users" element={<UsersTab />} />
          <Route path="qr" element={<QrTab />} />
          <Route path="ordering" element={<OrderGateTab />} />
          <Route path="*" element={<Navigate to="/owner" replace />} />
        </Routes>
        </Suspense>
      </main>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  );
}
