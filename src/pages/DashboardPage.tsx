import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, LayoutGrid, Users, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, getStoredUser } from '@/lib/api';

export function DashboardPage() {
  const user = getStoredUser();
  const isStaff = user?.role === 'superadmin' || user?.role === 'teacher';

  const statsQuery = useQuery({ queryKey: ['stats'], queryFn: api.stats });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.classes });

  const stats = statsQuery.data;
  const classes = classesQuery.data?.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">儀表板</h1>
        <p className="text-muted-foreground">你好，{user?.name} · <Badge variant="secondary">{user?.role}</Badge></p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">班級</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.classes ?? '—'}</p>
          </CardContent>
        </Card>
        {isStaff && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">活動</CardTitle>
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats?.activities ?? '—'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">用戶</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats?.users ?? '—'}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>我的班級</CardTitle>
          <CardDescription>最近加入或管理的班級</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {classes.slice(0, 4).map((c) => (
            <Link key={c.id} to={`/classes/${c.id}`} className="block rounded-lg border p-4 transition-colors hover:bg-muted/50">
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-muted-foreground">代碼 {c.code}</p>
            </Link>
          ))}
          {classes.length === 0 && <p className="text-sm text-muted-foreground">尚未加入任何班級</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            快速開始
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link to="/classes" className="text-sm text-primary hover:underline">管理班級 →</Link>
          <Link to="/quiz/join" className="text-sm text-primary hover:underline">輸入 PIN 加入測驗 →</Link>
        </CardContent>
      </Card>
    </div>
  );
}
