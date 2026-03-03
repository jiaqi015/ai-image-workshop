// ==========================================
// 语音听写服务 (Voice Dictation Infrastructure)
// 职责: 封装浏览器原生 SpeechRecognition API，提供统一的事件流
// ==========================================

type VoiceCallback = (text: string, isFinal: boolean) => void;
type StatusCallback = (isListening: boolean) => void;

export class VoiceService {
    private recognition: any = null;
    private isListening: boolean = false;
    private isStarting: boolean = false; 
    private onResult: VoiceCallback | null = null;
    private onStatusChange: StatusCallback | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            // @ts-ignore - SpeechRecognition types might not be available
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                this.recognition = new SpeechRecognition();
                this.recognition.lang = 'zh-CN';
                this.recognition.continuous = false; // 单句模式，避免长时间占用
                this.recognition.interimResults = true; // 实时反馈

                this.setupListeners();
            } else {
                console.warn("VoiceService: Browser does not support SpeechRecognition.");
            }
        }
    }

    private setupListeners() {
        if (!this.recognition) return;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.isStarting = false;
            if (this.onStatusChange) this.onStatusChange(true);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.isStarting = false;
            if (this.onStatusChange) this.onStatusChange(false);
        };

        this.recognition.onerror = (event: any) => {
            const errorType = event.error;
            
            // 针对不同类型的错误提供更友好的处理
            switch (errorType) {
                case 'no-speech':
                    console.debug("VoiceService: No speech detected.");
                    break;
                case 'network':
                    console.error("VoiceService Network Error: 请检查您的互联网连接，或者浏览器无法连接到语音识别服务。");
                    // 仅在手动触发且确实发生错误时提醒用户
                    if (this.isListening || this.isStarting) {
                        alert("语音识别网络连接失败。请确保网络畅通，或检查是否禁用了浏览器的语音服务。");
                    }
                    break;
                case 'not-allowed':
                    console.error("VoiceService: Microphone permission denied.");
                    alert("无法访问麦克风。请在浏览器设置中允许此页面使用麦克风。");
                    break;
                default:
                    console.error("VoiceService Error:", errorType);
            }

            this.isListening = false;
            this.isStarting = false;
            if (this.onStatusChange) this.onStatusChange(false);
        };

        this.recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (this.onResult) {
                this.onResult(finalTranscript || interimTranscript, !!finalTranscript);
            }
        };
    }

    public start(onResult: VoiceCallback, onStatusChange?: StatusCallback) {
        if (!this.recognition) {
            alert("您的浏览器不支持语音输入 (仅限 Chrome/Edge 等 WebKit 内核浏览器)");
            return;
        }
        
        if (this.isListening || this.isStarting) {
            this.stop();
            return;
        }

        this.onResult = onResult;
        this.onStatusChange = onStatusChange || null;
        this.isStarting = true; 
        
        try {
            this.recognition.start();
        } catch (e: any) {
            this.isStarting = false;
            if (e.message && e.message.includes('already started')) {
                this.isListening = true;
                if (this.onStatusChange) this.onStatusChange(true);
            } else {
                console.error("VoiceService: Failed to start", e);
            }
        }
    }

    public stop() {
        if (this.recognition && (this.isListening || this.isStarting)) {
            try {
                this.recognition.stop();
            } catch (e) {
                console.warn("VoiceService: Stop failed", e);
            }
        }
    }

    public isSupported(): boolean {
        return !!this.recognition;
    }
}

export const voiceService = new VoiceService();
