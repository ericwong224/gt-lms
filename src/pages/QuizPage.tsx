import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, getStoredUser } from '@/lib/api';

export function QuizPage() {
  const { id = '' } = useParams();
  const user = getStoredUser();
  const isStaff = user?.role === 'superadmin' || user?.role === 'teacher';
  const qc = useQueryClient();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pin, setPin] = useState('');

  const quizQuery = useQuery({ queryKey: ['quiz', id], queryFn: () => api.quiz(id), enabled: !!id });
  const sessionQuery = useQuery({
    queryKey: ['quizSession', sessionId],
    queryFn: () => api.quizSession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 3000,
  });

  const addQuestionMutation = useMutation({
    mutationFn: () =>
      api.addQuizQuestion(id, {
        question,
        options: options.filter(Boolean),
        correct_index: correctIndex,
      }),
    onSuccess: () => {
      toast.success('題目已新增');
      setQuestion('');
      qc.invalidateQueries({ queryKey: ['quiz', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sessionMutation = useMutation({
    mutationFn: () => api.createQuizSession(id),
    onSuccess: (res) => {
      setSessionId(res.data.id);
      setPin(res.data.pin);
      toast.success(`PIN: ${res.data.pin}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startMutation = useMutation({
    mutationFn: () => api.startQuizSession(sessionId!),
    onSuccess: () => {
      toast.success('測驗已開始');
      qc.invalidateQueries({ queryKey: ['quizSession', sessionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { activity, questions = [] } = quizQuery.data ?? {};
  const session = sessionQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/classes/${activity?.class_id}`} className="text-sm text-muted-foreground hover:text-primary">← 返回班級</Link>
        <h1 className="mt-2 text-3xl font-bold">{activity?.title ?? '測驗'}</h1>
        <p className="text-muted-foreground">Kahoot 風格 — PIN 加入、即時作答</p>
      </div>

      {isStaff && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>新增題目</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>問題</Label>
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
              </div>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={correctIndex === i} onChange={() => setCorrectIndex(i)} />
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const next = [...options];
                      next[i] = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`選項 ${i + 1}`}
                  />
                </div>
              ))}
              <Button
                onClick={() => addQuestionMutation.mutate()}
                disabled={!question.trim() || options.filter(Boolean).length < 2 || addQuestionMutation.isPending}
              >
                新增題目
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>進行測驗</CardTitle>
              <CardDescription>產生 PIN 讓學生加入</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button onClick={() => sessionMutation.mutate()} disabled={questions.length === 0 || sessionMutation.isPending}>
                產生 PIN
              </Button>
              {pin && <Badge className="text-lg px-4 py-1">PIN: {pin}</Badge>}
              {sessionId && (
                <Button variant="secondary" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                  <Play className="h-4 w-4" />
                  開始
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>題目 ({questions.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-md border p-3">
              <p className="font-medium">{i + 1}. {q.question}</p>
              <ul className="mt-2 text-sm text-muted-foreground">
                {q.options.map((o, j) => (
                  <li key={j}>• {o}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      {session?.leaderboard && session.leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>排行榜</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.leaderboard.map((row, i) => (
              <div key={i} className="flex justify-between rounded-md border px-3 py-2">
                <span>{row.name}</span>
                <Badge>{row.total_score}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
