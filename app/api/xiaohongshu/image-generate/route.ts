import { NextRequest, NextResponse } from 'next/server'

// 即梦AI API 配置
const JIMENG_AI_KEY = process.env.JIMENG_AI_KEY || '64f4028d-e4b0-4e18-a929-a106b5696d09'
const JIMENG_API_BASE = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
const IMAGE_MODEL = 'doubao-seedream-4-5-251128'

export async function POST(request: NextRequest) {
  try {
    const { prompt, originalImageUrl, style } = await request.json()

    // 参数验证
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { success: false, error: '请提供图片生成提示词' },
        { status: 400 }
      )
    }

    console.log('[图片生成] 开始生成图片')
    console.log('[图片生成] 提示词:', prompt)
    console.log('[图片生成] 风格:', style || 'original')
    console.log('[图片生成] 原图URL:', originalImageUrl || '无')

    // 构建完整的提示词
    let fullPrompt = prompt

    // 根据风格添加额外的描述
    if (style && style !== 'original') {
      const styleDescriptions: Record<string, string> = {
        cartoon: '使用卡通风格，色彩明亮鲜艳，线条清晰，可爱的插画风格',
        realistic: '使用写实风格，高清照片质感，真实的光影效果，专业摄影',
        sketch: '使用手绘风格，素描线条，艺术感强，黑白或水彩效果'
      }

      if (styleDescriptions[style]) {
        fullPrompt = `${prompt}。${styleDescriptions[style]}`
      }
    }

    // 如果有原图URL，添加参考说明
    if (originalImageUrl) {
      fullPrompt = `参考原图的构图和主题，${fullPrompt}。注意：生成全新的内容，不要完全复制原图。`
    }

    console.log('[图片生成] 完整提示词:', fullPrompt)

    try {
      // 调用即梦AI图生图API
      console.log('[图片生成] API URL:', JIMENG_API_BASE)

      // 构建请求体
      const requestBody: any = {
        model: IMAGE_MODEL,
        prompt: fullPrompt,
        size: "2K",
        watermark: false
      }

      // 如果有原图URL，添加image参数进行图生图
      if (originalImageUrl) {
        requestBody.image = originalImageUrl
        console.log('[图片生成] 使用图生图模式，原图URL:', originalImageUrl)
      } else {
        console.log('[图片生成] 使用文生图模式')
      }

      const response = await fetch(JIMENG_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JIMENG_AI_KEY}`
        },
        body: JSON.stringify(requestBody)
      })

      const responseText = await response.text()
      console.log('[图片生成] API 响应状态:', response.status)
      console.log('[图片生成] API 响应内容:', responseText.substring(0, 500))

      if (!response.ok) {
        let errorMessage = '图片生成失败'
        try {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.error?.message || errorData.message || errorMessage
        } catch {
          errorMessage = `API 错误 (${response.status}): ${responseText.substring(0, 200)}`
        }
        throw new Error(errorMessage)
      }

      const data = JSON.parse(responseText)

      // 提取生成的图片URL
      // 即梦AI响应格式: { data: [{ url: "...", size: "..." }] }
      const images = data.data || []

      if (images.length === 0) {
        throw new Error('API 未返回任何图片')
      }

      const imageUrl = images[0].url
      const imageSize = images[0].size

      if (!imageUrl) {
        throw new Error('API 响应中未找到图片URL')
      }

      console.log('[图片生成] 生成成功，图片URL:', imageUrl)
      console.log('[图片生成] 图片尺寸:', imageSize)

      return NextResponse.json({
        success: true,
        data: {
          imageUrl: imageUrl,
          prompt: fullPrompt,
          size: imageSize
        }
      })

    } catch (apiError: any) {
      console.error('[图片生成] API 调用错误:', apiError)

      // 检查是否是额度问题
      if (apiError.message?.includes('quota') || apiError.message?.includes('credits') || apiError.message?.includes('billing')) {
        throw new Error('API 额度不足，请检查账户余额')
      }

      // 检查是否是模型不支持
      if (apiError.message?.includes('not found') || apiError.message?.includes('unsupported')) {
        throw new Error('图片生成模型暂不可用，请稍后重试')
      }

      // 检查是否是认证问题
      if (apiError.message?.includes('unauthorized') || apiError.message?.includes('authentication')) {
        throw new Error('API 认证失败，请检查API密钥')
      }

      throw apiError
    }

  } catch (error) {
    console.error('[图片生成] 错误:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '图片生成过程中发生未知错误'
      },
      { status: 500 }
    )
  }
}
