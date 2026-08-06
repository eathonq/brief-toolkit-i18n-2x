# brief-toolkit-i18n-2x

> 基于 Cocos Creator 2.4.x 的轻量级工具包，提供国际化（i18n）+ 公共基础设施（资源管理 & 事件总线）。

| 项目 | 内容 |
| --- | --- |
| 版本 | `v1.0.0` |
| Cocos 版本 | `v2.4.14` |
| 协议 | [MIT License](LICENSE.md) |

## 简介

`brief-toolkit-i18n-2x` 是一个 Cocos Creator 编辑器扩展插件，包含两大运行时模块：

- **[i18n](static/assets/brief-toolkit/i18n/README.md)** — 国际化模块：文本/图片本地化、语言切换、日期格式化、事件驱动的 UI 刷新。
- **[common](static/assets/brief-toolkit/common/README.md)** — 公共基础设施：`EventBus` 全局事件总线 + `CCAssets` 资源加载器 + `AssetScope` 作用域资源追踪 + `AssetScopeManager` 场景级自动管理。

两个模块均提供 **纯 TS 入口（`pure.ts`）**，零 Cocos 依赖，可直接在 ViewModel、单元测试、SSR 环境中使用。

## 目录结构

```shell
brief-toolkit-i18n-2x
├── main.js                              # 插件主入口
├── scene-script.js                      # 场景脚本
├── panel/
│   └── i18n-panel.html                  # 编辑器 i18n 管理面板
├── i18n/
│   ├── zh.js                            # 中文翻译（编辑器面板用）
│   └── en.js                            # 英文翻译（编辑器面板用）
├── static/assets/brief-toolkit/
│   ├── common/                          # 公共基础设施模块
│   │   ├── pure.ts                      #   纯 TS 入口
│   │   ├── core/
│   │   │   ├── EventBus.ts              #     统一事件总线
│   │   │   ├── EventMutex.ts            #     事件互斥锁
│   │   │   ├── CCAssets.ts              #     底层资源加载器
│   │   │   ├── AssetScope.ts            #     资源作用域追踪
│   │   │   └── AssetScopeManager.ts     #     场景级资源管理器
│   │   └── components/
│   │       └── AssetScopeMount.ts       #     场景挂载组件（零代码接入）
│   └── i18n/                            # 国际化模块
│       ├── pure.ts                      #   纯 TS 入口（ViewModel 专用）
│       ├── index.ts                     #   Cocos 层入口（组件使用）
│       ├── core/
│       │   ├── I18nManager.ts           #     本地化核心实现（全局单例）
│       │   ├── DefaultI18nManager.ts    #     Null Object 实现
│       │   ├── II18nManager.ts          #     管理器接口
│       │   ├── I18n.ts                  #     静态门面（bind/unbind 注入）
│       │   ├── I18nEvent.ts             #     事件类型定义
│       │   └── DateFormatter.ts         #     日期格式化工具
│       └── components/
│           ├── I18nLabel.ts             #     文本本地化组件
│           ├── I18nSprite.ts            #     图片本地化组件
│           └── I18nSetting.ts           #     多语言配置组件
├── package.json
├── README.md
└── LICENSE.md
```

## 核心特性

### i18n 模块
- **四层架构**：`I18nManager`（核心）→ `I18nSetting`（配置）→ `I18nLabel` / `I18nSprite`（组件绑定）→ `I18n` 静态门面（VM 入口）
- **事件驱动刷新**：切语言 → `EventBus` 广播 → 订阅组件自动刷新，O(m) 复杂度
- **语言回退**：当前语言缺失 key 时自动回退到指定语言
- **错误恢复**：`switch()` 加载失败自动回滚到旧语言
- **Null Object 模式**：未绑定时 `I18n.text()` 返回 key 本身，不崩溃
- **日期格式化**：`I18n.format()` 自动检测 Date 参数并应用语言特定的日期格式

### common 模块
- **EventBus**：全局发布/订阅事件总线，跨模块通信统一基础设施
- **资源管理三层模型**：`CCAssets`（加载）→ `AssetScope`（追踪）→ `AssetScopeManager`（管理）
- **场景自动释放**：挂载 `AssetScopeMount` 即可自动 push/pop，场景销毁时释放所有资源
- **模块级自管**：全局单例可自建 `AssetScope` 实例，跨场景存活

## 快速开始

### 安装

将插件目录放入 Cocos Creator 项目的 `packages/` 目录下。

### 场景配置

1. 场景根节点挂 `AssetScopeMount`（资源自动管理）
2. 场景常驻节点挂 `I18nSetting`，配置默认语言 JSON

### 文本本地化

```
有 Label 的节点 → 挂 I18nLabel → 设置 key（如 common.confirm）
```

### 代码调用（推荐 pure.ts）

```ts
import { I18n, DateFormatter } from "../brief-toolkit-i18n-2x-plugin/i18n/pure";
import { EventBus } from "../brief-toolkit-i18n-2x-plugin/common/pure";

// 切换语言
await I18n.switch("en");

// 获取文本
I18n.text("common.confirm");                    // "Confirm"
I18n.text("args.welcome", ["Game"]);            // "Welcome to Game!"

// 格式化（支持 Date）
I18n.format("time_now", [new Date()]);

// 事件监听
EventBus.on(I18nEventType.LANGUAGE_SWITCHED, ({ language }) => {
  console.log(`语言切换完成: ${language}`);
});
```

## 模块文档

| 模块 | 文档 | 说明 |
| --- | --- | --- |
| i18n | [i18n/README.md](static/assets/brief-toolkit/i18n/README.md) | 国际化完整文档（API、语言资源规范、运行机制） |
| common | [common/README.md](static/assets/brief-toolkit/common/README.md) | 公共基础设施文档（EventBus、资源管理） |

## 📄 协议

本项目基于 [MIT License](LICENSE.md) 开源。
