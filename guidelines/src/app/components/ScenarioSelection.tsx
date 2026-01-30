import { MessageSquare, User, Heart, Users, HelpCircle, Baby, Brain, Sparkles, Zap, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface Scenario {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  goal: string;
  color: string;
  icon: React.ReactNode;
}

const scenarios: Scenario[] = [
  {
    id: 1,
    title: '失恋导致人际关系受挫',
    subtitle: '情绪低落、焦虑、逃避',
    description: '你将见到一位刚来到新单位、适应新任务有困难的求助者，目标是理解他们的感受，倾听他们的困扰...',
    goal: '目标: 建立专业帮助关系，通过倾听和提问，展现以来访者为中心的态度，在互动中建立初步连接',
    color: '#71717a',
    icon: <MessageSquare className="w-6 h-6" />,
    visitorProfile: {
      name: '小妍（大学生，20岁）',
      age: '20岁',
      problem: '睡眠质量差，人际关系困扰',
      defense: '高阻抗/高度理性化。她倾向于否认情绪，将心理痛苦归因于外部琐事或生理不适。',
      trainingGoal: '面对一位极力维持"表面平静"的来访者，请尝试突破她的逻辑防御，建立安全信任的咨访同盟，引导她从"抱怨室友"转向"自我觉察"。'
    }
  },
  {
    id: 2,
    title: '问严格教授请求延期',
    subtitle: '情绪低落、焦虑、羞愧、负罪',
    description: '你现在是一位学生，面对一位严格教授，你已经因为延迟交了好几次作业而感到非常焦虑...',
    goal: '目标: 突破倾听与提问，先深入以达成关系，发掘真实需求并主动传达支持，填补期待与现实之间的鸿沟...',
    color: '#52525b',
    icon: <User className="w-6 h-6" />
  },
  {
    id: 3,
    title: '3',
    subtitle: '情绪低落、受挫、羞愧、王权',
    description: '你现在原是医院工作人员，已经找工作半年了没有找到，对怎么解决如何应对没有信心...',
    goal: '目标: 事业挫折、考试人生的问题以及现在就业困难，证明历程能让人怀疑人生信任(目标部分缺失)...',
    color: '#3f3f46',
    icon: <Heart className="w-6 h-6" />
  },
  {
    id: 4,
    title: '4',
    subtitle: '焦虑、羞愧、低落',
    description: '作为上个月刚借给朋友1000元，却遇到一次化别，但是经过五次三次，他总是无法还你...',
    goal: '目标: 自我边界人维护，不牺牲他人的力，或者照顾他的顾虑...',
    color: '#64748b',
    icon: <Users className="w-6 h-6" />
  },
  {
    id: 5,
    title: '5',
    subtitle: '平静、失望',
    description: '你在遇到组员因组了一些毕业前的项目，但组员们毕竟发现已过去几个不同的时间下，且不同...',
    goal: '目标: 表达清晰要求，调整在观察更深入升起共鸣意识，向某起到解决问题...',
    color: '#475569',
    icon: <HelpCircle className="w-6 h-6" />
  },
  {
    id: 6,
    title: '6',
    subtitle: '惰怒、痛苦、失望',
    description: '你人想朋友在那里早已，利用朋友几天了解了更新的消息，对怎么想与那些倾诉...',
    goal: '目标: 私密行为深层度，确在增加初理解上升并支特建议，调整步骤深入...',
    color: '#78716c',
    icon: <Brain className="w-6 h-6" />
  },
  {
    id: 7,
    title: '7',
    subtitle: '委屈、不忿、不定',
    description: '你们本来约好周末一起出去玩儿，你最后助听助前了很多，你的朋友临时告知你说...',
    goal: '目标: 表达适当情绪，经过地筛选好营养自己边境到经验均衡会谈',
    color: '#57534e',
    icon: <Sparkles className="w-6 h-6" />
  },
  {
    id: 8,
    title: '8',
    subtitle: '生气、愤怒、防守、教训',
    description: '你人物两端，也准道破坏加目，来期讲我核心了很坏心，但都确一直没变。所有反...',
    goal: '目标: 防错辨，在倾斜之阁，充分知国旋让自己过去一年的接心病感告知...',
    color: '#44403c',
    icon: <Zap className="w-6 h-6" />
  },
  {
    id: 9,
    title: '9',
    subtitle: '焦虑、疲惫、烦躁',
    description: '你们作圈专家金金全国工作，但最近几个月事业让平奇越经一个人人息，多天枝团时导会有承担...',
    goal: '目标: 表达际断性并新用，用代我修剧的将代筋年秋论会，随低残疗防副...',
    color: '#6b7280',
    icon: <TrendingUp className="w-6 h-6" />
  }
];

interface ScenarioSelectionProps {
  onSelectScenario: (scenario: Scenario) => void;
  onLogout: () => void;
}

export function ScenarioSelection({ onSelectScenario, onLogout }: ScenarioSelectionProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-2">
              选择咨询场景
            </h1>
            <p className="text-slate-500">
              请选择一个场景开始您的培训评测
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={onLogout}
            className="border-slate-200 hover:bg-slate-50"
          >
            退出登录
          </Button>
        </div>

        {/* Scenario Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              onClick={() => onSelectScenario(scenario)}
              className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
            >
              {/* Header - Minimalist badge style */}
              <div className="pt-6 px-6">
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-white text-sm"
                  style={{ backgroundColor: scenario.color }}
                >
                  <span className="w-4 h-4">{scenario.icon}</span>
                  <span className="font-medium">场景 {scenario.id}</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 text-left">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {scenario.title}
                </h3>
                <p className="text-sm text-slate-500 mb-3">
                  情绪状态: {scenario.subtitle}
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
                  {scenario.description}
                </p>
                <div className="pt-4 border-t border-slate-100 mb-4">
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {scenario.goal}
                  </p>
                </div>
                
                {/* Start Button */}
                <Button 
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectScenario(scenario);
                  }}
                >
                  开始新的对话
                </Button>
              </div>

              {/* Hover Effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/0 to-black/0 group-hover:from-black/5 group-hover:to-black/0 transition-all duration-300 pointer-events-none"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 导出Scenario类型以便其他组件使用
export type { Scenario };