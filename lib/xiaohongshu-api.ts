import {
  XiaohongshuApiResponse,
  XiaohongshuSearchParams,
  XiaohongshuNote,
  XiaohongshuDetailResponse
} from '@/types/xiaohongshu-api'

// 使用本地代理 API（解决 CORS 问题）
const SEARCH_PROXY_API_URL = '/api/xiaohongshu/search'
const DETAIL_PROXY_API_URL = '/api/xiaohongshu/detail'

/**
 * 搜索小红书笔记（通过本地代理）
 * @param params 搜索参数
 * @returns Promise<XiaohongshuApiResponse>
 */
export async function searchXiaohongshuNotes(
  params: Omit<XiaohongshuSearchParams, 'key'>
): Promise<XiaohongshuApiResponse> {
  const startTime = Date.now()

  console.log('\n' + '='.repeat(80))
  console.log('🔍 [搜索接口] 开始搜索小红书笔记')
  console.log('关键词:', params.keyword)
  console.log('页码:', params.page || 1)
  console.log('排序:', params.sort || 'general')
  console.log('笔记类型:', params.note_type || 'image')
  console.log('代理地址:', SEARCH_PROXY_API_URL)

  const requestBody: Omit<XiaohongshuSearchParams, 'key'> = {
    type: params.type || 1,
    keyword: params.keyword,
    page: params.page || 1,
    sort: params.sort || 'general',
    note_type: params.note_type || 'image',
    note_time: params.note_time || '不限',
    note_range: params.note_range || '不限',
    proxy: params.proxy || '',
  }

  console.log('请求参数:', JSON.stringify(requestBody, null, 2))

  try {
    console.log('⏰ 发起POST请求...')
    const fetchStartTime = Date.now()

    const response = await fetch(SEARCH_PROXY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    const fetchEndTime = Date.now()
    const fetchTime = fetchEndTime - fetchStartTime

    console.log('📡 HTTP响应返回 (耗时 ' + fetchTime + 'ms)')
    console.log('状态码:', response.status)

    if (!response.ok) {
      console.log('❌ HTTP响应不正常!')
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    console.log('🔄 解析JSON数据...')
    const result = await response.json()

    if (!result.success) {
      console.log('❌ API返回错误:', result.error)
      throw new Error(result.error || 'API请求失败')
    }

    const data: XiaohongshuApiResponse = result.data

    console.log('✅ 搜索接口返回数据:')
    console.log('  - code:', data.code)
    console.log('  - cost:', data.cost)
    console.log('  - has_more:', data.has_more)
    console.log('  - items数量:', data.items?.length || 0)
    console.log('  - remain_money:', data.remain_money)

    // 检查API返回的状态码（成功时code为0）
    if (data.code !== 0) {
      console.log('❌ API返回错误状态码:', data.code)
      throw new Error('API请求失败')
    }

    const endTime = Date.now()
    const totalTime = endTime - startTime
    console.log('✅ 搜索完成! 总耗时:', totalTime + 'ms')
    console.log('='.repeat(80))

    return data
  } catch (error) {
    const endTime = Date.now()
    const totalTime = endTime - startTime

    console.error('❌ 搜索小红书笔记失败! 耗时:', totalTime + 'ms')
    console.error('错误信息:', error)
    console.log('='.repeat(80))
    throw error
  }
}

/**
 * 将API返回的数据转换为标准化的笔记数据
 * @param apiResponse API响应数据
 * @returns XiaohongshuNote[]
 */
export function transformToNotes(apiResponse: XiaohongshuApiResponse): XiaohongshuNote[] {
  console.log('🔄 开始转换笔记数据，总数:', apiResponse.items?.length || 0)

  const notes = apiResponse.items
    .filter(item => item.note_card) // 过滤掉没有note_card的项
    .map((item, index) => {
      const noteCard = item.note_card!
      const interactInfo = noteCard.interact_info

      // 将字符串数字转换为number
      const likedCount = parseInt(interactInfo.liked_count) || 0
      const collectedCount = parseInt(interactInfo.collected_count) || 0
      const commentCount = parseInt(interactInfo.comment_count) || 0
      const sharedCount = parseInt(interactInfo.shared_count) || 0

      console.log(`  [${index + 1}] ID: ${item.id}, xsec_token: ${item.xsec_token}`)

      return {
        id: item.id,
        xsec_token: item.xsec_token, // 保存 xsec_token，用于获取详情
        title: noteCard.display_title || '无标题',
        cover: noteCard.cover.url_default,
        liked_count: likedCount,
        collected_count: collectedCount,
        comment_count: commentCount,
        shared_count: sharedCount,
        interact_count: likedCount + collectedCount + commentCount,
        user_name: noteCard.user.nickname || noteCard.user.nick_name,
        user_avatar: noteCard.user.avatar,
        type: noteCard.type,
      }
    })

  console.log('✅ 转换完成，有效笔记数:', notes.length)
  return notes
}

/**
 * 批量搜索多页笔记
 * @param keyword 关键词
 * @param totalPages 总页数
 * @returns Promise<XiaohongshuApiResponse[]>
 */
export async function searchMultiplePages(
  keyword: string,
  totalPages: number = 1
): Promise<XiaohongshuApiResponse[]> {
  const promises: Promise<XiaohongshuApiResponse>[] = []

  for (let page = 1; page <= totalPages; page++) {
    promises.push(
      searchXiaohongshuNotes({
        keyword,
        page,
        type: 1,
        sort: 'general',
        note_type: 'image',
        note_time: '不限',
        note_range: '不限',
        proxy: '',
      })
    )
  }

  return Promise.all(promises)
}

/**
 * 获取小红书笔记详情（通过本地代理）
 * @param url 笔记分享链接
 * @returns Promise<XiaohongshuDetailResponse>
 */
export async function getNoteDetail(url: string): Promise<XiaohongshuDetailResponse> {
  const requestStartTime = Date.now()

  console.log('\n┌─────────────────────────────────────────────────────────────')
  console.log('│ 🌐 [详情接口] 准备发起请求（本地代理）')
  console.log('│ 目标URL:', url)
  console.log('│ 代理地址:', DETAIL_PROXY_API_URL)

  try {
    // 构建请求体
    const requestBody = { url }

    console.log('│ 请求方法: POST')
    console.log('│ 请求体:', JSON.stringify(requestBody, null, 2))
    console.log('│ ⏰ 发起HTTP请求...')

    const fetchStartTime = Date.now()
    const response = await fetch(DETAIL_PROXY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    const fetchEndTime = Date.now()
    const fetchTime = fetchEndTime - fetchStartTime

    console.log('│ 📡 HTTP响应返回 (耗时 ' + fetchTime + 'ms)')
    console.log('│ 状态码:', response.status)

    if (!response.ok) {
      console.log('│ ❌ HTTP响应不正常!')
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.log('│ 错误信息:', errorData.error || '未知错误')
      console.log('└─────────────────────────────────────────────────────────────')
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    console.log('│ 🔄 解析JSON数据...')
    const parseStartTime = Date.now()
    const result = await response.json()
    const parseEndTime = Date.now()
    const parseTime = parseEndTime - parseStartTime

    console.log('│ ✅ JSON解析完成 (耗时 ' + parseTime + 'ms)')

    if (!result.success) {
      console.log('│ ❌ API返回错误:', result.error)
      console.log('└─────────────────────────────────────────────────────────────')
      throw new Error(result.error || '详情获取失败')
    }

    const data = result.data as XiaohongshuDetailResponse

    console.log('│ 📦 返回数据结构:')
    console.log('│   - text (正文):', data.text ? `存在 (${data.text.length}字)` : '不存在')
    console.log('│   - medias数量:', data.medias?.length || 0)
    console.log('│   - id:', data.id || '(空)')
    console.log('│   - created_at:', data.created_at || '(空)')

    if (data.text) {
      const preview = data.text.length > 100
        ? data.text.substring(0, 100) + '...'
        : data.text
      console.log('│   - 正文预览:', preview)
    }

    if (data.medias && data.medias.length > 0) {
      console.log('│   - 媒体列表:')
      data.medias.forEach((media: any, index: number) => {
        console.log(`│     [${index + 1}] 类型: ${media.media_type}, URL: ${media.resource_url?.substring(0, 60)}...`)
      })
    }

    const requestEndTime = Date.now()
    const totalTime = requestEndTime - requestStartTime
    console.log('│ ✅ 详情接口调用成功!')
    console.log('│ 总耗时:', totalTime + 'ms')
    console.log('└─────────────────────────────────────────────────────────────')

    return data
  } catch (error) {
    const requestEndTime = Date.now()
    const totalTime = requestEndTime - requestStartTime

    console.log('│ ❌ 详情接口调用失败!')
    console.log('│ 失败耗时:', totalTime + 'ms')
    console.error('│ 错误对象:', error)

    if (error instanceof Error) {
      console.error('│ 错误类型:', error.name)
      console.error('│ 错误消息:', error.message)
      if (error.stack) {
        console.error('│ 错误堆栈:', error.stack.split('\n').slice(0, 3).join('\n│   '))
      }
    } else {
      console.error('│ 未知错误类型:', typeof error)
    }

    console.log('└─────────────────────────────────────────────────────────────')
    throw error
  }
}

/**
 * 批量获取笔记详情并更新笔记对象
 * @param notes 笔记列表
 * @returns Promise<XiaohongshuNote[]> 包含详情的笔记列表
 */
export async function fetchNotesWithDetails(notes: XiaohongshuNote[]): Promise<XiaohongshuNote[]> {
  const startTime = Date.now()
  console.log('='.repeat(80))
  console.log(`📝 [批量获取详情] 开始时间: ${new Date().toLocaleString()}`)
  console.log(`📝 [批量获取详情] 需要获取 ${notes.length} 条笔记的详情`)
  console.log(`📝 [批量获取详情] API配置: ${DETAIL_API_URL}`)
  console.log(`📝 [批量获取详情] API密钥: ${DETAIL_API_KEY}`)
  console.log('='.repeat(80))

  let successCount = 0
  let failCount = 0

  // 使用 Promise.allSettled 来处理部分失败的情况
  const detailPromises = notes.map(async (note, index) => {
    const noteStartTime = Date.now()
    console.log(`\n--- [${index + 1}/${notes.length}] 开始处理笔记 ---`)
    console.log(`笔记ID: ${note.id}`)
    console.log(`笔记标题: ${note.title}`)
    console.log(`xsec_token: ${note.xsec_token}`)

    try {
      // 构建笔记URL，必须包含 xsec_token 参数
      const noteUrl = `https://www.xiaohongshu.com/explore/${note.id}?xsec_token=${note.xsec_token}`
      console.log(`🔗 构建的URL（含token）: ${noteUrl}`)
      console.log(`⏰ 开始调用详情接口...`)

      const detailResponse = await getNoteDetail(noteUrl)

      const noteEndTime = Date.now()
      const noteTime = noteEndTime - noteStartTime

      console.log(`✅ [${index + 1}/${notes.length}] 成功获取笔记详情 (耗时 ${noteTime}ms)`)
      console.log(`📄 返回数据:`, {
        id: note.id,
        title: note.title,
        hasText: !!detailResponse.text,
        textLength: detailResponse.text?.length || 0,
        textPreview: detailResponse.text?.substring(0, 100) || '(空)',
        mediasCount: detailResponse.medias?.length || 0
      })

      successCount++

      // 将详情中的 text（正文内容）添加到笔记对象中，保留所有原有字段包括 xsec_token
      return {
        ...note, // 保留原有的所有字段，包括 xsec_token
        content: detailResponse.text, // 这里的 text 是正文内容
      }
    } catch (error) {
      failCount++
      const noteEndTime = Date.now()
      const noteTime = noteEndTime - noteStartTime

      console.error(`❌ [${index + 1}/${notes.length}] 获取笔记详情失败 (耗时 ${noteTime}ms)`)
      console.error(`笔记ID: ${note.id}`)
      console.error(`错误信息:`, error)
      if (error instanceof Error) {
        console.error(`错误类型: ${error.name}`)
        console.error(`错误消息: ${error.message}`)
        console.error(`错误堆栈:`, error.stack)
      }

      // 失败时返回原笔记对象，不影响其他笔记
      return note
    }
  })

  console.log(`\n⏳ 等待所有详情接口调用完成...`)
  const results = await Promise.allSettled(detailPromises)

  // 提取成功的结果
  const finalNotes = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      console.error(`⚠️ Promise rejected for note ${notes[index].id}:`, result.reason)
      // 如果失败，返回原始笔记
      return notes[index]
    }
  })

  const endTime = Date.now()
  const totalTime = endTime - startTime

  console.log('\n' + '='.repeat(80))
  console.log(`📊 [批量获取详情] 完成时间: ${new Date().toLocaleString()}`)
  console.log(`📊 [批量获取详情] 总耗时: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}秒)`)
  console.log(`📊 [批量获取详情] 成功: ${successCount}/${notes.length} (${((successCount / notes.length) * 100).toFixed(1)}%)`)
  console.log(`📊 [批量获取详情] 失败: ${failCount}/${notes.length} (${((failCount / notes.length) * 100).toFixed(1)}%)`)
  console.log(`📊 [批量获取详情] 平均每条耗时: ${(totalTime / notes.length).toFixed(0)}ms`)
  console.log('='.repeat(80))

  return finalNotes
}
