import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';

export function QuizJoinPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const joinMutation = useMutation({
    mutationFn: () => api.joinQuiz(pin),
    onSuccess: (res) => {
      setSessionId(res.session.id);
      toast.success(`已加入：${res.session.quiz_title}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sessionQuery = useQuery({
    queryKey: ['quizSession', sessionId],
    queryFn: () => api.quizSession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 2000,
  });

  const answerMutation = useMutation({
    mutationFn: ({ qid, idx }: { qid: string; idx: number }) =>
      api.submitAnswer(sessionId!, { question_id: qid, answer_index: idx }),
    onSuccess: (res) => {
      toast.success(res.correct ? '答對了！' : '答錯了');
      sessionQuery.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const session = sessionQuery.data?.session;
  const questions = sessionQuery.data?.questions ?? [];
  const currentQ = questions[0];

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Button variant="ghost" onClick={() => navigate('/')}>← 返回</Button>
        <h1 className="text-2xl font-bold">加入測驗</h1>
      </div>

      {!sessionId ? (
        <Card>
          <CardHeader>
            <CardTitle>輸入 PIN</CardTitle>
            <CardDescription>向老師索取 6 位數 PIN</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>PIN</Label>
              <Input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="123456" maxLength={6} />
            </div>
            <Button className="w-full" onClick={() => joinMutation.mutate()} disabled={pin.length < 6 || joinMutation.isPending}>
              加入
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>測驗進行中</span>
              <Badge>{session?.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {session?.status === 'waiting' && <p className="text-muted-foreground">等待老師開始…</p>}
            {session?.status === 'active' && currentQ && (
              <>
                <p className="text-lg font-medium">{currentQ.question}</p>
                <div className="grid gap-2">
                  {currentQ.options.map((opt, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="justify-start"
                      onClick={() => answerMutation.mutate({ qid: currentQ.id, idx: i })}
                      disabled={answerMutation.isPending}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              </>
            )}
            {sessionQuery.data?.leaderboard && sessionQuery.data.leaderboard.length > 0 && (
              <div className="space-y-2 pt-4">
                <p className="text-sm font-medium">排行榜</p>
                {sessionQuery.data.leaderboard.map((row, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{row.name}</span>
                    <span>{row.total_score}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
