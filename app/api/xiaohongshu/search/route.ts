import { NextRequest, NextResponse } from 'next/server'

// 外部 API 配置
const API_URL = process.env.NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_BASE || 'https://www.dajiala.com/fbmain/monitor/v3/xhs'
const API_KEY = process.env.NEXT_PUBLIC_XIAOHONGSHU_SEARCH_API_KEY || ''

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  console.log('='.repeat(80))
  console.log('[小红书搜索代理] 收到请求')

  try {
    const body = await request.json()

    console.log('关键词:', body.keyword)
    console.log('页码:', body.page || 1)
    console.log('排序:', body.sort || 'general')
    console.log('笔记类型:', body.note_type || 'image')

    // 构建请求参数
    const requestBody = {
      key: API_KEY,
      type: body.type || 1,
      keyword: body.keyword || '',
      page: body.page || 1,
      sort: body.sort || 'general',
      note_type: body.note_type || 'image',
      note_time: body.note_time || '不限',
      note_range: body.note_range || '不限',
      proxy: body.proxy || '',
    }

    console.log('请求参数:', JSON.stringify(requestBody, null, 2))

    // 调用外部 API
    const fetchStartTime = Date.now()
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    const fetchEndTime = Date.now()

    console.log('外部 API 响应时间:', fetchEndTime - fetchStartTime, 'ms')
    console.log('HTTP 状态码:', response.status)

    if (!response.ok) {
      console.error('[小红书搜索代理] HTTP 错误:', response.status)
      return NextResponse.json(
        { success: false, error: `HTTP error! status: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    console.log('外部 API 返回:', {
      code: data.code,
      cost: data.cost,
      has_more: data.has_more,
      items数量: data.items?.length || 0,
      remain_money: data.remain_money,
    })

    // 检查 API 返回的状态码（成功时 code 为 0）
    if (data.code !== 0) {
      console.error('[小红书搜索代理] API 返回错误:', JSON.stringify(data, null, 2))
      console.error('[小红书搜索代理] 错误码:', data.code, '错误信息:', data.msg || data.message || '无')
      return NextResponse.json(
        { success: false, error: `API 请求失败: ${data.msg || data.message || `错误码 ${data.code}`}` },
        { status: 400 }
      )
    }

    const endTime = Date.now()
    console.log('[小红书搜索代理] 请求成功, 总耗时:', endTime - startTime, 'ms')
    console.log('='.repeat(80))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const endTime = Date.now()
    console.error('[小红书搜索代理] 异常, 耗时:', endTime - startTime, 'ms')
    console.error('错误信息:', error)
    console.log('='.repeat(80))

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '服务器内部错误'
      },
      { status: 500 }
    )
  }
}
