# TokenPocket Mobile-SDK 协议（uni-app x）

不依赖官方 `wallet-sdk-release.aar`（自定义基座经常打不进 AAR）。

按官方 SDK 同等协议实现：

1. `tpoutside://pull.activity?param=` + JSON
2. Intent extras：`packageName` / `className` / `appName`
3. 回传 Activity：`TpAssistActivity`（status + result）
4. 兜底：`callbackSchema=itiklink://tp-wallet`

## 首次接入必做

`TpAssistActivity` 写在 Manifest 里，须制作一次自定义调试基座：

1. 已把 `versionCode` 提到 `102`
2. HBuilderX → 运行 → 制作自定义调试基座
3. 卸载手机旧基座后再装新基座

之后改 Kotlin/UTS 业务可热更新；只有再改 Manifest / 原生依赖才需要重打基座。
