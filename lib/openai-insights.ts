/**
 * AI 洞察分析工具函数
 * 使用 OpenAI 兼容的 API 进行文章摘要和选题洞察分析
 */

import { ArticleSummary, EnhancedInsight, AIInsightsResult } from '@/types/insights'
import { cleanHtmlContent } from './html-cleaner'

// OpenAI API 配置（主模型：DeepSeek）
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://openrouter.ai/api/v1'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'openai/gpt-4o'

// Fallback API 配置（备用模型：豆包）
const FALLBACK_API_KEY = process.env.FALLBACK_API_KEY || ''
const FALLBACK_API_BASE = process.env.FALLBACK_API_BASE || ''
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || ''

/**
 * 调用 AI API（支持自动切换到备用模型）
 */
async function callOpenAI(messages: Array<{ role: string; content: string }>, temperature: number = 0.7): Promise<string> {
  // 配置参数（主模型）
  const primaryConfig = {
    apiKey: OPENAI_API_KEY,
    apiBase: OPENAI_API_BASE,
    model: OPENAI_MODEL,
    name: 'DeepSeek'
  }

  // 配置参数（备用模型）
  const fallbackConfig = {
    apiKey: FALLBACK_API_KEY,
    apiBase: FALLBACK_API_BASE,
    model: FALLBACK_MODEL,
    name: '豆包'
  }

  // 尝试调用 API
  async function tryAPI(config: { apiKey: string; apiBase: string; model: string; name: string }): Promise<string> {
    if (!config.apiKey) {
      throw new Error(`未配置 ${config.name} API Key`)
    }

    const url = `${config.apiBase}/chat/completions`
    console.log(`[${config.name} API] 请求 URL:`, url)
    console.log(`[${config.name} API] 模型:`, config.model)
    console.log(`[${config.name} API] 消息数量:`, messages.length)

    const requestBody = {
      model: config.model,
      messages,
      temperature,
      max_tokens: 8192,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    console.log(`[${config.name} API] 响应状态:`, response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[${config.name} API] 错误详情:`, errorText)
      throw new Error(`${config.name} API 调用失败: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    console.log(`[${config.name} API] 响应成功，choices 数量:`, data.choices?.length || 0)
    return data.choices[0]?.message?.content || ''
  }

  // 先尝试主模型（DeepSeek）
  try {
    console.log('[AI分析] 尝试使用主模型: DeepSeek')
    return await tryAPI(primaryConfig)
  } catch (primaryError) {
    console.error('[AI分析] 主模型失败，错误:', primaryError instanceof Error ? primaryError.message : primaryError)

    // 检查是否有备用模型配置
    if (!fallbackConfig.apiKey || !fallbackConfig.apiBase) {
      console.error('[AI分析] 未配置备用模型，无法切换')
      throw primaryError
    }

    // 自动切换到备用模型（豆包）
    console.log('[AI分析] 自动切换到备用模型: 豆包')
    try {
      return await tryAPI(fallbackConfig)
    } catch (fallbackError) {
      console.error('[AI分析] 备用模型也失败，错误:', fallbackError instanceof Error ? fallbackError.message : fallbackError)
      throw new Error(`所有 AI 模型均失败。主模型错误: ${primaryError instanceof Error ? primaryError.message : primaryError} | 备用模型错误: ${fallbackError instanceof Error ? fallbackError.message : fallbackError}`)
    }
  }
}

/**
 * 步骤1：批量分析文章，生成结构化摘要
 */
export async function generateArticleSummaries(
  articles: Array<{
    title: string
    content: string
    likes: number
    reads: number
    url?: string
  }>,
  platform: 'wechat' | 'xiaohongshu',
  keyword: string
): Promise<ArticleSummary[]> {
  console.log(`[AI洞察] 开始批量分析 ${articles.length} 篇文章...`)

  // 清洗文章内容
  const cleanedArticles = articles.map(article => ({
    ...article,
    content: platform === 'wechat' ? cleanHtmlContent(article.content) : article.content,
  }))

  // 构建批量分析的 Prompt
  const articlesText = cleanedArticles.map((article, index) => `
【文章 ${index + 1}】
标题：${article.title}
内容：${article.content.substring(0, 3000)}${article.content.length > 3000 ? '...' : ''}
阅读量：${article.reads}
点赞数：${article.likes}
`).join('\n---\n')

  const prompt = `你是一位专业的内容分析师。请分析以下 ${articles.length} 篇关于"${keyword}"的${platform === 'wechat' ? '公众号文章' : '小红书笔记'}。

${articlesText}

请对每篇文章进行详细分析，并以 JSON 数组格式返回结果。每个分析对象应包含以下字段：

{
  "articleTitle": "文章标题",
  "summary": "内容摘要（200-300字，概括文章核心内容和主要观点）",
  "keywords": ["关键词1", "关键词2", ...],  // 5-10个关键词
  "highlights": ["亮点1", "亮点2", ...],  // 3-5个核心观点或创新点
  "targetAudience": "目标受众描述",
  "contentType": "内容类型（如：教程、案例分析、观点评论、工具介绍、行业报告等）"
}

**CRITICAL: 输出格式要求**
1. 直接返回 JSON 数组，不要包含任何其他文字说明
2. **所有标点符号必须是英文半角标点："" (英文双引号), : (英文冒号), [] (英文方括号)**
3. **严禁使用中文标点：""""：】【】（中文标点）**
4. 不要在 JSON 中添加注释
5. 字符串中的引号必须使用反斜杠转义：\\"
6. 不要有尾随逗号

示例：
[
  {
    "articleTitle": "示例标题",
    "summary": "这是一个示例摘要",
    "keywords": ["关键词1", "关键词2"],
    "highlights": ["亮点1", "亮点2"],
    "targetAudience": "目标受众",
    "contentType": "内容类型"
  }
]`

  const messages = [
    {
      role: 'system',
      content: '你是一位专业的内容分析师，擅长提取文章的核心信息和价值点。请始终以标准 JSON 格式返回结构化的分析结果，使用英文标点符号，不要使用中文标点。'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    const response = await callOpenAI(messages, 0.5)
    console.log('[AI洞察] AI 响应原始内容:', response?.substring(0, 500) + '...')

    // 提取 JSON 内容（可能包含在代码块中）
    let jsonText = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    console.log('[AI洞察] 原始 JSON (前200字符):', jsonText?.substring(0, 200))

    // 使用 tryParseJSON 自动处理清理和解析
    let parsedSummaries
    try {
      parsedSummaries = tryParseJSON(jsonText)
    } catch (parseError) {
      console.error('[AI洞察] JSON 解析失败，原始内容:', jsonText?.substring(0, 1000))
      throw new Error(`JSON 解析失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`)
    }

    // 添加指标数据
    const summaries: ArticleSummary[] = parsedSummaries.map((summary: any, index: number) => {
      const article = articles[index]
      return {
        ...summary,
        articleUrl: article.url,
        metrics: {
          likes: article.likes,
          reads: article.reads,
          engagement: article.reads > 0 ? ((article.likes / article.reads) * 100).toFixed(1) + '%' : '0%'
        }
      }
    })

    console.log(`[AI洞察] 成功生成 ${summaries.length} 篇文章摘要`)
    return summaries

  } catch (error) {
    console.error('[AI洞察] 生成文章摘要失败:', error)
    throw new Error(`生成文章摘要失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 清理和修复 AI 返回的 JSON 字符串
 * 处理中文标点、注释、尾随逗号、未转义引号等常见问题
 */
function cleanAIJsonString(jsonString: string): string {
  let cleaned = jsonString

  // 1. 首先替换所有中文全角引号为英文引号（最关键）
  // 使用更精确的 Unicode 匹配，确保所有变体都被替换
  cleaned = cleaned
    .replace(/[\u201c\u201d\u201e\u201f\u275d\u275e\u301d\u301e]/g, '"')   // 中文左右引号 -> 英文
    .replace(/[\u2018\u2019\u201a\u201b\u275b\u275c]/g, "'")   // 中文左右单引号 -> 英文

  // 2. 替换全角标点为半角（在 JSON 结构中）
  cleaned = cleaned
    .replace(/，/g, ',')  // 中文逗号
    .replace(/：/g, ':')  // 中文冒号
    .replace(/；/g, ';')  // 中文分号
    .replace(/（/g, '(')  // 中文左括号
    .replace(/）/g, ')')  // 中文右括号
    .replace(/【/g, '[')  // 中文左方括号
    .replace(/】/g, ']')  // 中文右方括号

  // 3. 移除 JavaScript 风格的注释 (// 和 /* */)
  cleaned = cleaned
    .replace(/\/\/.*$/gm, '')  // 单行注释
    .replace(/\/\*[\s\S]*?\*\//g, '')  // 多行注释

  // 4. 移除尾随逗号（在对象和数组中）
  cleaned = cleaned
    .replace(/,\s*}/g, '}')   // 对象尾随逗号
    .replace(/,\s*]/g, ']')   // 数组尾随逗号

  // 5. 移除控制字符
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '')

  return cleaned.trim()
}

/**
 * 尝试解析 JSON，如果失败则尝试修复后再次解析
 */
function tryParseJSON(jsonString: string): any {
  // 首先尝试标准解析
  try {
    return JSON.parse(jsonString)
  } catch (e) {
    console.log('[JSON修复] 标准解析失败，尝试清理和修复...')
  }

  // 清理 JSON 字符串
  const cleaned = cleanAIJsonString(jsonString)
  console.log('[JSON修复] 清理完成，JSON 长度:', cleaned.length, '(原长度:', jsonString.length, ')')

  // 再次尝试解析
  try {
    const result = JSON.parse(cleaned)
    console.log('[JSON修复] 清理后解析成功')
    return result
  } catch (e) {
    console.error('[JSON修复] 清理后仍然解析失败')
    console.error('[JSON修复] 错误信息:', (e as SyntaxError).message)

    // 提取错误位置附近的内容
    const match = (e as SyntaxError).message?.match(/position (\d+)/)
    if (match) {
      const pos = parseInt(match[1])
      const start = Math.max(0, pos - 100)
      const end = Math.min(cleaned.length, pos + 100)
      console.error('[JSON修复] 错误位置附近内容:', cleaned.substring(start, end))
    }

    throw e
  }
}

/**
 * 步骤2：基于文章摘要生成选题洞察
 */
export async function generateTopicInsights(
  summaries: ArticleSummary[],
  platform: 'wechat' | 'xiaohongshu',
  keyword: string
): Promise<{ insights: EnhancedInsight[]; overallTrends: string[]; recommendedTopics: string[] }> {
  console.log(`[AI洞察] 基于 ${summaries.length} 篇文章摘要生成选题洞察...`)

  // 构建摘要文本
  const summariesText = summaries.map((s, index) => `
【文章 ${index + 1}】${s.articleTitle}
摘要：${s.summary}
关键词：${s.keywords.join('、')}
亮点：${s.highlights.join('；')}
目标受众：${s.targetAudience}
内容类型：${s.contentType}
数据表现：阅读 ${s.metrics.reads}，点赞 ${s.metrics.likes}，互动率 ${s.metrics.engagement}
`).join('\n---\n')

  const prompt = `你是一位资深的内容策略专家。基于以下 ${summaries.length} 篇关于"${keyword}"的${platform === 'wechat' ? '公众号文章' : '小红书笔记'}摘要，请进行深度的选题洞察分析。

${summariesText}

请从以下角度进行分析：
1. 识别内容趋势和热点话题
2. 分析读者关注点和痛点
3. 发现内容差异化机会
4. 提供具体的创作建议

请生成至少 5 条（可以更多）结构化的选题洞察，并以 JSON 格式返回：

{
  "insights": [
    {
      "title": "洞察标题（简洁有力，10-20字）",
      "description": "详细描述（100-200字，深入分析这个洞察背后的原因和价值）",
      "supportingArticles": ["支撑文章1的标题", "支撑文章2的标题"],  // 引用了哪些文章
      "creativeAdvice": "创作建议（具体可执行的内容创作建议，50-100字）",
      "relatedKeywords": ["相关关键词1", "相关关键词2"],
      "trend": "rising"  // 或 "stable" 或 "declining"
    }
  ],
  "overallTrends": ["整体趋势1", "整体趋势2", "整体趋势3"],  // 3-5个整体趋势总结
  "recommendedTopics": ["推荐选题1", "推荐选题2", "推荐选题3"]  // 3-5个具体的推荐选题方向
}

请确保：
- 洞察数量至少 5 条，每条都有实际价值
- supportingArticles 中的文章标题必须来自上述文章列表
- creativeAdvice 要具体可执行，不要泛泛而谈
- 直接返回 JSON，不要包含任何其他文字说明

**CRITICAL: 输出格式要求**
1. 直接返回 JSON 对象，不要包含任何其他文字说明
2. **所有标点符号必须是英文半角标点："" (英文双引号), : (英文冒号), [] (英文方括号)**
3. **严禁使用中文标点：""""：】【】（中文标点）**
4. 不要在 JSON 中添加注释
5. 字符串中的引号必须使用反斜杠转义：\\"
6. 不要有尾随逗号

示例：
{
  "insights": [{"title": "示例洞察", "description": "示例描述", "supportingArticles": ["文章1"], "creativeAdvice": "示例建议", "relatedKeywords": ["关键词1"], "trend": "rising"}],
  "overallTrends": ["趋势1", "趋势2"],
  "recommendedTopics": ["选题1", "选题2"]
}`

  const messages = [
    {
      role: 'system',
      content: '你是一位资深的内容策略专家，擅长从大量内容中提炼出有价值的选题洞察和创作建议。请始终以标准 JSON 格式返回结构化的分析结果，使用英文标点符号，不要使用中文标点。'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    const response = await callOpenAI(messages, 0.7)
    console.log('[AI洞察] AI 响应原始内容:', response)

    // 提取 JSON 内容
    let jsonText = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    console.log('[AI洞察] 原始 JSON (前200字符):', jsonText?.substring(0, 200))

    // 使用 tryParseJSON 自动处理清理和解析
    const result = tryParseJSON(jsonText)

    console.log(`[AI洞察] 成功生成 ${result.insights?.length || 0} 条选题洞察`)
    return result

  } catch (error) {
    console.error('[AI洞察] 生成选题洞察失败:', error)
    throw new Error(`生成选题洞察失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 完整的 AI 洞察分析流程
 */
export async function generateAIInsights(
  articles: Array<{
    title: string
    content: string
    likes: number
    reads: number
    url?: string
  }>,
  platform: 'wechat' | 'xiaohongshu',
  keyword: string
): Promise<AIInsightsResult> {
  console.log('[AI洞察] 开始完整的 AI 洞察分析流程...')
  console.log(`[AI洞察] 关键词: ${keyword}, 平台: ${platform}, 文章数: ${articles.length}`)

  try {
    // 步骤1：生成文章摘要
    console.log('[AI洞察] 步骤1/2: 生成文章摘要...')
    const summaries = await generateArticleSummaries(articles, platform, keyword)

    // 步骤2：生成选题洞察
    console.log('[AI洞察] 步骤2/2: 生成选题洞察...')
    const { insights, overallTrends, recommendedTopics } = await generateTopicInsights(summaries, platform, keyword)

    const result: AIInsightsResult = {
      summaries,
      insights,
      overallTrends,
      recommendedTopics
    }

    console.log('[AI洞察] 完整分析流程成功完成')
    return result

  } catch (error) {
    console.error('[AI洞察] AI 洞察分析失败:', error)
    throw error
  }
}

/**
 * 清理markdown格式，但保留加粗标记用于小标题
 */
function cleanMarkdownFormat(content: string): string {
  return content
    // 移除标题标记（但保留加粗的小标题）
    .replace(/^#{1,6}\s+/gm, '')
    // 保留加粗标记（用于小标题）
    // .replace(/\*\*([^*]+)\*\*/g, '$1')  // 注释掉这行，保留加粗
    // 移除斜体标记
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    // 移除链接，保留文本
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 移除代码块
    .replace(/```[^`]*```/g, '')
    // 移除行内代码
    .replace(/`([^`]+)`/g, '$1')
    // 移除列表标记，保留数字
    .replace(/^[-*]\s+/gm, '')
    // 移除有序列表标记，保留数字
    .replace(/^\d+\.\s+/gm, (match) => match.replace(/^\d+\.\s+/, ''))
    // 清理多余的空行
    .replace(/\n{3,}/g, '\n\n')
    // 移除首尾空白
    .trim()
}

/**
 * 生成文章内容
 */
export async function generateArticle(
  topic: {
    title: string
    description: string
    fullDescription?: string
    creativeAdvice?: string
    relatedKeywords?: string[]
  },
  params: {
    length: string
    style: string
    imageCount: number
    platform?: 'wechat' | 'xiaohongshu'
  }
): Promise<{ title: string; content: string }> {
  console.log('[AI生成] 开始生成文章...')
  console.log(`[AI生成] 选题: ${topic.title}`)
  console.log(`[AI生成] 参数: 长度=${params.length}, 风格=${params.style}`)

  // 风格映射
  const styleMap: Record<string, string> = {
    'professional': '专业严谨，使用规范的行业术语',
    'casual': '轻松活泼，使用通俗易懂的语言',
    'storytelling': '故事叙述，通过故事和案例来表达观点',
    'educational': '教育科普，系统地讲解知识点',
    'emotional': '情感共鸣，触动读者情感'
  }

  const styleDescription = styleMap[params.style] || '专业严谨'

  // 构建提示词
  const prompt = `请基于以下选题信息创作一篇高质量的文章：

**选题标题**：${topic.title}

**选题洞察**：${topic.fullDescription || topic.description}

${topic.creativeAdvice ? `**创作建议**：${topic.creativeAdvice}` : ''}

${topic.relatedKeywords && topic.relatedKeywords.length > 0 ? `**相关关键词**：${topic.relatedKeywords.join('、')}` : ''}

**创作要求**：
1. 文章长度：${params.length}字左右
2. 写作风格：${styleDescription}
3. 目标平台：${params.platform === 'xiaohongshu' ? '小红书' : '公众号'}
4. 内容结构：
   - 吸引人的标题
   - 清晰的小标题（使用**加粗**格式）
   - 逻辑清晰的段落
   - 适当使用列表（用数字序号，如1.、2.、3.）
5. 内容要求：
   - 有实际价值，不要泛泛而谈
   - 包含具体的案例、数据或方法
   - 结尾有总结或行动建议
   - 适合${params.platform === 'xiaohongshu' ? '小红书' : '公众号'}平台的阅读习惯

请返回JSON格式：
{
  "title": "吸引人的文章标题（15-30字）",
  "content": "完整的文章正文（支持Markdown格式，小标题使用**加粗**，段落用空行分隔，列表用数字序号）"
}

注意：直接返回JSON，不要包含任何其他文字说明。`

  const messages = [
    {
      role: 'system',
      content: `你是一位专业的内容创作者，擅长撰写${params.platform === 'xiaohongshu' ? '小红书笔记' : '公众号文章'}。你的文章总是有价值、有深度、可读性强。`
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    const response = await callOpenAI(messages, 0.5)
    console.log('[AI生成] AI 响应原始内容:', response.substring(0, 200) + '...')

    // 提取 JSON 内容
    let jsonText = response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    // 使用 tryParseJSON 自动处理清理和解析
    const article = tryParseJSON(jsonText)

    // 清理markdown格式，转换为纯文本
    const cleanContent = cleanMarkdownFormat(article.content)

    console.log('[AI生成] 文章生成成功')
    console.log(`[AI生成] 标题: ${article.title}`)
    console.log(`[AI生成] 内容长度: ${cleanContent.length} 字符`)

    return {
      title: article.title,
      content: cleanContent
    }

  } catch (error) {
    console.error('[AI生成] 生成文章失败:', error)
    throw new Error(`生成文章失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

// 导出新函数供其他模块使用
export { cleanMarkdownFormat }
