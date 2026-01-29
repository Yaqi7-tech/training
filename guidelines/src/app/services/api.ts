interface ChatMessage {
  inputs: Record<string, any>;
  query: string;
  response_mode: 'blocking' | 'streaming';
  conversation_id?: string;
  user: string;
}

interface DifyResponse {
  answer: string;
  conversation_id: string;
}

interface VisitorResponse {
  text: string;
  chartData?: ChartData;
  opennessLevel?: number;
}

interface NewApiResponse {
  reply?: string;
  open_stage?: string;
  conversation_stage_curve?: Array<{ dialogue_count: number; stage: number }>;
  session_emotion_timeline?: Array<{ label: string; turn: number }>;
  stress_curve?: Array<{ turn: number; value: number }>;
  emotion_curve?: Array<{ turn: number; value: number }>;
}

interface ChartData {
  conversation_stage_curve?: Array<{ dialogue_count: number; stage: number }>;
  session_emotion_timeline?: Array<{ label: string; turn: number }>;
  stress_curve?: Array<{ turn: number; value: number }>;
  emotion_curve?: Array<{ turn: number; value: number }>;
}

interface SupervisorEvaluation {
  综合得分: number;
  总体评价: string;
  建议: string;
  跳步判断: {
    是否跳步: boolean;
    跳步类型: string;
    督导建议: string;
  };
}

const getApiConfig = () => {
  // 新的网关地址映射
  const oldToNewMapping: Record<string, string> = {
    'https://dify.ai-role.cn/v1': 'https://gateway.lingxinai.com/dify-test/v1',
    'http://dify.lingxinai.com/v1': 'https://gateway.lingxinai.com/dify-prod/v1',
  };

  // 获取配置的 URL，如果没有则使用默认的测试环境
  let visitorUrl = import.meta.env.VITE_DIFY_VISITOR_API_URL || 'https://gateway.lingxinai.com/dify-test/v1';
  let supervisorUrl = import.meta.env.VITE_DIFY_SUPERVISOR_API_URL || 'https://gateway.lingxinai.com/dify-test/v1';

  // 如果配置的是旧地址，自动转换为新地址
  if (oldToNewMapping[visitorUrl]) {
    visitorUrl = oldToNewMapping[visitorUrl];
  }
  if (oldToNewMapping[supervisorUrl]) {
    supervisorUrl = oldToNewMapping[supervisorUrl];
  }

  const visitorKey = import.meta.env.VITE_DIFY_VISITOR_API_KEY || 'app-2HjDhAbbHNl8N4T2Rcs2C25s';
  const supervisorKey = import.meta.env.VITE_DIFY_SUPERVISOR_API_KEY || 'app-3NPjpb7nkYhFAYtXpFvOShv6';

  return {
    visitor: { url: visitorUrl, key: visitorKey },
    supervisor: { url: supervisorUrl, key: supervisorKey }
  };
};

const API_CONFIG = getApiConfig();

export class DifyApiService {
  private visitorConversationId: string | null = null;
  private supervisorConversationId: string | null = null;

  private async callDifyAPI(
    config: { url: string; key: string },
    message: string,
    conversationId: string | null = null
  ): Promise<DifyResponse> {
    const requestBody: ChatMessage = {
      inputs: {},
      query: message,
      response_mode: 'blocking',
      conversation_id: conversationId || '',
      user: 'counselor_user'
    };

    // 使用本地代理 API 来解决 CORS 问题
    const isProduction = import.meta.env.MODE === 'production';
    const apiUrl = isProduction ? '/api/dify' : '/api/dify';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiUrl: config.url,
        apiKey: config.key,
        payload: requestBody
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  private extractJsonObjectFromText(text: string): string | null {
    const braceCount = { '{': 0, '}': 0 };
    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (startIndex === -1) startIndex = i;
        braceCount['{']++;
      } else if (text[i] === '}') {
        braceCount['}']++;
        if (braceCount['{'] === braceCount['}']) {
          endIndex = i;
          break;
        }
      }
    }

    if (startIndex !== -1 && endIndex !== -1) {
      return text.substring(startIndex, endIndex + 1);
    }

    return null;
  }

  async callVisitorAgent(message: string): Promise<VisitorResponse> {
    const response = await this.callDifyAPI(API_CONFIG.visitor, message, this.visitorConversationId);

    if (response.conversation_id) {
      this.visitorConversationId = response.conversation_id;
    }

    console.log('原始API响应:', response.answer);

    let visitorText = response.answer;
    let chartData: ChartData | null = null;
    let opennessLevel: number | undefined;

    let jsonObjects: string[] = [];
    let startIndex = -1;
    let braceCount = 0;

    for (let i = 0; i < response.answer.length; i++) {
      if (response.answer[i] === '{') {
        if (startIndex === -1) startIndex = i;
        braceCount++;
      } else if (response.answer[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          const jsonStr = response.answer.substring(startIndex, i + 1);
          jsonObjects.push(jsonStr);
          startIndex = -1;
          braceCount = 0;
        }
      }
    }

    console.log('找到的JSON对象数量:', jsonObjects.length);

    if (jsonObjects.length >= 2) {
      try {
        const firstJson = JSON.parse(jsonObjects[0]) as NewApiResponse;
        const secondJson = JSON.parse(jsonObjects[1]) as ChartData;

        if (firstJson.reply) {
          if (typeof firstJson.reply === 'string' && firstJson.reply.includes('{')) {
            try {
              // 先处理转义字符
              let processedReply = firstJson.reply
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"');

              // 尝试提取 markdown 代码块中的 JSON
              const jsonBlockMatch = processedReply.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
              if (jsonBlockMatch) {
                // 从代码块中提取纯 JSON（去掉 markdown 标记）
                const jsonContent = jsonBlockMatch[1].trim();
                const replyJson = JSON.parse(jsonContent) as NewApiResponse;
                if (replyJson.reply) {
                  visitorText = replyJson.reply;
                }
                if (replyJson.open_stage) {
                  const levelMatch = replyJson.open_stage.match(/\bLevel\s+(\d+)\b/i);
                  if (levelMatch) {
                    const levelValue = parseInt(levelMatch[1], 10);
                    if (levelValue >= 1 && levelValue <= 4) {
                      opennessLevel = levelValue;
                    }
                  }
                }
              } else {
                // 没有代码块，尝试直接解析
                const replyJson = JSON.parse(processedReply) as NewApiResponse;
                if (replyJson.reply) {
                  visitorText = replyJson.reply;
                }
                if (replyJson.open_stage) {
                  const levelMatch = replyJson.open_stage.match(/\bLevel\s+(\d+)\b/i);
                  if (levelMatch) {
                    const levelValue = parseInt(levelMatch[1], 10);
                    if (levelValue >= 1 && levelValue <= 4) {
                      opennessLevel = levelValue;
                    }
                  }
                }
              }
            } catch (e) {
              console.error('reply字段JSON解析失败，尝试直接提取:', e);
              const replyMatch = firstJson.reply.match(/"reply":\s*"([^"]+)"/);
              if (replyMatch && replyMatch[1]) {
                visitorText = replyMatch[1].replace(/\\"/g, '"');
              } else {
                visitorText = firstJson.reply;
              }
            }
          } else {
            visitorText = firstJson.reply;
          }

          if (firstJson.open_stage && !opennessLevel) {
            const levelMatch = firstJson.open_stage.match(/\bLevel\s+(\d+)\b/i);
            if (levelMatch) {
              const levelValue = parseInt(levelMatch[1], 10);
              if (levelValue >= 1 && levelValue <= 4) {
                opennessLevel = levelValue;
              }
            }
          }
        }

        if (secondJson.conversation_stage_curve || secondJson.session_emotion_timeline || secondJson.stress_curve || secondJson.emotion_curve) {
          chartData = secondJson;
        }
      } catch (e) {
        console.error('JSON解析失败:', e);
        console.error('第一个JSON:', jsonObjects[0]);
        console.error('第二个JSON:', jsonObjects[1]);
      }
    }

    console.log('提取后的纯文本:', visitorText);
    console.log('提取的图表数据:', chartData);
    console.log('提取的暴露程度:', opennessLevel);

    return { text: visitorText, chartData, opennessLevel };
  }

  async callSupervisorAgent(message: string, conversationHistory: Array<{ sender: string; content: string }>, chartData: ChartData | null): Promise<SupervisorEvaluation> {
    let historyText = '【对话历史（包含来访者情绪、阶段、压力等）】\n';

    if (conversationHistory.length === 0) {
      historyText += '（暂无历史对话）\n';
    } else {
      conversationHistory.forEach(msg => {
        historyText += `${msg.sender}: ${msg.content}\n`;
      });
    }

    historyText += `\n【咨询师本轮回复】\n${message}\n`;

    if (chartData) {
      const chartDataJson = JSON.stringify(chartData, null, 2);
      historyText += `\n【结构化数据】\n${chartDataJson}`;
    }

    const response = await this.callDifyAPI(API_CONFIG.supervisor, historyText, this.supervisorConversationId);

    if (response.conversation_id) {
      this.supervisorConversationId = response.conversation_id;
    }

    try {
      let cleanAnswer = response.answer.trim();

      // 尝试解析新的全JSON格式：{ "result": { "reply": "```json\n{...}\n```" } }
      try {
        const outerJson = JSON.parse(cleanAnswer);
        if (outerJson.result && outerJson.result.reply) {
          let replyContent = outerJson.result.reply;

          // 从markdown代码块中提取JSON
          const jsonBlockMatch = replyContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (jsonBlockMatch) {
            replyContent = jsonBlockMatch[1];
          }

          // 解析内部的JSON
          const innerJson = JSON.parse(replyContent);
          if (innerJson.综合得分 !== undefined || innerJson.总体评价 || innerJson.建议 || innerJson.跳步判断) {
            // 确保所有字段都存在
            if (!innerJson.综合得分) innerJson.综合得分 = 3;
            if (!innerJson.总体评价) innerJson.总体评价 = '暂无评价';
            if (!innerJson.建议) innerJson.建议 = '请继续关注来访者的需求和感受。';
            if (!innerJson.跳步判断) innerJson.跳步判断 = {
              是否跳步: false,
              跳步类型: "无",
              督导建议: "无跳步问题"
            };

            return innerJson as SupervisorEvaluation;
          }
        }
      } catch (e) {
        console.log('不是新的全JSON格式，尝试其他解析方式');
      }

      // 原有的解析逻辑（向后兼容）
      const hasJsonStructure =
        (cleanAnswer.includes('{') && cleanAnswer.includes('}')) ||
        (cleanAnswer.includes('"综合得分"') && cleanAnswer.includes('"总体评价"')) ||
        (cleanAnswer.includes('"跳步判断"'));

      if (hasJsonStructure) {
        let evaluationData: SupervisorEvaluation | null = null;

        try {
          evaluationData = JSON.parse(cleanAnswer);
        } catch (parseError) {
          try {
            const jsonText = this.extractJsonObjectFromText(cleanAnswer);
            if (!jsonText) throw new Error('未找到JSON对象');
            const cleanedJson = jsonText
              .replace(/[\u0000-\u001F\u200B-\u200D\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
              .trim();
            evaluationData = JSON.parse(cleanedJson);
          } catch (secondParseError) {
            throw secondParseError;
          }
        }

        if (evaluationData) {
          if (!evaluationData.综合得分) evaluationData.综合得分 = 3;
          if (!evaluationData.总体评价) evaluationData.总体评价 = '暂无评价';
          if (!evaluationData.建议) evaluationData.建议 = '请继续关注来访者的需求和感受。';
          if (!evaluationData.跳步判断) evaluationData.跳步判断 = {
            是否跳步: false,
            跳步类型: "无",
            督导建议: "无跳步问题"
          };

          return evaluationData;
        } else {
          throw new Error('无法解析JSON格式');
        }
      } else {
        return {
          综合得分: 3,
          总体评价: cleanAnswer,
          建议: "请继续关注来访者的需求和感受。",
          跳步判断: {
            是否跳步: false,
            跳步类型: "无",
            督导建议: "当前回复符合基本要求"
          }
        };
      }
    } catch (error) {
      return {
        综合得分: 3,
        总体评价: response.answer,
        建议: "请继续关注来访者的需求和感受。",
        跳步判断: {
          是否跳步: false,
          跳步类型: "解析错误",
          督导建议: "评价格式解析出现问题，请检查API响应"
        }
      };
    }
  }

  resetConversations() {
    this.visitorConversationId = null;
    this.supervisorConversationId = null;
  }
}

export const difyApiService = new DifyApiService();
