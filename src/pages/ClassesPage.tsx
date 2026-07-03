import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, getStoredUser } from '@/lib/api';

export function ClassesPage() {
  const user = getStoredUser();
  const isStaff = user?.role === 'superadmin' || user?.role === 'teacher';
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.classes });

  const createMutation = useMutation({
    mutationFn: () => api.createClass({ name, description }),
    onSuccess: () => {
      toast.success('班級已建立');
      setName('');
      setDescription('');
      qc.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const joinMutation = useMutation({
    mutationFn: () => api.joinClass(joinCode),
    onSuccess: () => {
      toast.success('已加入班級');
      setJoinCode('');
      qc.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const classes = classesQuery.data?.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">班級</h1>
        <p className="text-muted-foreground">建立或加入班級，開始教學活動</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {isStaff && (
          <Card>
            <CardHeader>
              <CardTitle>建立班級</CardTitle>
              <CardDescription>老師 / 管理員專用</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>班級名稱</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：中三數學" />
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending}>
                <Plus className="h-4 w-4" />
                建立
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>加入班級</CardTitle>
            <CardDescription>輸入老師提供的 6 位代碼</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>班級代碼</Label>
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" />
            </div>
            <Button onClick={() => joinMutation.mutate()} disabled={!joinCode.trim() || joinMutation.isPending}>
              加入
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <Link key={c.id} to={`/classes/${c.id}`}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle className="text-lg">{c.name}</CardTitle>
                <CardDescription>{c.description || '—'}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Badge variant="outline">代碼 {c.code}</Badge>
                {c.student_count != null && <Badge variant="secondary">{c.student_count} 人</Badge>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
