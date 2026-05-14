import { defineConfig } from '@tarojs/cli'
import devConfig from './dev.config'
import prodConfig from './prod.config'

export default defineConfig(async (merge) => {
  const baseConfig = {
    projectName: 'china-map-explorer',
    date: '2026-05-14',
    designWidth: 375,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {
      TARO_ENV: JSON.stringify(process.env.TARO_ENV),
    },
    mini: {
      miniCssLoaderOption: {
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module_[local]--[hash:base64:5]',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {
            selectorBlackList: ['van-', 'mu-'],
          },
        },
        url: {
          enable: true,
          config: {
            limit: 1024,
          },
        },
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module_[local]--[hash:base64:5]',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
      webpackChain(chain) {
        chain.merge({
          optimization: {
            splitChunks: {
              chunks: 'all',
              maxAsyncRequests: 5,
              maxInitialRequests: 3,
              automaticNameDelimiter: '~',
            },
          },
        })
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      postcss: {
        autoprefixer: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: true,
          config: {
            namingPattern: 'module_[local]--[hash:base64:5]',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
    framework: 'react',
    frameworkExts: ['tsx', 'ts'],
    ts: {
      enable: true,
      config: {
        compilerOptions: {
          strictNullChecks: true,
          strict: false,
          esModuleInterop: true,
          skipLibCheck: true,
        },
      },
    },
  }

  if (process.env.NODE_ENV === 'development') {
    // 本地开发配置
    return merge({}, baseConfig, devConfig)
  }
  // 生产配置
  return merge({}, baseConfig, prodConfig)
})
