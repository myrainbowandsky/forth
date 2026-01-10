import { WeChatArticleApiResponse, WeChatArticleSearchParams } from '@/types/wechat-api'

// 使用本地代理 API（解决 CORS 问题）
const PROXY_API_URL = '/api/wechat/search'

/**
 * 搜索公众号文章（通过本地代理）
 * @param params 搜索参数
 * @returns Promise<WeChatArticleApiResponse>
 */
export async function searchWeChatArticles(
  params: Omit<WeChatArticleSearchParams, 'key'>
): Promise<WeChatArticleApiResponse> {
  const requestBody: Omit<WeChatArticleSearchParams, 'key'> = {
    kw: params.kw,
    sort_type: params.sort_type || 1,
    mode: params.mode || 1,
    period: params.period || 7,
    page: params.page || 1,
    any_kw: params.any_kw || '',
    ex_kw: params.ex_kw || '',
    verifycode: params.verifycode || '',
    type: params.type || 1,
  }

  try {
    const response = await fetch(PROXY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'API请求失败')
    }

    return result.data as WeChatArticleApiResponse
  } catch (error) {
    console.error('搜索公众号文章失败:', error)
    throw error
  }
}

/**
 * 批量搜索多页文章
 * @param keyword 关键词
 * @param totalPages 总页数
 * @returns Promise<WeChatArticleApiResponse[]>
 */
export async function searchMultiplePages(
  keyword: string,
  totalPages: number = 1
): Promise<WeChatArticleApiResponse[]> {
  const promises: Promise<WeChatArticleApiResponse>[] = []

  for (let page = 1; page <= totalPages; page++) {
    promises.push(
      searchWeChatArticles({
        kw: keyword,
        page,
      })
    )
  }

  return Promise.all(promises)
}
