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

// 完整督导记录（用于最后综合评价）
interface FullSupervisorRecord {
  轮次: number;
  natural_language_feedback: string;
  structured_output: {
    综合得分: number;
    总体评价: string;
    建议: string;
    跳步判断: {
      是否跳步: boolean;
      跳步类型: string;
      督导建议: string;
    };
  };
}

// 胜任力维度（用于雷达图）
interface CompetencyScores {
  Professionalism?: number;
  Relational?: number;
  Science?: number;
  Application?: number;
  Education?: number;
  Systems?: number;
}

// 本轮评价（显示在界面）
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

// 督导API完整响应
interface SupervisorResponse {
  // 完整督导记录（累积保存）
  fullRecord?: FullSupervisorRecord;
  // 本轮评价（显示在界面）
  evaluation: SupervisorEvaluation;
  // 胜任力维度（用于雷达图）
  competencyScores: CompetencyScores;
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
  private fullSupervisorRecords: FullSupervisorRecord[] = [];  // 存储完整督导记录

  // 获取所有完整督导记录（用于最后的综合评价）
  getFullSupervisorRecords(): FullSupervisorRecord[] {
    return this.fullSupervisorRecords;
  }

  private async callDifyAPI(
    config: { url: string; key: string },
    message: string,
    conversationId: string | null = null,
    retries = 2
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

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

        console.log(`API调用 (尝试 ${attempt + 1}/${retries + 1}):`, { apiUrl: config.url, message: message.substring(0, 50) + '...' });

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            apiUrl: config.url,
            apiKey: config.key,
            payload: requestBody
          })
        });

        clearTimeout(timeoutId);

        console.log(`API响应状态 (尝试 ${attempt + 1}):`, response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API错误响应 (尝试 ${attempt + 1}):`, errorText);
          throw new Error(`API请求失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log(`API调用成功 (尝试 ${attempt + 1}):`, data);
        return data;
      } catch (error) {
        console.warn(`API调用失败 (尝试 ${attempt + 1}/${retries + 1}):`, error);

        // 最后一次尝试失败，抛出错误
        if (attempt === retries) {
          throw new Error(`API调用失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // 等待一下再重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    throw new Error('Unexpected error');
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

  // 从 markdown 代码块中提取 JSON
  private extractJsonFromMarkdown(text: string): string | null {
    // 匹配 ```json 或 ``` 后跟 JSON 内容
    const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
    const match = text.match(codeBlockRegex);

    if (match && match[1]) {
      const content = match[1].trim();
      // 从内容中提取 JSON 对象
      return this.extractFirstJson(content);
    }

    // 如果没有代码块，尝试直接提取
    return this.extractFirstJson(text);
  }

  // 从文本中提取胜任力维度（例如 "Professionalism：6.0"）
  private extractCompetencyScores(text: string): CompetencyScores {
    const scores: CompetencyScores = {};
    const fields = ['Professionalism', 'Relational', 'Science', 'Application', 'Education', 'Systems'];

    fields.forEach(field => {
      // 匹配 "字段名：数字" 或 "字段名:数字"
      const regex = new RegExp(`${field}[:：]\\s*(\\d+(?:\\.\\d+)?)`, 'i');
      const match = text.match(regex);
      if (match && match[1]) {
        scores[field as keyof CompetencyScores] = parseFloat(match[1]);
        console.log(`提取胜任力维度 ${field}:`, match[1]);
      }
    });

    return scores;
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

  async callSupervisorAgent(message: string, conversationHistory: Array<{ sender: string; content: string }>, chartData: ChartData | null): Promise<SupervisorResponse> {
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
      const answer = response.answer.trim();
      console.log('督导原始响应:', answer);

      // 解析结果
      let fullRecord: FullSupervisorRecord | null = null;
      let evaluationData: SupervisorEvaluation | null = null;
      let competencyScores: CompetencyScores = {};

      // 首先尝试解析为 JSON（兼容旧格式）
      try {
        const outerJson = JSON.parse(answer);

        // 从JSON中提取胜任力维度
        const competencyFields = ['Professionalism', 'Relational', 'Science', 'Application', 'Education', 'Systems'];
        competencyFields.forEach(field => {
          if (outerJson[field] !== undefined) {
            competencyScores[field as keyof CompetencyScores] = outerJson[field];
          }
        });

        // 从本轮评价提取
        if (outerJson['本轮评价']) {
          const currentTurnData = outerJson['本轮评价'];
          if (currentTurnData.reply) {
            const extractedJson = this.extractJsonFromMarkdown(currentTurnData.reply);
            if (extractedJson) {
              const parsed = JSON.parse(extractedJson);
              if (parsed.structured_output) {
                evaluationData = {
                  ...parsed.structured_output,
                  natural_language_feedback: parsed.natural_language_feedback
                } as SupervisorEvaluation;

                if (parsed.轮次 !== undefined) {
                  fullRecord = {
                    轮次: parsed.轮次,
                    natural_language_feedback: parsed.natural_language_feedback,
                    structured_output: parsed.structured_output
                  };
                  this.fullSupervisorRecords.push(fullRecord);
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('不是JSON格式，尝试从文本解析');
      }

      // 如果JSON解析失败或没有找到数据，从文本格式解析
      if (!evaluationData) {
        // 1. 提取胜任力维度（从文本末尾）
        competencyScores = this.extractCompetencyScores(answer);

        // 2. 提取"完整督导记录"部分
        const fullRecordMatch = answer.match(/完整督导记录\s*```json\s*([\s\S]*?)\n```/);
        if (fullRecordMatch) {
          try {
            const fullRecordJson = this.extractFirstJson(fullRecordMatch[1]);
            if (fullRecordJson) {
              const parsed = JSON.parse(fullRecordJson);
              if (parsed.轮次 && parsed.structured_output) {
                fullRecord = {
                  轮次: parsed.轮次,
                  natural_language_feedback: parsed.natural_language_feedback,
                  structured_output: parsed.structured_output
                };
                this.fullSupervisorRecords.push(fullRecord);
                console.log('从文本提取完整督导记录, 轮次:', parsed.轮次);
              }
            }
          } catch (e) {
            console.log('解析完整督导记录失败:', e);
          }
        }

        // 3. 提取"本轮评价"部分
        const currentTurnMatch = answer.match(/本轮评价\s*([\s\S]*?)(?=\n\s*(?:Professionalism|Relational)|$)/);
        if (currentTurnMatch) {
          const currentTurnText = currentTurnMatch[1].trim();
          const extractedJson = this.extractJsonFromMarkdown(currentTurnText);
          if (extractedJson) {
            try {
              const parsed = JSON.parse(extractedJson);
              if (parsed.structured_output) {
                evaluationData = {
                  ...parsed.structured_output,
                  natural_language_feedback: parsed.natural_language_feedback
                } as SupervisorEvaluation;
                console.log('从本轮评价提取到督导数据:', evaluationData);
              }
            } catch (e) {
              console.log('解析本轮评价失败:', e);
            }
          }
        }
      }

      if (evaluationData) {
        // 确保所有字段都存在
        if (evaluationData.综合得分 === undefined) evaluationData.综合得分 = 3;
        if (evaluationData.总体评价 === undefined || evaluationData.总体评价 === '') evaluationData.总体评价 = '暂无评价';
        if (evaluationData.建议 === undefined || evaluationData.建议 === '') evaluationData.建议 = '请继续关注来访者的需求和感受。';
        if (!evaluationData.跳步判断) evaluationData.跳步判断 = {
          是否跳步: false,
          跳步类型: "无",
          督导建议: "无跳步问题"
        };

        console.log('最终督导评价:', evaluationData);
        console.log('胜任力维度:', competencyScores);

        return {
          fullRecord: fullRecord || undefined,
          evaluation: evaluationData,
          competencyScores: competencyScores
        };
      } else {
        throw new Error('无法解析督导数据格式');
      }
    } catch (error) {
      console.error('督导解析错误:', error);
      return {
        evaluation: {
          综合得分: 3,
          总体评价: response.answer,
          建议: "请继续关注来访者的需求和感受。",
          跳步判断: {
            是否跳步: false,
            跳步类型: "解析错误",
            督导建议: "评价格式解析出现问题，请检查API响应"
          }
        },
        competencyScores: {}
      };
    }
  }
                  console.log('保存完整督导记录, 轮次:', parsed.轮次);
                }
              }
            } catch (e) {
              console.log('解析 reply 失败:', e);
            }
          }
        }
      }

      // 如果还没找到，尝试从整个文本提取（兼容旧格式）
      if (!evaluationData) {
        const extractedJson = this.extractFirstJson(cleanAnswer);
        if (extractedJson) {
          try {
            const parsed = JSON.parse(extractedJson);
            if (parsed.structured_output) {
              evaluationData = {
                ...parsed.structured_output,
                natural_language_feedback: parsed.natural_language_feedback
              } as SupervisorEvaluation;
              console.log('从文本提取到督导数据:', evaluationData);
            } else if (parsed.综合得分 !== undefined) {
              evaluationData = parsed as SupervisorEvaluation;
              console.log('直接使用督导数据:', evaluationData);
            }
          } catch (e) {
            console.log('从文本提取解析失败:', e);
          }
        }
      }

      if (evaluationData) {
        // 确保所有字段都存在
        if (evaluationData.综合得分 === undefined) evaluationData.综合得分 = 3;
        if (evaluationData.总体评价 === undefined || evaluationData.总体评价 === '') evaluationData.总体评价 = '暂无评价';
        if (evaluationData.建议 === undefined || evaluationData.建议 === '') evaluationData.建议 = '请继续关注来访者的需求和感受。';
        if (!evaluationData.跳步判断) evaluationData.跳步判断 = {
          是否跳步: false,
          跳步类型: "无",
          督导建议: "无跳步问题"
        };

        console.log('最终督导评价:', evaluationData);
        console.log('胜任力维度:', competencyScores);

        return {
          fullRecord: fullRecord || undefined,
          evaluation: evaluationData,
          competencyScores: competencyScores
        };
      } else {
        throw new Error('无法解析督导数据格式');
      }
    } catch (error) {
      console.error('督导解析错误:', error);
      return {
        evaluation: {
          综合得分: 3,
          总体评价: response.answer,
          建议: "请继续关注来访者的需求和感受。",
          跳步判断: {
            是否跳步: false,
            跳步类型: "解析错误",
            督导建议: "评价格式解析出现问题，请检查API响应"
          }
        },
        competencyScores: {}
      };
    }
  }

  resetConversations() {
    this.visitorConversationId = null;
    this.supervisorConversationId = null;
    this.fullSupervisorRecords = [];  // 清空完整督导记录
  }
}

export const difyApiService = new DifyApiService();
