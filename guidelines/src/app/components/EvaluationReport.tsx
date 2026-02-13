import { Download, ArrowLeft, Star, AlertCircle, Award, CheckCircle2, TrendingUp, TrendingDown, Sparkles, Wrench, Activity, Brain, Gauge } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import type { OverallEvaluation, ChartData } from '@/app/services/api';

interface EvaluationReportProps {
  scenarioName: string;
  overallEvaluation?: OverallEvaluation | null;
  competencyScores?: Record<string, number>;
  conversationTurns?: number;
  sessionTurnRecords?: SessionTurnRecord[];
  allChartData?: ChartData | null;
  onStartNew: () => void;
  onBackToScenarios: () => void;
}

interface SessionTurnRecord {
  turn: number;
  counselorMessage: string;
  visitorMessage: string;
  evaluation: any;
  score: number;
  feedback: string;
}

interface CompetencyScores {
  Professionalism?: number;
  Relational?: number;
  Science?: number;
  Application?: number;
  Education?: number;
  Systems?: number;
}

// 统一配色 - 青蓝色系
const colors = {
  primary: '#7BC0CD',
  dark: '#4198AC',
  light: '#E8F4F6',
  bg: '#F8FAFC',
  // 关键帧诊断配色 - 使用青蓝色系
  bestBorder: '#4198AC',    // 深蓝色
  bestBg: '#BFDFD2',        // 浅青色
  worstBorder: '#ECB66C',   // 橙黄色
  worstBg: '#FEF3C7'        // 浅黄色背景
};

const competencyDimensions = [
  { key: 'Professionalism', label: '专业素养' },
  { key: 'Relational', label: '关系建立' },
  { key: 'Science', label: '科学知识' },
  { key: 'Application', label: '应用能力' },
  { key: 'Education', label: '教育指导' },
  { key: 'Systems', label: '系统思维' }
];

const prepareRadarData = (scores: CompetencyScores) => {
  return competencyDimensions.map(dim => ({
    dimension: dim.label,
    fullMark: 10,
    value: scores[dim.key as keyof CompetencyScores] || 0
  }));
};

// 咨询质量趋势图组件
function SessionFlowChart({ sessionTurnRecords }: { sessionTurnRecords: SessionTurnRecord[] }) {
  // 准备趋势图数据
  const trendData = sessionTurnRecords.map(record => ({
    轮次: `第${record.turn}轮`,
    得分: record.score,
    turn: record.turn
  }));

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" style={{ color: colors.dark }} />
        咨询质量趋势
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="轮次"
            tick={{ fill: '#64748b', fontSize: 11 }}
            stroke="#94a3b8"
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            stroke="#94a3b8"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px'
            }}
          />
          <Line
            type="monotone"
            dataKey="得分"
            stroke={colors.dark}
            strokeWidth={2}
            dot={{ fill: colors.primary, r: 4 }}
            activeDot={{ r: 6, fill: colors.dark }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// 关键帧诊断组件
function KeyMomentsAnalysis({ sessionTurnRecords }: { sessionTurnRecords: SessionTurnRecord[] }) {
  if (sessionTurnRecords.length === 0) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: colors.dark }} />
          关键帧诊断
        </h2>
        <p className="text-sm text-slate-500 text-center py-8">暂无对话记录</p>
      </div>
    );
  }

  // 找出最高分和最低分的轮次
  const sortedByScore = [...sessionTurnRecords].sort((a, b) => b.score - a.score);
  const bestMoment = sortedByScore[0];
  const worstMoment = sortedByScore[sortedByScore.length - 1];

  // 提取建议部分 - 统一处理
  const extractSuggestion = (evaluation: any) => {
    // 优先使用结构化输出中的建议
    if (evaluation.evaluation?.建议) {
      return evaluation.evaluation.建议;
    }
    // 如果没有结构化建议，从反馈中提取
    const feedback = evaluation.feedback || evaluation.evaluation?.natural_language_feedback || '';
    if (!feedback) return '暂无建议';

    // 保留原始格式
    const cleanFeedback = feedback.trim();

    // 尝试找到"建议"关键词后的内容
    const suggestionPatterns = [
      /建议[：:]\s*([\s\S]+)/,
      /督导建议[：:]\s*([\s\S]+)/,
      /改进建议[：:]\s*([\s\S]+)/
    ];

    for (const pattern of suggestionPatterns) {
      const match = cleanFeedback.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // 如果找不到明确格式，尝试查找关键词
    const keywordIndex = cleanFeedback.search(/建议|改进|提升/);
    if (keywordIndex >= 0) {
      const colonIndex = Math.max(
        cleanFeedback.lastIndexOf('：', keywordIndex),
        cleanFeedback.lastIndexOf(':', keywordIndex)
      );
      if (colonIndex >= 0) {
        return cleanFeedback.substring(colonIndex + 1).trim();
      }
      return cleanFeedback.substring(keywordIndex).trim();
    }

    // 如果还是找不到，返回完整反馈
    return cleanFeedback;
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4" style={{ color: colors.dark }} />
        关键帧诊断
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 高光时刻 */}
        <div className="rounded-lg p-4 border-2" style={{ backgroundColor: colors.bestBg, borderColor: colors.bestBorder }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4" style={{ color: colors.bestBorder }} />
            <h3 className="text-sm font-semibold" style={{ color: colors.bestBorder }}>高光时刻</h3>
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: colors.bestBorder }}>
              {bestMoment.score.toFixed(1)}分
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">你的话术</p>
              <p className="text-sm text-slate-700 bg-white/70 rounded p-2 leading-relaxed">
                {bestMoment.counselorMessage}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">督导建议</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {extractSuggestion(bestMoment)}
              </p>
            </div>
          </div>
        </div>

        {/* 提升空间 */}
        <div className="rounded-lg p-4 border-2" style={{ backgroundColor: colors.worstBg, borderColor: colors.worstBorder }}>
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-4 h-4" style={{ color: colors.worstBorder }} />
            <h3 className="text-sm font-semibold" style={{ color: colors.worstBorder }}>提升空间</h3>
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: colors.worstBorder }}>
              {worstMoment.score.toFixed(1)}分
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">你的话术</p>
              <p className="text-sm text-slate-700 bg-white/70 rounded p-2 leading-relaxed line-through decoration-red-400 decoration-1">
                {worstMoment.counselorMessage}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">督导建议</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {extractSuggestion(worstMoment)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 来访者状态图表组件 - 与主对话界面保持一致
function VisitorStatusCharts({ allChartData }: { allChartData: ChartData | null }) {
  if (!allChartData) return null;

  // 阶段名称映射（与主对话界面完全一致）
  const stageNames: Record<number, string> = {
    1: '建立关系',
    2: '情绪/问题叙述',
    3: '探索情绪与想法',
    4: '洞察',
    5: '深度处理',
    6: '行动',
    7: '抵抗 / 防御',
    8: '冲突回避',
    9: '反刍',
    10: '突破前兆'
  };

  // 对话阶段数据
  const emotionTimelineData = allChartData.conversation_stage_curve?.map(item => ({
    turn: `第${item.dialogue_count}轮`,
    stage: item.stage
  })) || [];

  // 压力数据 - 直接使用原始值
  const stressData = allChartData.stress_curve?.map(item => ({
    turn: `第${item.turn}轮`,
    value: item.value
  })) || [];

  // 情绪强度数据 - 直接使用原始值
  const emotionIntensityData = allChartData.emotion_curve?.map(item => ({
    turn: `第${item.turn}轮`,
    value: item.value
  })) || [];

  // 情绪时间线列表
  const emotionTimeline = allChartData.session_emotion_timeline || [];

  // 情绪颜色映射
  const stageColors = {
    '愤怒': '#ED8D5A',
    '怀疑': '#EA9E58',
    '压抑': '#ECB66C',
    '开放': '#7BC0CD',
    '平和': '#BFDFD2',
    '欣喜': '#7BC0CD',
    '低迷': '#51999F',
    '失眠': '#51999F',
    '焦虑': '#ECB66C',
    '悲伤': '#4198AC',
    '平静': '#BFDFD2'
  };

  const generateColorForLabel = (label: string): string => {
    if (stageColors[label as keyof typeof stageColors]) {
      return stageColors[label as keyof typeof stageColors];
    }
    return '#7BC0CD';
  };

  const currentEmotionLabel = emotionTimeline.length > 0
    ? emotionTimeline[emotionTimeline.length - 1].label
    : '未知';

  const allEmotionLabels = Array.from(new Set(emotionTimeline.map(item => item.label)));
  const currentStages = allEmotionLabels.map(stage => ({
    name: stage,
    active: stage === currentEmotionLabel,
    color: generateColorForLabel(stage)
  }));

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <h2 className="text-sm font-semibold text-slate-900 mb-4">来访者状态监控</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 对话阶段 */}
        {emotionTimelineData.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2">对话阶段</p>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={emotionTimelineData}>
                <defs>
                  <linearGradient id="colorEmotion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4198AC" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4198AC" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="turn" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis
                  domain={[1, 10]}
                  ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                  tick={{ fontSize: 10 }} stroke="#94a3b8"
                />
                <Tooltip
                  formatter={(value: number) => {
                    const stageName = stageNames[value] || `阶段 ${value}`;
                    return [stageName, ''];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="stage"
                  stroke="#4198AC"
                  strokeWidth={2}
                  fill="url(#colorEmotion)"
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-500 mt-1">阶段 (1-10)</p>
          </div>
        )}

        {/* 压力水平 */}
        {stressData.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2">压力水平</p>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={stressData}>
                <defs>
                  <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EA9E58" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#EA9E58" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="turn" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fontSize: 10 }} stroke="#94a3b8"
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#EA9E58"
                  strokeWidth={2}
                  fill="url(#colorStress)"
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-500 mt-1">压力值 (0-1)</p>
          </div>
        )}

        {/* 情绪强度 */}
        {emotionIntensityData.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2">情绪强度</p>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={emotionIntensityData}>
                <defs>
                  <linearGradient id="colorIntensity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ECB66C" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ECB66C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="turn" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis
                  domain={[-1, 1]}
                  tick={{ fontSize: 10 }} stroke="#94a3b8"
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#ECB66C"
                  strokeWidth={2}
                  fill="url(#colorIntensity)"
                />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-500 mt-1">情绪强度 (-1～1)</p>
          </div>
        )}

        {/* 情绪时间线列表 */}
        {emotionTimeline.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-2">情绪流变</p>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-2 gap-y-1 mb-2">
              {currentStages.map((stage) => (
                <div key={stage.name} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-xs text-slate-600">{stage.name}</span>
                </div>
              ))}
            </div>
            {/* Timeline Bar */}
            <div className="relative h-4 rounded-full overflow-hidden flex">
              {currentStages.map((stage, index) => {
                const color = stage.color;
                const nextColor = index < currentStages.length - 1
                  ? currentStages[index + 1].color
                  : color;
                return (
                  <div
                    key={stage.name}
                    className="flex-1 relative"
                    style={{
                      background: index < currentStages.length - 1
                        ? `linear-gradient(to right, ${color} 0%, ${color} 70%, ${nextColor} 100%)`
                        : color
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EvaluationReport({
  scenarioName,
  overallEvaluation,
  competencyScores = {},
  conversationTurns = 0,
  sessionTurnRecords = [],
  allChartData = null,
  onStartNew,
  onBackToScenarios
}: EvaluationReportProps) {
  const radarData = prepareRadarData(competencyScores as CompetencyScores);

  const strengths = overallEvaluation?.structured_output?.稳定优势
    ? typeof overallEvaluation.structured_output.稳定优势 === 'string'
      ? overallEvaluation.structured_output.稳定优势.split(/\d+\.\s+/).filter(s => s.trim())
      : overallEvaluation.structured_output.稳定优势
    : [];

  const weaknesses = overallEvaluation?.structured_output?.结构性短板
    ? typeof overallEvaluation.structured_output.结构性短板 === 'string'
      ? overallEvaluation.structured_output.结构性短板.split(/\d+\.\s+/).filter(s => s.trim())
      : overallEvaluation.structured_output.结构性短板
    : [];

  const overallScore = overallEvaluation?.structured_output?.综合得分 || 0;

  const getRank = (score: number) => {
    if (score < 4) return '新手上路';
    if (score <= 7) return '合格咨询师';
    return '资深专家';
  };

  const handleExport = () => {
    // 获取存储的对话历史
    const sessionMessages = (window as any).sessionMessages || [];

    // 构建完整对话记录
    const conversationHistory = sessionMessages.map((msg: any) => ({
      role: msg.role === 'user' ? '咨询师' : '来访者',
      content: msg.content,
      timestamp: msg.timestamp
    }));

    // 构建每轮的完整记录（来访-咨询师-督导完整评价）
    const fullTurnRecords = sessionTurnRecords.map((record) => {
      return {
        轮次: record.turn,
        来访者发言: record.visitorMessage,
        咨询师回复: record.counselorMessage,
        督导评价: {
          综合得分: record.score,
          总体评价: record.evaluation?.总体评价 || '',
          建议: record.evaluation?.建议 || '',
          跳步判断: record.evaluation?.跳步判断 || null,
          自然语言反馈: record.feedback || ''
        }
      };
    });

    const exportData = {
      报告信息: {
        场景: scenarioName,
        综合得分: overallScore,
        对话轮次: conversationTurns,
        段位: getRank(overallScore),
        导出时间: new Date().toLocaleString('zh-CN')
      },

      // 完整对话记录（三方）
      对话记录: fullTurnRecords,

      // 综合评价
      综合评价: {
        总体评价: overallEvaluation?.natural_language_feedback || '',
        稳定优势: strengths,
        待提升: weaknesses
      },

      // 胜任力维度平均分
      胜任力维度: competencyScores,

      // 来访者状态监控数据
      来访者状态: {
        对话阶段曲线: allChartData?.conversation_stage_curve,
        情绪时间线: allChartData?.session_emotion_timeline,
        压力曲线: allChartData?.stress_curve,
        情绪曲线: allChartData?.emotion_curve
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `咨询报告_${scenarioName}_${new Date().toLocaleDateString('zh-CN')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToScenarios}
              className="text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <h1 className="text-lg font-semibold text-slate-900">咨询评价报告</h1>
          </div>
          <div className="text-sm text-slate-500">{scenarioName}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* 总体评分卡 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-6">
                {/* 分数 */}
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">综合得分</p>
                  <p className="text-4xl font-bold" style={{ color: colors.dark }}>
                    {overallScore.toFixed(1)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">/ 10</p>
                </div>

                {/* 段位和轮次 */}
                <div className="flex-1 space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ backgroundColor: colors.light }}>
                    <Award className="w-4 h-4" style={{ color: colors.dark }} />
                    <span style={{ color: colors.dark }}>{getRank(overallScore)}</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    完成 <span className="font-semibold">{conversationTurns}</span> 轮对话
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleExport}
              size="sm"
              className="bg-slate-700 hover:bg-slate-800 text-white"
            >
              <Download className="w-4 h-4 mr-1" />
              导出
            </Button>
          </div>
        </div>

        {/* 总体评价 */}
        {overallEvaluation?.natural_language_feedback && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4" style={{ color: colors.dark }} />
              总体评价
            </h3>
            <p className="text-slate-700 leading-relaxed text-sm">
              {overallEvaluation.natural_language_feedback}
            </p>
          </div>
        )}

        {/* 咨询质量趋势图 */}
        {sessionTurnRecords.length > 0 && <SessionFlowChart sessionTurnRecords={sessionTurnRecords} />}

        {/* 关键帧诊断 */}
        {sessionTurnRecords.length > 0 && <KeyMomentsAnalysis sessionTurnRecords={sessionTurnRecords} />}

        {/* 来访者状态监控 */}
        {allChartData && <VisitorStatusCharts allChartData={allChartData} />}

        {/* 优劣势 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 稳定优势 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-slate-900">稳定优势</h3>
            </div>
            <ul className="space-y-2">
              {strengths.slice(0, 3).map((strength, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-semibold mt-0.5">
                    {index + 1}
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed">{strength}</p>
                </li>
              ))}
              {strengths.length === 0 && (
                <li className="text-sm text-slate-400 italic">暂无数据</li>
              )}
            </ul>
          </div>

          {/* 结构性短板 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-900">待提升</h3>
            </div>
            <ul className="space-y-2">
              {weaknesses.slice(0, 3).map((weakness, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-semibold mt-0.5">
                    {index + 1}
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed">{weakness}</p>
                </li>
              ))}
              {weaknesses.length === 0 && (
                <li className="text-sm text-slate-400 italic">暂无数据</li>
              )}
            </ul>
          </div>
        </div>

        {/* 胜任力评估 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">胜任力评估</h2>
          <div className="flex flex-col lg:flex-row gap-5">
            {/* 雷达图 */}
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 10]}
                    tick={{ fill: '#94a3b8', fontSize: 9 }}
                    tickCount={6}
                  />
                  <Radar
                    name="胜任力"
                    dataKey="value"
                    stroke={colors.dark}
                    fill={colors.primary}
                    fillOpacity={0.4}
                    strokeWidth={1.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* 维度得分 */}
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-2">
                {competencyDimensions.map((dim) => {
                  const score = (competencyScores as CompetencyScores)[dim.key as keyof CompetencyScores] || 0;
                  return (
                    <div key={dim.key} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-xs font-medium text-slate-700">{dim.label}</span>
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

        {/* 胜任力评估说明 */}
        {/* 基于 APA 六大胜任力维度。0 表示本次对话未触发该维度场景，显示能力短板。 */}
          <Button
            onClick={onStartNew}
            style={{ backgroundColor: colors.primary }}
            className="text-white hover:opacity-90 px-6"
          >
            开始新的练习
          </Button>
          <Button
            onClick={onBackToScenarios}
            variant="outline"
            className="px-6 border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            选择其他场景
          </Button>
        </div>
      </div>
    </div>
  );
}
