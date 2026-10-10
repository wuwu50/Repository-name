# 兔兔更新與發行設定

更新來源固定為公開 GitHub 儲存庫 wuwu50/Repository-name 的正式 Releases，不接受 UI 傳入任意網址。

Windows 保留自動檢查、手動下載及「重新啟動更新」確認安裝；一般退出不安裝。使用 NSIS 與 electron-updater。

Mac 4.2.1 起：檢查較新的正式版本，且 PKG 與 SHA512 校驗檔皆存在才提供「下載並安裝新版」。下載後校驗內容與檔案格式，交給 Mac 系統安裝程式，退出兔兔以便更新。系統可能要求確認與管理員密碼；無需拖曳 App。安裝到 /Applications/RabbitDesktop.app，安裝完成嘗試重新開啟。下載或開啟失敗可重試，不刪除既有 App 或使用者設定。

Mac App 使用 ad-hoc 簽章；PKG 無正式簽章，沒有 Developer ID 或公證。系統安全性仍可能阻擋，須依系統提示允許。此流程不是 Squirrel.Mac 無人值守安裝。不移除 Gatekeeper 保護。

舊版 Mac 請先手動開啟新 PKG 安裝一次，之後新版可從程式內下載並安裝。設定與課表快取保留。

main push 會自動測試與打包，兩平台皆成功才發布新版本；不覆蓋既有版本。Mac PKG 與其 SHA512 檔必須一同發布。實際 Mac 安裝與跨版本更新仍需實機驗證。
