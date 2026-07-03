import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';

export function WallPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [content, setContent] = useState('');

  const wallQuery = useQuery({ queryKey: ['wall', id], queryFn: () => api.wall(id), enabled: !!id, refetchInterval: 5000 });

  const postMutation = useMutation({
    mutationFn: () => api.addWallPost(id, content),
    onSuccess: () => {
      toast.success('已發佈');
      setContent('');
      qc.invalidateQueries({ queryKey: ['wall', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { activity, posts = [] } = wallQuery.data ?? {};

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/classes/${activity?.class_id}`} className="text-sm text-muted-foreground hover:text-primary">← 返回班級</Link>
        <h1 className="mt-2 text-3xl font-bold">{activity?.title ?? '協作牆'}</h1>
        <p className="text-muted-foreground">Padlet 風格 — 即時分享想法與資源</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">新增貼文</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="分享你的想法、連結或問題…" />
          <Button onClick={() => postMutation.mutate()} disabled={!content.trim() || postMutation.isPending}>
            發佈
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{p.author_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{p.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString('zh-HK')}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
