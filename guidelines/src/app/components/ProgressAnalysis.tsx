import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, MessageSquare, TrendingUp, Award, Activity, AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';

interface ProgressAnalysisProps {
  userId: string;
  onBack: () => void;
}

interface PracticeSession {
  id: string;
  scenario_name: string;
  total_score: number;
  turns_count: number;
  competency_scores: {
    Professionalism?: number;
    Relational?: number;
    Science?: number;
    Application?: number;
    Education?: number;
    Systems?: number;
  };
  created_at: string;
}

const competencyDimensions = [
  { key: 'Professionalism', label: '专业素养' },
  { key: 'Relational', label: '关系建立' },
  { key: 'Science', label: '科学知识' },
  { key: 'Application', label: '应用能力' },
  { key: 'Education', label: '教育指导' },
  { key: 'Systems', label: '系统思维' }
];

const colors = {
  primary: '#7BC0CD',
  dark: '#4198AC',
  light: '#E8F4F6',
  bg: '#F8FAFC'
};

export function ProgressAnalysis({ userId, onBack }: ProgressAnalysisProps) {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<PracticeSession | null>(null);

  useEffect(() => {
    loadSessions();
  }, [userId]);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      console.log('加载的练习记录:', data);
      console.log('第一条记录的 competency_scores:', data?.[0]?.competency_scores);
      console.log('最后一条记录的 competency_scores:', data?.[data?.length - 1]?.competency_scores);
      setSessions(data || []);
    } catch (error) {
      console.error('加载练习记录失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendData = () => {
    return sessions.map((session, index) => ({
      name: `练习${index + 1}`,
      score: session.total_score,
      date: new Date(session.created_at).toLocaleDateString('zh-CN')
    }));
  };

  const getRadarData = (session: PracticeSession) => {
    console.log('getRadarData 调用的 session:', session.scenario_name, session.competency_scores);
    const radarData = competencyDimensions.map(dim => ({
      dimension: dim.label,
      value: session.competency_scores[dim.key as keyof typeof session.competency_scores] || 0
    }));
    console.log('getRadarData 返回的雷达图数据:', radarData);
    return radarData;
  };

  const getStats = () => {
    if (sessions.length === 0) {
      return { totalSessions: 0, totalTurns: 0, avgScore: 0, maxScore: 0 };
    }
    return {
      totalSessions: sessions.length,
      totalTurns: sessions.reduce((sum, s) => sum + s.turns_count, 0),
      avgScore: sessions.reduce((sum, s) => sum + s.total_score, 0) / sessions.length,
      maxScore: Math.max(...sessions.map(s => s.total_score))
    };
  };

  const stats = getStats();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Activity className="w-16 h-16 mx-auto mb-4 text-slate-300 animate-pulse" />
          <p className="text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  // 首次练习和最新练习
  const firstSession = sessions[0];
  const latestSession = sessions[sessions.length - 1];
  console.log('firstSession:', firstSession?.scenario_name, 'latestSession:', latestSession?.scenario_name);
  console.log('sessions.length >= 2:', sessions.length >= 2);

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <h1 className="text-lg font-semibold text-slate-900">个人进步分析</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Activity className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">暂无练习记录</h2>
            <p className="text-slate-500">完成第一次练习后，这里将显示您的进步分析</p>
          </div>
        ) : (
          <>
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: colors.light }}>
                    <Calendar className="w-5 h-5" style={{ color: colors.dark }} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">练习次数</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalSessions}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: colors.light }}>
                    <MessageSquare className="w-5 h-5" style={{ color: colors.dark }} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">对话轮次</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalTurns}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: colors.light }}>
                    <TrendingUp className="w-5 h-5" style={{ color: colors.dark }} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">平均得分</p>
                    <p className="text-2xl font-bold" style={{ color: colors.dark }}>
                      {stats.avgScore.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: colors.light }}>
                    <Award className="w-5 h-5" style={{ color: colors.dark }} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">最高得分</p>
                    <p className="text-2xl font-bold" style={{ color: colors.dark }}>
                      {stats.maxScore.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 趋势图 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" style={{ color: colors.dark }} />
                综合得分趋势
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getTrendData()} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b' }} stroke="#94a3b8" />
                  <YAxis domain={[0, 10]} tick={{ fill: '#64748b' }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      value.toFixed(1),
                      props.payload.date
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={colors.dark}
                    strokeWidth={2}
                    dot={{ fill: colors.primary, r: 5 }}
                    activeDot={{ r: 7, fill: colors.dark }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 胜任力对比 */}
            {sessions.length >= 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 首次 vs 最新 */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">
                    首次 vs 最新 胜任力对比
                  </h2>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%">
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="dimension" tick={{ fill: '#64748b', fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 9 }} tickCount={6} />
                        <Legend />
                        {firstSession && (
                          <Radar
                            name="首次"
                            dataKey="value"
                            data={getRadarData(firstSession)}
                            stroke="#94a3b8"
                            fill="#94a3b8"
                            fillOpacity={0.2}
                            strokeWidth={1}
                          />
                        )}
                        {latestSession && (
                          <Radar
                            name="最新"
                            dataKey="value"
                            data={getRadarData(latestSession)}
                            stroke={colors.dark}
                            fill={colors.primary}
                            fillOpacity={0.4}
                            strokeWidth={2}
                          />
                        )}
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 最新 vs 平均 */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">
                    最新 vs 平均水平
                  </h2>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%">
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="dimension" tick={{ fill: '#64748b', fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 9 }} tickCount={6} />
                        <Legend />
                        {/* 计算平均胜任力 */}
                        <Radar
                          name="平均"
                          dataKey="value"
                          data={competencyDimensions.map(dim => ({
                            dimension: dim.label,
                            value: sessions.reduce((sum, s) =>
                              sum + (s.competency_scores[dim.key as keyof typeof s.competency_scores] || 0), 0
                            ) / sessions.length
                          }))}
                          stroke="#94a3b8"
                          fill="#94a3b8"
                          fillOpacity={0.2}
                          strokeWidth={1}
                        />
                        {latestSession && (
                          <Radar
                            name="最新"
                            dataKey="value"
                            data={getRadarData(latestSession)}
                            stroke={colors.dark}
                            fill={colors.primary}
                            fillOpacity={0.4}
                            strokeWidth={2}
                          />
                        )}
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* 历史记录列表 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">历史记录</h2>
              <div className="space-y-3">
                {sessions.slice().reverse().map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-slate-500">得分</p>
                        <p className="text-xl font-bold" style={{ color: colors.dark }}>
                          {session.total_score.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{session.scenario_name}</p>
                        <p className="text-sm text-slate-500">
                          {session.turns_count} 轮对话 · {new Date(session.created_at).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <div className="text-slate-400">
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-900">练习详情</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSession(null)}
              >
                关闭
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">场景</p>
                <p className="font-medium text-slate-900">{selectedSession.scenario_name}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">综合得分</p>
                  <p className="text-2xl font-bold" style={{ color: colors.dark }}>
                    {selectedSession.total_score.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">对话轮次</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {selectedSession.turns_count}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">练习时间</p>
                  <p className="text-sm font-medium text-slate-900">
                    {new Date(selectedSession.created_at).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 mb-3">胜任力维度</p>
                <div className="grid grid-cols-2 gap-2">
                  {competencyDimensions.map((dim) => {
                    const score = selectedSession.competency_scores[dim.key as keyof typeof selectedSession.competency_scores] || 0;
                    return (
                      <div key={dim.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-700">{dim.label}</span>
                        <span className="text-sm font-semibold" style={{ color: colors.dark }}>
                          {score.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
