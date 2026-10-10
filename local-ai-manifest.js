const COMFY = "b0b743566f65daafc423b4fea8a2fbda94b3384a";
const ADAPTER = "a0f451a5113cf9becb0847b92884cb10cbdec0ef";
const HF = "https://huggingface.co";
const models = [
  {
    file: "models/checkpoints/rabbit-sd15.safetensors",
    url: `${HF}/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/451f4fe16113bff5a5d2269ed5ad43b0592e9a14/v1-5-pruned-emaonly.safetensors`,
    sha256: "6ce0161689b3853acaa03779ec93eafe75a02f4ced659bee03f50797806fa2fa",
  },
  {
    file: "models/clip_vision/rabbit-clip-vision.safetensors",
    url: `${HF}/h94/IP-Adapter/resolve/018e402774aeeddd60609b4ecdb7e298259dc729/models/image_encoder/model.safetensors`,
    sha256: "6ca9667da1ca9e0b0f75e46bb030f7e011f44f86cbfb8d5a36590fcd7507b030",
  },
  {
    file: "models/ipadapter/ip-adapter-plus_sd15.safetensors",
    url: `${HF}/h94/IP-Adapter/resolve/018e402774aeeddd60609b4ecdb7e298259dc729/models/ip-adapter-plus_sd15.safetensors`,
    sha256: "a1c250be40455cc61a43da1201ec3f1edaea71214865fb47f57927e06cbe4996",
  },
];
const uv = {
  win32: {
    url: "https://github.com/astral-sh/uv/releases/download/0.13.0/uv-x86_64-pc-windows-msvc.zip",
    sha256: "088962f9e7b7bd9ea740c04c650b2a21c8928c345bd99ac24350dc924dba656c",
    archive: "uv.zip",
    binary: "uv.exe",
  },
  darwin: {
    url: "https://github.com/astral-sh/uv/releases/download/0.13.0/uv-aarch64-apple-darwin.tar.gz",
    sha256: "a9c1b29002cf3c83f07fa9cd8a887a3be0107d90e23189721221e7257db8e3d6",
    archive: "uv.tar.gz",
    binary: "uv-aarch64-apple-darwin/uv",
  },
};
module.exports = { COMFY, ADAPTER, models, uv };
