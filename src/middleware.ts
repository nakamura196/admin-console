import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// 認証は Cloudflare Access (Zero Trust) で保護する想定。
// アプリ側ではロケール解決のみ行う。
export default createMiddleware(routing)

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
