function buildWorkflow(images, text, seed) {
  if (!Array.isArray(images) || images.length < 1 || images.length > 10)
    throw Error("請匯入 1～10 張兔兔照片。");
  const graph = {
    1: {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: "rabbit-sd15.safetensors" },
    },
    2: {
      class_type: "CLIPTextEncode",
      inputs: {
        clip: ["1", 1],
        text: `one rabbit, white fur, tan brown patches around eyes and muzzle, pink nose, black eyes, two ears, fluffy cheeks, ${text}, detailed, high quality`,
      },
    },
    3: {
      class_type: "CLIPTextEncode",
      inputs: {
        clip: ["1", 1],
        text: "extra ears, three ears, extra limbs, multiple rabbits, deformed, distorted anatomy, low quality, watermark, text",
      },
    },
    4: {
      class_type: "EmptyLatentImage",
      inputs: { width: 512, height: 512, batch_size: 1 },
    },
    5: {
      class_type: "IPAdapterModelLoader",
      inputs: { ipadapter_file: "ip-adapter-plus_sd15.safetensors" },
    },
    6: {
      class_type: "CLIPVisionLoader",
      inputs: { clip_name: "rabbit-clip-vision.safetensors" },
    },
    7: {
      class_type: "IPAdapterAdvanced",
      inputs: {
        model: ["1", 0],
        ipadapter: ["5", 0],
        clip_vision: ["6", 0],
        image: null,
        weight: 0.75,
        weight_type: "linear",
        combine_embeds: "average",
        start_at: 0,
        end_at: 0.85,
        embeds_scaling: "V only",
      },
    },
    8: {
      class_type: "KSampler",
      inputs: {
        model: ["7", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
        seed,
        steps: 24,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
      },
    },
    9: {
      class_type: "VAEDecode",
      inputs: { samples: ["8", 0], vae: ["1", 2] },
    },
    10: {
      class_type: "SaveImage",
      inputs: { filename_prefix: "RabbitStudio", images: ["9", 0] },
    },
  };
  let previous;
  images.forEach((image, i) => {
    const load = String(100 + i * 3),
      scale = String(101 + i * 3),
      batch = String(102 + i * 3);
    graph[load] = { class_type: "LoadImage", inputs: { image } };
    graph[scale] = {
      class_type: "ImageScale",
      inputs: {
        image: [load, 0],
        upscale_method: "lanczos",
        width: 512,
        height: 512,
        crop: "center",
      },
    };
    if (previous) {
      graph[batch] = {
        class_type: "ImageBatch",
        inputs: { image1: previous, image2: [scale, 0] },
      };
      previous = [batch, 0];
    } else previous = [scale, 0];
  });
  graph["7"].inputs.image = previous;
  return graph;
}
module.exports = { buildWorkflow };
