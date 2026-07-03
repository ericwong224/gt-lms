import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { GraduationCap, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { clearAuth, getStoredUser } from '@/lib/api';

export function AppLayout() {
  const navigate = useNavigate();
  const user = getStoredUser();

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <button type="button" className="flex items-center gap-2 font-semibold" onClick={() => navigate('/')}>
            <GraduationCap className="h-6 w-6 text-primary" />
            GT LMS
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearAuth();
                navigate('/login');
              }}
            >
              <LogOut className="h-4 w-4" />
              登出
            </Button>
          </div>
        </div>
      </header>
      <Separator />
      <main className="container py-8">
        <Outlet />
      </main>
    </div>
  );
}
