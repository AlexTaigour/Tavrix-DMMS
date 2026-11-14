import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, HOME_BY_ROLE } from '../context/AuthContext';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading, ensureAuth } = useAuth();
  const [checked, setChecked] = useState(Boolean(user));

  useEffect(() => {
    if (user) {
      setChecked(true);
      return;
    }

    let active = true;
    ensureAuth().finally(() => {
      if (active) setChecked(true);
    });
    return () => { active = false; };
  }, [user, ensureAuth]);

  if (loading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-espresso" size={40} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role] || '/'} replace />;
  }
  return children;
}
