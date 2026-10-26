import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ToastHost from './components/Toast';
import { Loader2 } from 'lucide-react';
import { PLATFORM_NAME, PLATFORM_TAGLINE, PLATFORM_COMPANY, PLATFORM_COMPANY_URL } from './utils/brand';

const CustomerView = lazy(() => import('./views/CustomerView'));
const OrderTrack = lazy(() => import('./views/OrderTrack'));
const MyOrders = lazy(() => import('./views/MyOrders'));
const Login = lazy(() => import('./views/Login'));
const StaffView = lazy(() => import('./views/StaffView'));
const KitchenView = lazy(() => import('./views/KitchenView'));
const OwnerDashboard = lazy(() => import('./views/owner/OwnerDashboard'));

function RouteLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading page">
      <Loader2 className="animate-spin text-chiya" size={36} />
    </div>
  );
}

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <ToastHost />
        <div className="flex-1">
          <Suspense fallback={<RouteLoader />}>
          <Routes>
          <Route path="/" element={<CustomerView />} />
          <Route path="/orders" element={<MyOrders />} />
          <Route path="/track/:publicCode" element={<OrderTrack />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/staff"
            element={
              <ProtectedRoute roles={['staff', 'owner']}>
                <StaffView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kitchen"
            element={
              <ProtectedRoute roles={['kitchen', 'owner']}>
                <KitchenView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/*"
            element={
              <ProtectedRoute roles={['owner']}>
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />
          {/* legacy bookmarks */}
          <Route path="/admin" element={<Navigate to="/login" replace />} />
          <Route path="/admin/login" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </div>
        <footer className="border-t border-bean/10 bg-white/60 px-6 py-4 text-center text-[10px] text-bean/60">
          <p className="font-black tracking-wide">Powered by {PLATFORM_NAME}™</p>
          <p className="mt-0.5">{PLATFORM_TAGLINE} · A product from <a href={PLATFORM_COMPANY_URL} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2 hover:text-chiya">{PLATFORM_COMPANY}</a></p>
        </footer>
      </div>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
