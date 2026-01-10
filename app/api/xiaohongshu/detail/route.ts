import { NextRequest, NextResponse } from 'next/server'

// 外部 API 配置
const DETAIL_API_URL = process.env.NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_BASE || 'https://api.meowload.net/openapi/extract/post'
const DETAIL_API_KEY = process.env.NEXT_PUBLIC_XIAOHONGSHU_DETAIL_API_KEY || ''

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  console.log('┌─────────────────────────────────────────────────────────────')
  console.log('│ [小红书详情代理] 收到请求')

  try {
    const body = await request.json()
    const { url } = body

    console.log('│ 目标 URL:', url)
    console.log('│ API 地址:', DETAIL_API_URL)

    // 构建请求体
    const requestBody = { url }

    console.log('│ ⏰ 发起 HTTP 请求...')

    const fetchStartTime = Date.now()
    const response = await fetch(DETAIL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DETAIL_API_KEY,
        'accept-language': 'zh',
      },
      body: JSON.stringify(requestBody),
    })
    const fetchEndTime = Date.now()

    console.log('│ 📡 HTTP 响应返回 (耗时', fetchEndTime - fetchStartTime, 'ms)')
    console.log('│ 状态码:', response.status)

    if (!response.ok) {
      console.log('│ ❌ HTTP 响应不正常!')
      const errorData = await response.json().catch(() => ({}))
      console.log('│ 错误信息:', errorData.message || '未知错误')
      console.log('└─────────────────────────────────────────────────────────────')

      return NextResponse.json(
        {
          success: false,
          error: errorData.message || `HTTP error! status: ${response.status}`
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    console.log('│ ✅ 返回数据结构:')
    console.log('│   - text (正文):', data.text ? `存在 (${data.text.length}字)` : '不存在')
    console.log('│   - medias数量:', data.medias?.length || 0)
    console.log('│   - id:', data.id || '(空)')

    const endTime = Date.now()
    console.log('│ ✅ 请求成功! 总耗时:', endTime - startTime, 'ms')
    console.log('└─────────────────────────────────────────────────────────────')

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const endTime = Date.now()
    console.error('│ ❌ 请求失败! 耗时:', endTime - startTime, 'ms')
    console.error('│ 错误信息:', error)
    console.log('└─────────────────────────────────────────────────────────────')

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '服务器内部错误'
      },
      { status: 500 }
    )
  }
}
