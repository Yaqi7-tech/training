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

// 综合评价响应
interface OverallEvaluation {
  natural_language_feedback: string;
  structured_output: {
    综合得分: number;
    稳定优势: string[];
    结构性短板: string[];
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
  let overallUrl = import.meta.env.VITE_DIFY_API_OVERALL_URL || 'https://gateway.lingxinai.com/dify-test/v1';

  // 如果配置的是旧地址，自动转换为新地址
  if (oldToNewMapping[visitorUrl]) {
    visitorUrl = oldToNewMapping[visitorUrl];
  }
  if (oldToNewMapping[supervisorUrl]) {
    supervisorUrl = oldToNewMapping[supervisorUrl];
  }
  if (oldToNewMapping[overallUrl]) {
    overallUrl = oldToNewMapping[overallUrl];
  }

  const visitorKey = import.meta.env.VITE_DIFY_VISITOR_API_KEY || 'app-2HjDhAbbHNl8N4T2Rcs2C25s';
  const supervisorKey = import.meta.env.VITE_DIFY_SUPERVISOR_API_KEY || 'app-3NPjpb7nkYhFAYtXpFvOShv6';
  const overallKey = import.meta.env.VITE_DIFY_API_OVERALL_KEY || '';

  return {
    visitor: { url: visitorUrl, key: visitorKey },
    supervisor: { url: supervisorUrl, key: supervisorKey },
    overall: { url: overallUrl, key: overallKey }
  };
};

// 移除模块加载时的缓存，改为每次调用时动态获取配置
// const API_CONFIG = getApiConfig();

export class DifyApiService {
  private visitorConversationId: string | null = null;
  private supervisorConversationId: string | null = null;
  private fullSupervisorRecords: FullSupervisorRecord[] = [];  // 存储完整督导记录
  private currentTurnNumber: number = 0;  // 跟踪当前轮次
  private fullSupervisorHistory: string = '';  // 存储督导API的memory_update（完整督导历史）

  // 获取完整督导历史记录（用于综合评价API）
  getFullSupervisorHistory(): string {
    return this.fullSupervisorHistory;
  }

  // 设置当前轮次（在调用督导API前调用）
  setCurrentTurn(turn: number) {
    this.currentTurnNumber = turn;
    console.log('设置当前轮次:', turn);
  }

  private async callDifyAPI(
    configType: 'visitor' | 'supervisor' | 'overall',
    message: string,
    conversationId: string | null = null,
    retries = 2,
    timeoutMs?: number // 默认超时时间
  ): Promise<DifyResponse> {
    // 督导API需要更长的超时时间，因为处理大量数据
    const actualTimeoutMs = timeoutMs || (configType === 'supervisor' ? 180000 : 120000); // 督导3分钟，其他2分钟
    // 每次调用时动态获取最新配置
    const config = getApiConfig()[configType];

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
        const timeoutId = setTimeout(() => controller.abort(), actualTimeoutMs);

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

        // 等待一下再重试，督导API需要更长的等待时间
        await new Promise(resolve => setTimeout(resolve, 3000 * (attempt + 1))); // 增加到3秒递增
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

  // 从文本中提取所有独立的JSON对象
  private extractAllJsonObjects(text: string): any[] {
    const objects: any[] = [];
    let startIndex = -1;
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          if (startIndex === -1) {
            startIndex = i;
          }
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            const jsonStr = text.substring(startIndex, i + 1);
            try {
              const obj = JSON.parse(jsonStr);
              objects.push(obj);
              console.log('提取到JSON对象:', Object.keys(obj));
            } catch (e) {
              console.log('解析JSON失败:', e);
            }
            startIndex = -1;
          }
        }
      }
    }

    return objects;
  }

  async callVisitorAgent(message: string): Promise<VisitorResponse> {
    const response = await this.callDifyAPI('visitor', message, this.visitorConversationId);

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

    // 清理JSON字符串中的控制字符（防止解析错误）
    const cleanJsonString = (jsonStr: string): string => {
      // 只移除未转义的控制字符，保留已经正确转义的字符
      // 匹配：不在反斜杠后的控制字符
      return jsonStr
        .replace(/(?<!\\)\n/g, '\\n')   // 只转义未转义的换行符
        .replace(/(?<!\\)\r/g, '\\r')   // 只转义未转义的回车符
        .replace(/(?<!\\)\t/g, '\\t')   // 只转义未转义的制表符
        // 移除其他不可见控制字符（排除常见的空白字符）
        .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '');
    };

    if (jsonObjects.length >= 2) {
      try {
        // 清理JSON字符串后再解析
        const firstJson = JSON.parse(cleanJsonString(jsonObjects[0])) as NewApiResponse;
        const secondJson = JSON.parse(cleanJsonString(jsonObjects[1])) as ChartData;

        if (firstJson.reply) {
          if (typeof firstJson.reply === 'string' && firstJson.reply.includes('{')) {
            try {
              console.log('尝试解析reply字段:', firstJson.reply);

              // 先清理控制字符，保持转义形式
              let processedReply = cleanJsonString(firstJson.reply);

              console.log('处理后的reply:', processedReply);

              // 尝试提取 markdown 代码块中的内容
              const jsonBlockMatch = processedReply.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
              let contentToParse = jsonBlockMatch ? jsonBlockMatch[1].trim() : processedReply;

              // 再次清理可能的控制字符
              contentToParse = cleanJsonString(contentToParse);

              console.log('准备解析的内容:', contentToParse);

              // 从内容中提取第一个完整的JSON对象
              const extractedJson = this.extractFirstJson(contentToParse);

              if (extractedJson) {
                console.log('提取到的JSON:', extractedJson);
                // 清理后再解析
                const replyJson = JSON.parse(cleanJsonString(extractedJson)) as NewApiResponse;

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
            console.log('open_stage解析:', firstJson.open_stage, '匹配结果:', levelMatch);
            if (levelMatch) {
              const levelValue = parseInt(levelMatch[1], 10);
              console.log('解析到的Level值:', levelValue);
              if (levelValue >= 1 && levelValue <= 4) {
                opennessLevel = levelValue;
                console.log('设置opennessLevel为:', opennessLevel);
              }
            }
          }
        }

        console.log('最终opennessLevel:', opennessLevel);
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
    // 构建包含历史记录的完整 prompt
    let queryText = "";
    
    // 1. 添加对话历史
    if (conversationHistory.length > 0) {
      queryText += "【对话历史】\n";
      conversationHistory.forEach(msg => {
        queryText += `${msg.sender}: ${msg.content}\n`;
      });
      queryText += "\n";
    }

    // 2. 添加咨询师本轮回复
    queryText += `【咨询师本轮回复】\n${message}\n`;

    // 3. 添加结构化数据（包含历史状态）
    if (chartData) {
      queryText += `\n【结构化数据】\n`;
      queryText += JSON.stringify(chartData, null, 2);
    }
    
    console.log('发送给督导的完整Prompt:', queryText);

    const response = await this.callDifyAPI('supervisor', queryText, this.supervisorConversationId);

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

      // 新格式：提取所有独立的JSON对象
      const jsonObjects = this.extractAllJsonObjects(answer);
      console.log('提取到', jsonObjects.length, '个JSON对象');

      for (const obj of jsonObjects) {
        // 1. 处理完整督导记录 (memory_update)
        if (obj.memory_update) {
          const extractedJson = this.extractJsonFromMarkdown(obj.memory_update);
          if (extractedJson) {
            try {
              const parsed = JSON.parse(extractedJson);
              if (parsed.轮次 && parsed.structured_output) {
                fullRecord = {
                  轮次: parsed.轮次,
                  natural_language_feedback: parsed.natural_language_feedback,
                  structured_output: parsed.structured_output
                };
                this.fullSupervisorRecords.push(fullRecord);
                console.log('保存完整督导记录, 轮次:', parsed.轮次);
              }
            } catch (e) {
              console.log('解析memory_update失败:', e);
            }
          }

          // 保存memory_update的原始内容作为完整督导历史记录（用于综合评价API）
          if (obj.memory_update) {
            this.fullSupervisorHistory = obj.memory_update;
            console.log('保存完整督导历史记录（从memory_update）, 长度:', this.fullSupervisorHistory.length);
          }
        }

        // 2. 处理本轮评价 (reply) - 支持多种混合格式
        if (obj.reply) {
          const replyText = obj.reply;
          console.log('处理reply字段:', replyText.substring(0, 100) + '...');

          // 尝试直接解析整个reply为JSON
          try {
            const parsed = JSON.parse(replyText);
            if (parsed.structured_output) {
              evaluationData = {
                ...parsed.structured_output,
                natural_language_feedback: parsed.natural_language_feedback
              } as SupervisorEvaluation;
              console.log('从reply直接解析到督导数据:', evaluationData);
            }
          } catch (e) {
            // reply不是纯JSON，尝试提取其中的结构化输出部分
            // 支持多种格式：
            // 格式1: "### 自然语言反馈 \nxxx\n\n### 结构化输出 \n```json\n{...}```"
            // 格式2: "1. 自然语言反馈：xxx\n\n2. 结构化输出：\n{...}"
            // 格式3: "自然语言反馈xxx结构化输出{...}"

            // 首先尝试从 markdown 代码块中提取 JSON
            const markdownJsonMatch = replyText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
            if (markdownJsonMatch) {
              try {
                const jsonContent = markdownJsonMatch[1].trim();
                const parsed = JSON.parse(jsonContent);
                if (parsed.综合得分 !== undefined) {
                  evaluationData = {
                    综合得分: parsed.综合得分,
                    总体评价: parsed.总体评价 || '',
                    建议: parsed.建议 || '',
                    跳步判断: parsed.跳步判断 || {
                      是否跳步: false,
                      跳步类型: "无",
                      督导建议: "无跳步问题"
                    }
                  };

                  // 提取自然语言反馈部分
                  // 匹配 "### 自然语言反馈" 或 "1. 自然语言反馈" 或 "自然语言反馈"
                  const feedbackMatch = replyText.match(/(?:###\s*|1\.\s*|)(?:自然语言反馈)[：:\s]*\n*(.*?)(?=\n\n###|\n\n\d+\.|\n\n结构化输出|$)/s);
                  if (feedbackMatch) {
                    let feedback = feedbackMatch[1].trim();
                    // 清理可能的 markdown 标记
                    feedback = feedback.replace(/```(?:json)?\s*[\s\S]*?```/g, '').trim();
                    evaluationData.natural_language_feedback = feedback;
                  }

                  console.log('从reply markdown代码块提取到督导数据:', evaluationData);
                }
              } catch (e) {
                console.log('解析markdown代码块中的JSON失败:', e);
              }
            }

            // 如果 markdown 代码块方式没解析出来，尝试其他方式
            if (!evaluationData) {
              // 尝试提取 "结构化输出" 后的 JSON
              const structuredOutputMatch = replyText.match(/(?:###\s*|2\.\s*|)(?:结构化输出)[：:\s]*\n*((?:\n?\{[\s\S]*?\})|(?:```json\s*([\s\S]*?)```))/);
              if (structuredOutputMatch) {
                try {
                  const jsonContent = structuredOutputMatch[1] || structuredOutputMatch[2];
                  const parsed = JSON.parse(jsonContent);
                  if (parsed.综合得分 !== undefined) {
                    evaluationData = {
                      综合得分: parsed.综合得分,
                      总体评价: parsed.总体评价 || '',
                      建议: parsed.建议 || '',
                      跳步判断: parsed.跳步判断 || {
                        是否跳步: false,
                        跳步类型: "无",
                        督导建议: "无跳步问题"
                      }
                    };

                    // 提取自然语言反馈部分
                    const feedbackMatch = replyText.match(/(?:###\s*|1\.\s*|)(?:自然语言反馈)[：:\s]*\n*(.*?)(?=\n\n###|\n\n\d+\.|\n\n结构化输出|$)/s);
                    if (feedbackMatch) {
                      let feedback = feedbackMatch[1].trim();
                      feedback = feedback.replace(/```(?:json)?\s*[\s\S]*?```/g, '').trim();
                      evaluationData.natural_language_feedback = feedback;
                    }

                    console.log('从reply提取到督导数据:', evaluationData);
                  }
                } catch (e) {
                  console.log('解析reply中的structured_output失败:', e);
                }
              }
            }

            // 如果还是没解析出来，尝试旧方式
            if (!evaluationData) {
              const extractedJson = this.extractJsonFromMarkdown(replyText);
              if (extractedJson) {
                try {
                  const parsed = JSON.parse(extractedJson);
                  if (parsed.structured_output) {
                    evaluationData = {
                      ...parsed.structured_output,
                      natural_language_feedback: parsed.natural_language_feedback
                    } as SupervisorEvaluation;
                    console.log('从reply提取到督导数据:', evaluationData);
                  }
                } catch (e2) {
                  console.log('解析reply失败:', e2);
                }
              }
            }
          }
        }

        // 3. 处理胜任力维度
        const competencyFields = ['Professionalism', 'Relational', 'Science', 'Application', 'Education', 'Systems'];
        for (const field of competencyFields) {
          if (obj[field] !== undefined) {
            competencyScores[field as keyof CompetencyScores] = parseFloat(obj[field]);
            console.log(`提取胜任力维度 ${field}:`, obj[field]);
          }
        }
      }

      // 如果新格式解析失败，尝试旧格式（兼容性）
      if (!evaluationData) {
        console.log('新格式解析失败，尝试旧格式');
        competencyScores = this.extractCompetencyScores(answer);

        const fullRecordMatch = answer.match(/完整督导记录\s*```json\s*([\s\S]*?)\n```/);
        if (fullRecordMatch) {
          const extractedJson = this.extractFirstJson(fullRecordMatch[1]);
          if (extractedJson) {
            const parsed = JSON.parse(extractedJson);
            if (parsed.轮次 && parsed.structured_output) {
              fullRecord = {
                轮次: parsed.轮次,
                natural_language_feedback: parsed.natural_language_feedback,
                structured_output: parsed.structured_output
              };
              this.fullSupervisorRecords.push(fullRecord);
            }
          }
        }

        const currentTurnMatch = answer.match(/本轮评价\s*([\s\S]*?)(?=\n\s*(?:Professionalism|Relational)|$)/);
        if (currentTurnMatch) {
          const currentTurnText = currentTurnMatch[1].trim();
          const extractedJson = this.extractJsonFromMarkdown(currentTurnText);
          if (extractedJson) {
            const parsed = JSON.parse(extractedJson);
            if (parsed.structured_output) {
              evaluationData = {
                ...parsed.structured_output,
                natural_language_feedback: parsed.natural_language_feedback
              } as SupervisorEvaluation;
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

        // Fallback: 如果没有从memory_update提取到fullRecord，使用evaluationData创建一个
        if (!fullRecord && this.currentTurnNumber > 0) {
          fullRecord = {
            轮次: this.currentTurnNumber,
            natural_language_feedback: evaluationData.natural_language_feedback || evaluationData.总体评价,
            structured_output: {
              综合得分: evaluationData.综合得分,
              总体评价: evaluationData.总体评价,
              建议: evaluationData.建议,
              跳步判断: evaluationData.跳步判断
            }
          };
          // 检查是否已存在该轮次的记录，避免重复
          const existingIndex = this.fullSupervisorRecords.findIndex(r => r.轮次 === this.currentTurnNumber);
          if (existingIndex === -1) {
            this.fullSupervisorRecords.push(fullRecord);
            console.log('通过fallback保存完整督导记录, 轮次:', this.currentTurnNumber);
          } else {
            console.log('轮次', this.currentTurnNumber, '记录已存在，跳过重复保存');
          }
        }

        return {
          fullRecord: fullRecord || undefined,
          evaluation: evaluationData,
          competencyScores: competencyScores
        };
      } else {
        console.error('无法解析督导数据格式');
        console.error('原始响应长度:', answer.length);
        console.error('原始响应前500字符:', answer.substring(0, 500));
        throw new Error('无法解析督导数据格式');
      }
    } catch (error) {
      console.error('督导解析错误:', error);
      console.error('错误类型:', error.constructor.name);
      console.error('错误消息:', error.message);
      console.error('原始响应:', response.answer?.substring(0, 500));

      // 返回默认值，让对话可以继续
      return {
        evaluation: {
          综合得分: 3,
          总体评价: response.answer || '督导响应解析失败',
          建议: "请继续关注来访者的需求和感受。",
          跳步判断: {
            是否跳步: false,
            跳步类型: "解析错误",
            督导建议: "评价格式解析出现问题"
          }
        },
        competencyScores: {}
      };
    }
  }

  // 调用综合评价API
  async callOverallEvaluationAPI(competencyScores: CompetencyScores): Promise<OverallEvaluation | null> {
    // 检查是否有综合评价API的key
    const config = getApiConfig().overall;
    if (!config.key) {
      console.warn('未配置综合评价API key，跳过综合评价');
      return null;
    }

    console.log('准备调用综合评价API');
    console.log('完整督导历史记录长度:', this.fullSupervisorHistory.length);

    // 使用督导API输出的完整历史记录
    const recordsSummary = this.fullSupervisorHistory || this.fullSupervisorRecords.map(record => {
      return `第${record.轮次}轮：${record.natural_language_feedback}`;
    }).join('\n\n');

    if (!recordsSummary) {
      console.warn('没有督导历史记录，跳过综合评价');
      return null;
    }

    // 构建胜任力维度数据
    const competencySummary = JSON.stringify(competencyScores, null, 2);

    const prompt = `请基于以下督导记录和胜任力维度评分，给出本次咨询的综合评价：

【督导记录】
${recordsSummary}

【胜任力维度评分】
${competencySummary}

请根据以上信息给出综合评价。`;

    try {
      // 综合评价API需要更长的超时时间和重试次数
      const response = await this.callDifyAPI('overall', prompt, null, 2, 300000);

      let answer = response.answer.trim();
      console.log('综合评价原始响应:', answer);

      // 尝试从响应中提取JSON
      const extractedJson = this.extractJsonFromMarkdown(answer);
      if (extractedJson) {
        const parsed = JSON.parse(extractedJson);

        // 检查是否有 structured_output
        if (parsed.structured_output) {
          return {
            natural_language_feedback: parsed.natural_language_feedback || '',
            structured_output: {
              综合得分: parsed.structured_output.综合得分 || 0,
              稳定优势: parsed.structured_output.稳定优势 || [],
              结构性短板: parsed.structured_output.结构性短板 || []
            }
          } as OverallEvaluation;
        }
      }

      console.error('无法解析综合评价响应');
      return null;
    } catch (error) {
      console.error('综合评价API调用失败:', error);
      return null;
    }
  }

  resetConversations() {
    this.visitorConversationId = null;
    this.supervisorConversationId = null;
    this.fullSupervisorRecords = [];  // 清空完整督导记录
    this.fullSupervisorHistory = '';  // 清空完整督导历史记录
    this.currentTurnNumber = 0;  // 重置轮次计数
  }
}

export const difyApiService = new DifyApiService();
