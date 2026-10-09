# 兔兔 v4 更新與發行設定

更新來源是公開 GitHub 儲存庫 wuwu50/Repository-name 的正式 Releases。已不使用 generic 更新主機或 RABBIT_UPDATE_URL。

Windows 保留「檢查更新」「下載更新」「重新啟動更新」功能：自動檢查、不自動下載；下載進度可見；下載完成、使用者點選後才安裝，一般退出不安裝。使用 NSIS、electron-updater 與 builder 產生的 app-update.yml／latest.yml。

Mac 尚無正式簽章：自動檢查 GitHub 最新正式 Release，驗證版本較新且 arm64 DMG 已存在後顯示下載按鈕。按鈕開啟固定的 GitHub 發行頁，下載後退出並替換 Applications 中的 App；不呼叫 Squirrel.Mac 自動安裝，也不允許 UI 傳入任意更新網址。封裝使用 ad-hoc 簽章，沒有 Developer ID／Apple 公證。

取得正式 Mac 簽章、公證資料後，需重新設定 CI 簽章與公證、通過兩版本實機更新測試，再啟用 Mac 自動安裝。憑證不可提交至原始碼。

.github/workflows/check.yml 於 main push／PR 執行測試。release.yml 於 main push 自動產生兩平台測試 Artifacts，也可手動重跑；推送與版本相同的 v\* 標籤才會公開 Release。兩平台成功、更新 metadata 與檔案雜湊檢查通過後才公開；任何一個建置失敗不公開新版本。

舊 v3 需手動安裝 v4 一次，原有設定與課表快取保留。所有安裝包與 metadata 必須共同發布，不可只上傳 EXE 或 DMG。

完整操作步驟見 README.md。
