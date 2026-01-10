/**
 * 即梦AI图片生成工具
 * 使用即梦4.0模型生成文章配图
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'

// 即梦AI API 配置 (火山引擎豆包API)
const JIMENG_AI_KEY = process.env.JIMENG_API_KEY || ''
const JIMENG_AI_BASE = process.env.JIMENG_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
const JIMENG_AI_MODEL = process.env.JIMENG_MODEL || 'doubao-seedream-4-5-251128'

// OpenAI API 配置（用于生成图片提示词）
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://api.deepseek.com'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'deepseek-chat'

// 本地图片存储路径配置
const LOCAL_IMAGES_DIR = path.join(process.cwd(), 'public', 'generated-images')

/**
 * 确保图片存储目录存在
 */
function ensureImagesDir(): void {
  if (!fs.existsSync(LOCAL_IMAGES_DIR)) {
    fs.mkdirSync(LOCAL_IMAGES_DIR, { recursive: true })
  }
}

/**
 * 从URL下载图片并保存到本地
 * @param imageUrl 原始图片URL
 * @param filename 本地文件名
 * @returns 本地图片URL路径
 */
async function downloadImage(imageUrl: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ensureImagesDir()
    const localPath = path.join(LOCAL_IMAGES_DIR, filename)

    console.log(`[即梦AI] 下载图片: ${imageUrl.substring(0, 80)}... -> ${filename}`)

    https.get(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: HTTP ${response.statusCode}`))
        return
      }

      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        fs.writeFileSync(localPath, buffer)
        const localUrl = `/generated-images/${filename}`
        console.log(`[即梦AI] 图片保存成功: ${localUrl}`)
        resolve(localUrl)
      })
    }).on('error', (err) => {
      reject(new Error(`下载失败: ${err.message}`))
    })
  })
}

/**
 * 生成唯一的文件名
 */
function generateFilename(index: number): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `img-${timestamp}-${index}-${random}.jpeg`
}

/**
 * 调用 OpenAI API 生成图片提示词
 */
async function generateImagePrompts(
  articleTitle: string,
  articleContent: string,
  imageCount: number
): Promise<string[]> {
  if (imageCount === 0) return []

  console.log(`[即梦AI] 开始生成 ${imageCount} 个图片提示词...`)

  if (!OPENAI_API_KEY) {
    throw new Error('未配置 OPENAI_API_KEY')
  }

  // 截取文章内容（避免太长）
  const contentPreview = articleContent.substring(0, 2000)

  const prompt = `根据文章标题和内容，生成 ${imageCount} 个简洁的图片提示词。

标题：${articleTitle}
内容：${contentPreview}${articleContent.length > 1000 ? '...' : ''}

要求：
1. 每个提示词50字以内，简洁具体
2. 适合生成插图风格
3. 覆盖文章不同要点

请返回 JSON 格式：
{
  "prompts": ["提示词1", "提示词2", "提示词3"]
}

注意：直接返回 JSON，不要包含任何其他文字说明。`

  const messages = [
    {
      role: 'system',
      content: '你是一位专业的视觉设计师，擅长为文章内容设计配图方案，熟悉即梦AI的生成能力。'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  try {
    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API 调用失败: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || ''

    // 提取 JSON 内容
    let jsonText = content
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1]
    }

    const result = JSON.parse(jsonText)
    const prompts = result.prompts || []

    console.log(`[即梦AI] 成功生成 ${prompts.length} 个提示词`)
    prompts.forEach((p: string, i: number) => {
      console.log(`[即梦AI] 提示词 ${i + 1}: ${p}`)
    })

    return prompts

  } catch (error) {
    console.error('[即梦AI] 生成提示词失败:', error)
    throw new Error(`生成图片提示词失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

/**
 * 调用即梦AI API 生成单张图片 (使用豆包API)
 */
async function generateSingleImage(prompt: string, retryCount = 0): Promise<string | null> {
  if (!JIMENG_AI_KEY) {
    throw new Error('未配置 JIMENG_AI_KEY')
  }

  const maxRetries = 1 // 并行模式下减少重试次数
  const timeout = 45000 // 45秒超时，即梦AI通常更快

  console.log(`[即梦AI] 生成图片，提示词: ${prompt.substring(0, 100)}...`)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    // 使用豆包API标准格式
    const requestBody = {
      "model": JIMENG_AI_MODEL,
      "prompt": prompt,
      "size": "2K",
      "watermark": false
    }

    const response = await fetch(JIMENG_AI_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JIMENG_AI_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[即梦AI] API 调用失败: ${response.status} ${errorText}`)

      // 如果是频控错误且还有重试次数，等待后重试
      if (response.status === 429 && retryCount < maxRetries) {
        const waitTime = (retryCount + 1) * 3000 // 3秒、6秒递增
        console.log(`[即梦AI] 遇到频控限制，等待 ${waitTime}ms 后重试...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return generateSingleImage(prompt, retryCount + 1)
      }

      throw new Error(`即梦AI API 调用失败: ${response.status}`)
    }

    const data = await response.json()

    // 根据豆包API的响应格式提取图片URL
    const imageUrl = data.data?.[0]?.url || data.image_url

    if (!imageUrl) {
      console.error('[即梦AI] 响应数据:', JSON.stringify(data, null, 2))
      throw new Error('未能从响应中获取图片URL')
    }

    console.log(`[即梦AI] 图片生成成功: ${imageUrl.substring(0, 80)}...`)
    return imageUrl

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[即梦AI] 请求超时')
    } else {
      console.error('[即梦AI] 生成图片失败:', error)
    }

    // 如果还有重试次数，重试
    if (retryCount < maxRetries) {
      console.log(`[即梦AI] 重试生成图片 (${retryCount + 1}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
      return generateSingleImage(prompt, retryCount + 1)
    }

    // 达到最大重试次数，返回 null
    return null
  }
}

/**
 * 批量生成文章配图（主函数）
 * @param articleTitle 文章标题
 * @param articleContent 文章内容
 * @param imageCount 图片数量
 * @returns 图片URL数组
 */
export async function generateArticleImagesWithJimeng(
  articleTitle: string,
  articleContent: string,
  imageCount: number
): Promise<string[]> {
  if (imageCount === 0) return []

  console.log(`[即梦AI] 开始为文章生成 ${imageCount} 张配图`)
  console.log(`[即梦AI] 文章标题: ${articleTitle}`)

  try {
    // Step 1: 生成图片提示词
    const prompts = await generateImagePrompts(articleTitle, articleContent, imageCount)

    if (prompts.length === 0) {
      console.warn('[即梦AI] 未生成任何提示词，跳过图片生成')
      return []
    }

    // Step 2: 并行生成所有图片（大幅提升速度）
    console.log(`[即梦AI] 开始并行生成 ${prompts.length} 张图片...`)

    // 创建所有图片生成任务
    const imagePromises = prompts.map((prompt, index) => {
      console.log(`[即梦AI] 启动生成第 ${index + 1}/${prompts.length} 张图片任务...`)
      return generateSingleImage(prompt)
    })

    // 等待所有图片生成完成
    const results = await Promise.all(imagePromises)

    // 收集成功的图片URL并下载到本地
    const imageUrls: string[] = []
    for (let index = 0; index < results.length; index++) {
      const imageUrl = results[index]
      if (imageUrl) {
        try {
          // 下载图片到本地
          const filename = generateFilename(index)
          const localUrl = await downloadImage(imageUrl, filename)
          imageUrls.push(localUrl)
          console.log(`[即梦AI] 第 ${index + 1} 张图片生成并保存成功`)
        } catch (error) {
          console.error(`[即梦AI] 第 ${index + 1} 张图片下载失败:`, error)
          // 如果下载失败，仍然返回原始URL（虽然可能无法显示）
          imageUrls.push(imageUrl)
        }
      } else {
        console.warn(`[即梦AI] 第 ${index + 1} 张图片生成失败，跳过`)
      }
    }

    console.log(`[即梦AI] 成功生成 ${imageUrls.length}/${imageCount} 张图片`)
    return imageUrls

  } catch (error) {
    console.error('[即梦AI] 生成配图失败:', error)
    // 不抛出错误，返回空数组，不影响文章生成流程
    return []
  }
}

export default {
  generateArticleImagesWithJimeng,
  generateImagePrompts,
  generateSingleImage
}