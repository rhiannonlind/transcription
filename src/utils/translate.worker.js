// Configure ONNX Runtime Web environment before importing transformers
import * as ort from 'onnxruntime-web'

// Set WASM paths for ONNX Runtime Web
ort.env.wasm.wasmPaths = '/'

// Configure environment for @xenova/transformers
ort.env.wasm.numThreads = 1
ort.env.wasm.simd = false

import { pipeline } from '@xenova/transformers';

self.addEventListener('error', (e) => {
  console.error('Worker error:', e);
});
self.addEventListener('unhandledrejection', (e) => {
  console.error('Worker unhandled rejection:', e);
});

class MyTranslationPipeline {
    static task = 'translation';
    static model = 'Xenova/nllb-200-distilled-600M';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            console.log('About to call translation pipeline with:', this.task, this.model);
            this.instance = await pipeline(this.task, this.model, { progress_callback });
            console.log('Translation pipeline instance:', this.instance);
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    const { text, src_lang, tgt_lang } = event.data
    
    try {
        let translator = await MyTranslationPipeline.getInstance(load_model_callback);
        
        if (!translator) {
            console.error('Translation pipeline was not created!');
            return;
        }

        let output = await translator(text, {
            tgt_lang: tgt_lang,
            src_lang: src_lang,
            callback_function: x => {
                self.postMessage({
                    status: 'update',
                    output: translator.tokenizer.decode(x[0].output_token_ids, { skip_special_tokens: true })
                });
            }
        });

        console.log('Translation complete:', output);

        self.postMessage({
            status: 'complete',
            output
        });
    } catch (err) {
        console.error('Translation error:', err);
        self.postMessage({
            status: 'error',
            error: err.message
        });
    }
});

async function load_model_callback(data) {
    const { status } = data
    if (status === 'progress') {
        const { file, progress, loaded, total } = data
        sendDownloadingMessage(file, progress, loaded, total)
    }
}

async function sendDownloadingMessage(file, progress, loaded, total) {
    self.postMessage({
        status: 'progress',
        file,
        progress,
        loaded,
        total
    })
}