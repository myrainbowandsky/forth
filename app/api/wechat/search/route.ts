import { NextRequest, NextResponse } from 'next/server'

// 外部 API 配置
const API_URL = 'https://www.dajiala.com/fbmain/monitor/v3/kw_search'
const API_KEY = process.env.NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 构建请求参数
    const requestBody = {
      kw: body.kw || '',
      sort_type: body.sort_type || 1,
      mode: body.mode || 1,
      period: body.period || 7,
      page: body.page || 1,
      key: API_KEY,
      any_kw: body.any_kw || '',
      ex_kw: body.ex_kw || '',
      verifycode: body.verifycode || '',
      type: body.type || 1,
    }

    console.log('[微信搜索代理] 请求参数:', JSON.stringify(requestBody, null, 2))

    // 调用外部 API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      console.error('[微信搜索代理] HTTP 错误:', response.status)
      return NextResponse.json(
        { success: false, error: `HTTP error! status: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[微信搜索代理] 返回结果:', { code: data.code, dataCount: data.data?.length || 0 })

    // 检查 API 返回的状态码（成功时 code 为 0）
    if (data.code !== 0) {
      console.error('[微信搜索代理] API 返回错误:', data)
      return NextResponse.json(
        { success: false, error: data.msg || 'API 请求失败' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[微信搜索代理] 异常:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '服务器内部错误'
      },
      { status: 500 }
    )
  }
}
