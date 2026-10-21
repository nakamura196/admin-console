// Next.js 16 で `next lint` が廃止されたため、ESLint を直接呼ぶ flat config にする。
// ルールは eslint-config-next (core-web-vitals + typescript) に従う。
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@next/next/no-img-element': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // scripts/ は Next.js のビルドには入らず、Node.js から直接実行する
  // CommonJS のスクリプト。require() が本来の書き方なので、このルールだけ外す。
  {
    files: ['scripts/**/*.js', 'scripts/**/*.cjs', 'scripts/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // ビルド生成物・依存は対象外
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'dist/**',
    'coverage/**',
    '.open-next/**',
    '.wrangler/**',
    'node_modules/**',
    'next-env.d.ts',
    '*.config.js',
    '*.config.ts',
  ]),
])
