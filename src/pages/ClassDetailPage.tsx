import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LayoutGrid, MessageSquare, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, getStoredUser } from '@/lib/api';

const activityIcons = {
  wall: MessageSquare,
  quiz: LayoutGrid,
  survey: LayoutGrid,
};

export function ClassDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const user = getStoredUser();
  const isStaff = user?.role === 'superadmin' || user?.role === 'teacher';
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [activityType, setActivityType] = useState<'wall' | 'quiz'>('wall');

  const classQuery = useQuery({ queryKey: ['class', id], queryFn: () => api.classDetail(id), enabled: !!id });
  const activitiesQuery = useQuery({ queryKey: ['activities', id], queryFn: () => api.activities(id), enabled: !!id });

  const createMutation = useMutation({
    mutationFn: () => api.createActivity(id, { type: activityType, title }),
    onSuccess: (res) => {
      toast.success('活動已建立');
      setTitle('');
      qc.invalidateQueries({ queryKey: ['activities', id] });
      const path = res.data.type === 'wall' ? `/wall/${res.data.id}` : `/quiz/${res.data.id}`;
      navigate(path);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cls = classQuery.data?.data;
  const activities = activitiesQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/classes" className="text-sm text-muted-foreground hover:text-primary">← 返回班級</Link>
        <h1 className="mt-2 text-3xl font-bold">{cls?.name ?? '載入中…'}</h1>
        {cls && (
          <p className="text-muted-foreground">
            代碼 <Badge variant="outline">{cls.code}</Badge>
            {cls.teacher_name && <> · 老師 {cls.teacher_name}</>}
          </p>
        )}
      </div>

      {isStaff && (
        <Card>
          <CardHeader>
            <CardTitle>新增活動</CardTitle>
            <CardDescription>協作牆（Padlet）或即時測驗（Kahoot）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activityType} onValueChange={(v) => setActivityType(v as 'wall' | 'quiz')}>
              <TabsList>
                <TabsTrigger value="wall">協作牆</TabsTrigger>
                <TabsTrigger value="quiz">測驗</TabsTrigger>
              </TabsList>
              <TabsContent value="wall" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>標題</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brainstorm 主題" />
                </div>
              </TabsContent>
              <TabsContent value="quiz" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>測驗名稱</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="單元小測" />
                </div>
              </TabsContent>
            </Tabs>
            <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending}>
              <Plus className="h-4 w-4" />
              建立活動
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {activities.map((a) => {
          const Icon = activityIcons[a.type as keyof typeof activityIcons] ?? LayoutGrid;
          const href = a.type === 'wall' ? `/wall/${a.id}` : a.type === 'quiz' ? `/quiz/${a.id}` : '#';
          return (
            <Link key={a.id} to={href}>
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader className="flex flex-row items-center gap-3">
                  <Icon className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <CardDescription>
                      <Badge variant="secondary">{a.type}</Badge>
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
        {activities.length === 0 && <p className="text-muted-foreground">此班級尚無活動</p>}
      </div>
    </div>
  );
}
