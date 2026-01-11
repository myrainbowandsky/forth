/**
 * 即梦AI图片生成测试脚本
 * 运行: node test-jimeng.js
 */

// 从 .env.local 加载环境变量
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8')
    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        const value = valueParts.join('=').trim()
        if (key && value) {
          process.env[key] = value
        }
      }
    })
  }
}

loadEnv()

async function testJimengImage() {
  console.log('=== 即梦AI图片生成测试 ===\n')

  // 检查环境变量
  const JIMENG_API_KEY = process.env.JIMENG_API_KEY || ''
  const JIMENG_API_BASE = process.env.JIMENG_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
  const JIMENG_MODEL = process.env.JIMENG_MODEL || 'doubao-seedream-4-5-251128'

  console.log('配置信息:')
  console.log(`- API Base: ${JIMENG_API_BASE}`)
  console.log(`- Model: ${JIMENG_MODEL}`)
  console.log(`- API Key: ${JIMENG_API_KEY ? JIMENG_API_KEY.substring(0, 20) + '...' : '未配置'}`)

  if (!JIMENG_API_KEY) {
    console.error('\n错误: 未配置 JIMENG_API_KEY')
    return
  }

  const testPrompt = '一只可爱的橘猫在阳光下的窗台上睡觉，温暖的午后光线，温馨的家庭氛围'

  console.log(`\n测试提示词: ${testPrompt}`)
  console.log('\n开始生成图片...')

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000)

    const response = await fetch(JIMENG_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JIMENG_API_KEY}`,
      },
      body: JSON.stringify({
        model: JIMENG_MODEL,
        prompt: testPrompt,
        size: '2K',
        watermark: false
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    console.log(`响应状态: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`错误响应: ${errorText}`)
      return
    }

    const data = await response.json()
    console.log('\n响应数据:')
    console.log(JSON.stringify(data, null, 2))

    const imageUrl = data.data?.[0]?.url || data.image_url

    if (imageUrl) {
      console.log(`\n✅ 图片生成成功!`)
      console.log(`图片URL: ${imageUrl}`)
    } else {
      console.error('\n❌ 未能从响应中获取图片URL')
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    if (error.name === 'AbortError') {
      console.error('错误: 请求超时（45秒）')
    }
  }
}

testJimengImage()
