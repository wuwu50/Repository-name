"""Fixed local setup helpers; no shell commands or remote model code."""
import sys, json, pathlib, zipfile, os
mode=sys.argv[1]
if mode=='extract':
    source,destination=map(pathlib.Path,sys.argv[2:4])
    destination=destination.resolve()
    with zipfile.ZipFile(source) as archive:
        entries=archive.infolist()
        prefix=entries[0].filename.split('/')[0]+'/'
        for entry in entries:
            if not entry.filename.startswith(prefix):raise ValueError('Invalid source archive')
            relative=entry.filename[len(prefix):]
            if not relative:continue
            target=(destination/relative).resolve()
            if not target.is_relative_to(destination) or (entry.external_attr>>16)&0o170000==0o120000:raise ValueError('Unsafe archive path')
            if entry.is_dir():target.mkdir(parents=True,exist_ok=True)
            else:
                target.parent.mkdir(parents=True,exist_ok=True)
                with archive.open(entry) as src,target.open('wb') as dst:
                    import shutil
                    shutil.copyfileobj(src,dst)
elif mode=='translation-setup':
    from huggingface_hub import snapshot_download
    snapshot_download('Helsinki-NLP/opus-mt-zh-en',revision='cf109095479db38d6df799875e34039d4938aaa6',local_dir=sys.argv[2],allow_patterns=['config.json','generation_config.json','pytorch_model.bin','source.spm','target.spm','tokenizer_config.json','vocab.json'])
elif mode=='translate':
    os.environ['HF_HUB_OFFLINE']='1'
    from transformers import MarianTokenizer,MarianMTModel
    import torch
    torch.set_num_threads(2)
    folder,request,response=sys.argv[2:5]
    text=json.loads(pathlib.Path(request).read_text(encoding='utf-8'))['text']
    tokenizer=MarianTokenizer.from_pretrained(folder,local_files_only=True)
    model=MarianMTModel.from_pretrained(folder,local_files_only=True)
    chunks=[text[i:i+180] for i in range(0,len(text),180)]
    output=[]
    for chunk in chunks:
        tokens=tokenizer(chunk,return_tensors='pt',truncation=True,max_length=512)
        with torch.inference_mode(): generated=model.generate(**tokens,max_new_tokens=256)
        output.append(tokenizer.decode(generated[0],skip_special_tokens=True))
    pathlib.Path(response).write_text(json.dumps({'text':' '.join(output)},ensure_ascii=False),encoding='utf-8')
else:raise ValueError('Unknown helper operation')
