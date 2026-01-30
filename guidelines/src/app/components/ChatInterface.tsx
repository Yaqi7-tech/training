import { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, User, Bot } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { VisitorStatus } from '@/app/components/VisitorStatus';
import { SupervisorFeedback } from '@/app/components/SupervisorFeedback';
import { difyApiService } from '@/app/services/api';
import type { Scenario } from '@/app/components/ScenarioSelection';
import type { ChartData, SupervisorEvaluation } from '@/app/services/api';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  openness?: number;
}

interface ChatInterfaceProps {
  scenario: Scenario;
  onBack: () => void;
  onFinish: () => void;
}

function OpeningScreen({ scenario, onStart }: { scenario: Scenario; onStart: () => void }) {
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-3xl w-full">
          <div className="bg-white rounded-3xl shadow-xl p-10 space-y-8">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <span className="text-3xl">👨‍🏫</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                您好！我是您的专属心理咨询培训督导。
              </h1>
              <p className="text-slate-600 leading-relaxed">
                在接下来的模拟咨询中，我将全程在后台陪伴您，实时监控咨访关系，并在必要时给予策略建议。
              </p>
            </div>

            {scenario.visitorProfile && (
              <div className="space-y-6 border-t border-slate-100 pt-8">
                <div className="bg-slate-50 rounded-xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <span>📋</span> 今日来访者档案
                  </h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex">
                      <span className="text-slate-500 w-24 flex-shrink-0">姓名</span>
                      <span className="text-slate-900 font-medium">{scenario.visitorProfile.name}</span>
                    </div>
                    <div className="flex">
                      <span className="text-slate-500 w-24 flex-shrink-0">年龄</span>
                      <span className="text-slate-900">{scenario.visitorProfile.age}</span>
                    </div>
                    <div className="flex">
                      <span className="text-slate-500 w-24 flex-shrink-0">主诉问题</span>
                      <span className="text-slate-900">{scenario.visitorProfile.problem}</span>
                    </div>
                    <div className="flex">
                      <span className="text-slate-500 w-24 flex-shrink-0">防御特征</span>
                      <span className="text-slate-900">{scenario.visitorProfile.defense}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2 mb-3">
                    <span>🎯</span> 本局训练目标
                  </h2>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    {scenario.visitorProfile.trainingGoal}
                  </p>
                </div>
              </div>
            )}

            <div className="text-center pt-4">
              <p className="text-slate-500 mb-6">准备好了吗？请点击下方按钮开启训练！👇</p>
              <Button
                onClick={onStart}
                className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 text-lg h-auto"
              >
                开始新的对话练习
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatInterface({ scenario, onBack, onFinish }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [supervisorEvaluations, setSupervisorEvaluations] = useState<Array<SupervisorEvaluation & { turn: number }>>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleReset = async () => {
    setMessages([]);
    setInput('');
    setChartData(null);
    setSupervisorEvaluations([]);
    setHasStarted(true);
    setIsLoading(true);

    try {
      difyApiService.resetConversations();
      const initialResponse = await difyApiService.callVisitorAgent('你好，我是一名心理咨询师，很高兴认识你。请告诉我你今天想聊些什么？');

      const initialMessage: Message = {
        id: 1,
        role: 'assistant',
        content: initialResponse.text,
        timestamp: new Date(),
        openness: initialResponse.opennessLevel ?? 3
      };

      setMessages([initialMessage]);

      if (initialResponse.chartData) {
        setChartData(initialResponse.chartData);
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const newUserMessage: Message = {
      id: messages.length + 1,
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        sender: m.role === 'user' ? '我' : '来访者',
        content: m.content
      }));

      const supervisorResponse = await difyApiService.callSupervisorAgent(input, conversationHistory, chartData);
      const currentTurn = Math.floor((messages.length + 1) / 2);
      setSupervisorEvaluations(prev => [...prev, { ...supervisorResponse, turn: currentTurn }]);

      const visitorResponse = await difyApiService.callVisitorAgent(input);

      const aiResponse: Message = {
        id: messages.length + 2,
        role: 'assistant',
        content: visitorResponse.text,
        timestamp: new Date(),
        openness: visitorResponse.opennessLevel ?? 4
      };

      setMessages(prev => [...prev, aiResponse]);

      if (visitorResponse.chartData) {
        setChartData(visitorResponse.chartData);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!hasStarted) {
    return <OpeningScreen scenario={scenario} onStart={handleReset} />;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-[2000px] mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回场景选择
            </Button>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <h2 className="font-semibold text-slate-900">{scenario.title}</h2>
              <p className="text-sm text-slate-500">{scenario.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              开始新的对话练习
            </Button>
            <div className="px-3 py-1.5 bg-slate-100 rounded-full text-sm text-slate-600">
              对话轮次: {Math.floor((messages.length - 1) / 2) + 1}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Three Column Layout */}
      <div className="flex-1 flex overflow-hidden max-w-[2000px] mx-auto w-full">
        {/* Left Sidebar - Visitor Status */}
        <div className="w-80 flex-shrink-0">
          <VisitorStatus chartData={chartData} />
        </div>

        {/* Center - Chat Area */}
        <div className="flex-1 flex flex-col bg-white min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-4 ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                        : 'bg-gradient-to-br from-slate-200 to-slate-300'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="w-5 h-5 text-white" />
                    ) : (
                      <Bot className="w-5 h-5 text-slate-600" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div
                    className={`flex-1 ${
                      message.role === 'user' ? 'items-end' : 'items-start'
                    } flex flex-col`}
                  >
                    {/* Openness indicator for assistant messages */}
                    {message.role === 'assistant' && message.openness !== undefined && (
                      <div className="mb-2 px-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">自我暴露</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className={`h-1.5 w-4 rounded-full ${
                                  i <= message.openness! ? 'bg-amber-400' : 'bg-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      className={`px-4 py-3 rounded-2xl max-w-[85%] ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                          : 'bg-slate-100 text-slate-900'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 mt-1.5 px-1">
                      {message.timestamp.toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && messages.length > 0 && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-slate-200 to-slate-300">
                    <Bot className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1 items-start flex flex-col">
                    <div className="px-4 py-3 rounded-2xl bg-slate-100">
                      <span className="text-sm text-slate-500">来访者正在输入</span>
                      <span className="typing-indicator">
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                        <span className="typing-dot"></span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-slate-200 bg-white">
            <div className="px-8 py-6">
              <div className="max-w-3xl mx-auto">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="输入您的回复... (Shift+Enter 换行)"
                      className="min-h-[60px] max-h-[200px] resize-none pr-4 text-sm"
                    />
                  </div>
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="h-[60px] px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    发送
                  </Button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  按 Enter 发送消息，Shift+Enter 换行
                </p>
              </div>

              {/* End Practice Button */}
              <div className="px-8 pb-6">
                <div className="max-w-3xl mx-auto">
                  <Button
                    onClick={onFinish}
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    结束练习
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Supervisor Feedback */}
        <div className="w-96 flex-shrink-0">
          <SupervisorFeedback evaluations={supervisorEvaluations} />
        </div>
      </div>
    </div>
  );
}
