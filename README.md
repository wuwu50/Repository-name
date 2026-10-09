# 兔兔桌面寵物 v4.0

保留兔兔互動、抓起拖曳、拍拍、探頭、聞聞、吃草、睡覺、便便清理、自主跳動、課表、透明視窗滑鼠穿透、控制台位置記憶及桌面捷徑。原有 userData、settings-v3.json 和 calendar-cache.json 不變。

## 安裝與更新

從本儲存庫 GitHub Releases 下載：

- Windows 10／11 x64：執行 RabbitDesktop-版本-win-x64.exe 安裝。
- Mac Apple Silicon、macOS 13 以上：開啟 RabbitDesktop-版本-mac-arm64.dmg，將 RabbitDesktop.app 拖到 Applications；另有 ZIP。

Mac 目前是 ad-hoc 本機簽章，沒有正式 Developer ID 或 Apple 公證，可能被 Gatekeeper 阻擋。確認來源後使用系統「隱私權與安全性 → 仍要開啟」。不提供移除安全保護的腳本，也不再依賴舊 README 提及但未附帶的「安裝並啟動.command」。Windows 尚無發行者憑證，可能出現 SmartScreen 提示。

正式版啟動 15 秒後、每小時檢查新版。右下角功能選單可檢查更新；Windows 可下載、顯示進度，確認「重新啟動更新」才安裝，一般退出不安裝。Mac 使用「開啟新版下載頁」，退出後手動替換；未正式簽章前不自動覆寫 App。

舊 v3 沒有更新器，需先手動安裝正式 v4 一次。僅原始碼內有更新程式不代表已下載的舊程式會自行更新。

## 原始碼與打包

需要 Node.js 24 和 npm，在此資料夾執行：

```sh
npm ci
npm test
npm start
npm run release:windows
# Mac 上執行
npm run release:mac
```

正式安裝包在 release-v4/，GitHub Releases 更新來源已固定，不需 RABBIT_UPDATE_URL。舊 package:windows、package:mac 指令保留為 portable 開發封裝，不具完整更新設定，發行請使用 release 指令。

assets/ 存放圖片；tests/ 存放測試；packaging/ 存放打包、簽章與封裝驗證工具。桌寵在主螢幕活動；控制按鈕可拖曳到其他螢幕。不會加入開機啟動。課表使用 Europe/Madrid 時區，離線保留快取。

## GitHub 自動打包

1. 將本次完整修改提交並推送至 main。
2. 推送到 main 後會自動啟動兩平台打包，也可到 GitHub Actions → Desktop release → Run workflow 手動重跑。
3. 兩平台成功後，從 Artifacts 下載 desktop-windows、desktop-mac 做實機安裝測試。手動 workflow 不會公開 Release。
4. 測試完成後，在同一提交建立 v4.0.0 標籤並推送；標籤必須與 package.json 版本一致。

```sh
git tag v4.0.0
git push origin v4.0.0
```

兩平台打包與封裝檢查皆成功後，CI 才建立草稿 Release、上傳 EXE／DMG／ZIP／blockmap／latest.yml／latest-mac.yml，最後公開。使用 GitHub 內建 GITHUB_TOKEN，不需在客戶端放入 token。不得修改安裝包檔名或雜湊；已發布版本不覆蓋，修正時升版。

## 驗證限制

npm test 為模擬測試，涵蓋原有功能及 Windows／Mac 更新分流，不能代替實機互動。CI 額外驗證封裝依賴、資源、更新來源、版本、SHA512，以及 Mac arm64 架構／ad-hoc 簽章。尚需 GitHub CI 成功、Windows 與 Mac 實機安裝，以及兩個版本的升版測試。

詳見 AUTO-UPDATE.md。
