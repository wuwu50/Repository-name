# 免費本機兔兔生圖

右下角圓圈 → **兔兔圖片工作室**。

1. 程式會自動偵測作業系統、顯示卡與記憶體。
2. 按「安裝適合這台電腦的工具」，確認下載與空間資訊。
3. 等待安裝完成，按「啟動本機生圖」。
4. 首次使用安裝版，匯入這隻兔子的 1～10 張照片。
5. 選擇隨機主題，或輸入中文／英文要求，按「生成圖片」。
6. 預覽後按「下載 PNG 圖片」。不用時可停止引擎以釋放資源。

免費本機模式不需要 API 金鑰，也不會自動切換到付費雲端。首次安裝需要網路；照片參考、中文翻譯及生成在本機完成。雲端模式保留供自行選擇，會明確標示另計費。

## 支援範圍

- Windows x64：RTX／GTX 16 系列的 NVIDIA 顯示卡，顯示記憶體至少 4 GB，使用 CUDA；啟動前檢查 CUDA 是否可用。
- Mac Apple Silicon：使用 PyTorch Metal（MPS）。本次沒有 Mac 實機測試。
- 其他 Windows 顯示卡：CPU 相容模式，至少 16 GB 系統記憶體。沒有承諾 AMD／Intel 顯示卡加速，CPU 可能很慢。
- 加速模式至少 8 GB 系統記憶體，建議 16 GB 以上。Intel Mac、Windows ARM 與 Linux 暫不提供自動安裝。

使用 Stable Diffusion 1.5、IP-Adapter Plus 與 512×512 圖片設定。照片先統一尺寸，再合併參考特徵；生成新的場景而非只加相框。兔子的斑紋、耳朵與姿勢仍可能有誤差，請檢查預覽後再下載。隨機主題歷史保留於本機；每張圖片使用新的隨機種子。

## 安裝與資料

需預留 28 GB 空間；首次下載約 8～15 GB，實際大小依平台與套件而異。使用獨立 Python 環境，不修改系統 Python。工具、模型、參考照片及主題歷史存於兔兔程式的使用者資料夾，更新程式時保留。換電腦需在該電腦重新安裝工具並匯入照片。

安裝固定版本的 uv、ComfyUI 與 IP-Adapter 原始碼。uv、生圖模型、視覺模型與翻譯模型會檢查 SHA-256。失敗或取消不會寫入「安裝完成」標記，重試時保留校驗成功的模型檔。引擎只監聽本機 127.0.0.1:18888，啟動時停用 ComfyUI 的付費 API 節點；退出兔兔時停止自己啟動的引擎。

## 常見問題

- 顯示空間不足：清出至少 28 GB 後再試。
- NVIDIA 驅動不可用：更新顯示卡驅動並重新安裝；程式不會把失敗當成安裝完成。
- 安裝下載失敗：檢查網路是否能連上 GitHub、PyPI、PyTorch 及 Hugging Face，再按安裝重試。
- 記憶體不足：關閉遊戲或大型程式，重新啟動引擎；本次尚未在真實模型上測試顯示記憶體峰值。
- 18888 已被其他程式占用：關閉占用程式；兔兔不會接管或停止不屬於自己的引擎。
- 首次生成較慢：引擎需要載入模型。可取消生成，成功生成的圖片仍可下載。

## 來源與授權

安裝會下載第三方程式與模型，其授權由各來源提供：

- [ComfyUI](https://github.com/Comfy-Org/ComfyUI)：GPL-3.0。
- [ComfyUI IP-Adapter Plus](https://github.com/cubiq/ComfyUI_IPAdapter_plus)：GPL-3.0。
- [uv](https://github.com/astral-sh/uv)：MIT／Apache-2.0。
- [Stable Diffusion 1.5](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5)：CreativeML OpenRAIL-M。
- [IP-Adapter 模型](https://huggingface.co/h94/IP-Adapter)：Apache-2.0。
- [中文翻譯模型](https://huggingface.co/Helsinki-NLP/opus-mt-zh-en)：模型頁的授權條款。

這些程式與模型在使用者確認後下載，不放入兔兔安裝檔。圖片品質、模型支援與運算速度取決於本機硬體。
