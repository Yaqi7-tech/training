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
  natural_language_feedback?: string;
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

  // 从文本中提取第一个完整的JSON对象
  private extractFirstJson(text: string): string | null {
    let startIndex = -1;
    let braceCount = 0;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (startIndex === -1) {
          startIndex = i;
        }
        braceCount++;
      } else if (text[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          return text.substring(startIndex, i + 1);
        }
      }
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
              console.log('尝试解析reply字段:', firstJson.reply);

              // 先处理转义字符
              let processedReply = firstJson.reply
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"');

              console.log('处理后的reply:', processedReply);

              // 尝试提取 markdown 代码块中的内容
              const jsonBlockMatch = processedReply.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
              let contentToParse = jsonBlockMatch ? jsonBlockMatch[1].trim() : processedReply;

              console.log('准备解析的内容:', contentToParse);

              // 从内容中提取第一个完整的JSON对象
              const extractedJson = this.extractFirstJson(contentToParse);

              if (extractedJson) {
                console.log('提取到的JSON:', extractedJson);
                const replyJson = JSON.parse(extractedJson) as NewApiResponse;

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
                throw new Error('无法从reply中提取JSON对象');
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
      console.log('督导原始响应:', cleanAnswer);

      let evaluationData: SupervisorEvaluation | null = null;

      // 第一步：尝试解析外层 JSON
      let outerJson: any = null;
      try {
        outerJson = JSON.parse(cleanAnswer);
      } catch (e) {
        console.log('无法解析外层JSON，尝试直接从文本提取');
      }

      let replyContent = '';

      // 从外层JSON中获取 reply 字段
      if (outerJson) {
        if (outerJson.result && outerJson.result.reply) {
          replyContent = outerJson.result.reply;
          console.log('格式1: 从 result.reply 获取内容');
        } else if (outerJson.reply) {
          replyContent = outerJson.reply;
          console.log('格式2: 从 reply 获取内容');
        } else if (outerJson.综合得分 !== undefined || outerJson.总体评价 || outerJson.建议 || outerJson.跳步判断) {
          evaluationData = outerJson as SupervisorEvaluation;
          console.log('格式3: 直接包含督导字段');
        }
      }

      // 第二步：如果有 reply 内容，从中提取督导数据
      if (replyContent && !evaluationData) {
        console.log('reply内容:', replyContent.substring(0, 200) + '...');

        // 使用 extractFirstJson 从 reply 中提取督导数据
        const extractedJson = this.extractFirstJson(replyContent);
        if (extractedJson) {
          console.log('从 reply 中提取到 JSON:', extractedJson.substring(0, 200) + '...');
          try {
            const parsed = JSON.parse(extractedJson);
            // 检查是否有 structured_output 字段（新督导格式）
            if (parsed.structured_output && (
              parsed.structured_output.综合得分 !== undefined ||
              parsed.structured_output.总体评价 ||
              parsed.structured_output.建议 ||
              parsed.structured_output.跳步判断
            )) {
              evaluationData = {
                ...parsed.structured_output,
                natural_language_feedback: parsed.natural_language_feedback
              } as SupervisorEvaluation;
              console.log('成功解析督导数据(structured_output格式):', evaluationData);
            } else if (parsed.综合得分 !== undefined || parsed.总体评价 || parsed.建议 || parsed.跳步判断) {
              evaluationData = parsed as SupervisorEvaluation;
              console.log('成功解析督导数据(直接格式):', evaluationData);
            }
          } catch (e) {
            console.log('解析提取的JSON失败:', e);
          }
        }
      }

      // 第三步：如果还没找到，尝试从整个响应文本中提取
      if (!evaluationData && !outerJson) {
        const extractedJson = this.extractFirstJson(cleanAnswer);
        if (extractedJson) {
          try {
            const parsed = JSON.parse(extractedJson);
            // 检查是否有 structured_output 字段（新督导格式）
            if (parsed.structured_output && (
              parsed.structured_output.综合得分 !== undefined ||
              parsed.structured_output.总体评价 ||
              parsed.structured_output.建议 ||
              parsed.structured_output.跳步判断
            )) {
              evaluationData = {
                ...parsed.structured_output,
                natural_language_feedback: parsed.natural_language_feedback
              } as SupervisorEvaluation;
              console.log('从文本中提取到督导数据(structured_output格式):', evaluationData);
            } else if (parsed.综合得分 !== undefined || parsed.总体评价 || parsed.建议 || parsed.跳步判断) {
              evaluationData = parsed as SupervisorEvaluation;
              console.log('从文本中提取到督导数据(直接格式):', evaluationData);
            } else if (parsed.reply) {
              // 如果提取的是 {"reply": "..."}，再从 reply 中提取
              const innerJson = this.extractFirstJson(parsed.reply);
              if (innerJson) {
                const innerParsed = JSON.parse(innerJson);
                // 检查 innerParsed 是否有 structured_output
                if (innerParsed.structured_output) {
                  evaluationData = {
                    ...innerParsed.structured_output,
                    natural_language_feedback: innerParsed.natural_language_feedback
                  } as SupervisorEvaluation;
                  console.log('从嵌套 reply 的 structured_output 中提取到督导数据:', evaluationData);
                } else {
                  evaluationData = innerParsed as SupervisorEvaluation;
                  console.log('从嵌套的 reply 中提取到督导数据:', evaluationData);
                }
              }
            }
          } catch (e) {
            console.log('从文本提取解析失败:', e);
          }
        }
      }

      if (evaluationData) {
        console.log('处理前的督导数据:', JSON.stringify(evaluationData, null, 2));

        // 确保所有字段都存在
        if (evaluationData.综合得分 === undefined) evaluationData.综合得分 = 3;
        if (evaluationData.总体评价 === undefined || evaluationData.总体评价 === '') evaluationData.总体评价 = '暂无评价';
        if (evaluationData.建议 === undefined || evaluationData.建议 === '') evaluationData.建议 = '请继续关注来访者的需求和感受。';
        if (!evaluationData.跳步判断) evaluationData.跳步判断 = {
          是否跳步: false,
          跳步类型: "无",
          督导建议: "无跳步问题"
        };

        console.log('最终督导数据:', evaluationData);
        console.log('最终督导数据( stringify):', JSON.stringify(evaluationData, null, 2));
        return evaluationData;
      } else {
        throw new Error('无法解析督导数据格式');
      }
    } catch (error) {
      console.error('督导解析错误:', error);
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
