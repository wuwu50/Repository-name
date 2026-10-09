# 兔兔 v4 程式內更新

## 目前交付狀態

已加入更新器原始碼與測試，尚未連上正式更新檔服務，也未產生可供使用者安裝的 v4 發行檔。這份 ZIP 是開發用原始碼，不是可雙擊的安裝程式。

v3 及之前的程式沒有更新器，不能遠端替它補上功能。必須先安裝正式 v4 一次，之後才可在程式內取得後續版本。網頁課表的更新與桌面 App 的發行更新是兩個不同流程。

## 使用者操作

正式安裝版啟動 15 秒後檢查新版，之後每小時檢查。右下角圓形三角選單新增：

1. 檢查更新：顯示目前版本與是否有新版。
2. 下載更新：由程式下載，显示百分比，不需前往網站手動下載。
3. 重新啟動更新：下載完成才可使用；關閉兔兔、套用更新並重新啟動。

下載失敗不刪除目前程式。一般退出不自動安裝，讓使用者明確決定更新時機。userData 中的課表快取、控制按鈕位置與其他既有設定不清除。

## 發行者設定

需要固定、公開、免登入的 HTTPS 檔案目錄。Google Drive 分享頁與此對話的附件連結不能直接當作更新目錄。不同平台建議使用各自子目錄。

Windows PowerShell：

```powershell
$env:RABBIT_UPDATE_URL = 'https://你的更新主機/rabbit/windows/'
npm ci
npm run release:windows
```

Apple Silicon Mac Terminal：

```bash
export RABBIT_UPDATE_URL='https://你的更新主機/rabbit/mac-arm64/'
npm ci
npm run release:mac
```

必須使用 release 指令產生正式更新版。舊 package 指令仍保留，但其 portable ZIP 不會附帶更新來源，更新器會顯示未設定。

Windows 使用 electron-builder 的 NSIS 安裝版；Mac 使用 dmg 初次安裝與 zip 更新檔。Mac 正式更新需要一致的 Developer ID 發行簽章；對外下載還需 Apple 公證。現有 ad-hoc 簽章無法視為已完成此條件。憑證與公證資料應由發行者在 Mac 建置環境設定，不放入原始碼或 ZIP。

每次發布提高 package.json 版本，重建，先上傳該平台所有安裝／更新檔及 blockmap，最後上傳 latest.yml 或 latest-mac.yml。更新器使用 builder 產生的 app-update.yml，不接受畫面傳入任意更新網址；使用內建檔案雜湊／平台簽章驗證，不停用驗證。

不要直接覆寫已安裝 Mac App 的 app.asar；這會破壞原本 bundle 簽章。

## 測試與限制

```bash
node tests/state-check.cjs
node tests/controls-check.cjs
node tests/dock-check.cjs
node tests/updater-check.cjs
```

更新器測試使用模擬事件，涵蓋未設定來源、版本發現、下載進度、安裝條件、保留待安裝版本、失敗與重試。尚未在正式 HTTPS 發行端或 Windows／Mac 實機完成「v4 升 v4.1」驗證，因此不能宣稱使用者目前已下載的程式已經啟用自動更新。
