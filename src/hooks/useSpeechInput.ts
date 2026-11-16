import { useCallback, useEffect, useRef, useState } from 'react';

const SPEECH_LANGUAGE = 'id-ID';

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Izin mikrofon ditolak. Aktifkan mikrofon untuk situs ini di pengaturan browser.',
  'service-not-allowed':
    'Browser ini tidak mengizinkan pengenalan suara. Silakan ketik transaksinya.',
  'audio-capture': 'Mikrofon tidak ditemukan. Periksa mikrofon perangkat Anda.',
  'no-speech': 'Suara tidak terdengar. Coba lagi.',
  network: 'Pengenalan suara butuh internet. Periksa koneksi lalu coba lagi.',
};

interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognizer {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognizerConstructor = new () => SpeechRecognizer;

function getRecognizerConstructor(): SpeechRecognizerConstructor | null {
  const speechWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognizerConstructor;
    webkitSpeechRecognition?: SpeechRecognizerConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

interface SpeechInputOptions {
  onTranscript: (text: string) => void;
  onFinished: (text: string) => void;
}

/** Browser speech recognition. Audio is handled by the browser, so no Gemini quota is used. */
export function useSpeechInput({ onTranscript, onFinished }: SpeechInputOptions) {
  const [isSupported] = useState(() => getRecognizerConstructor() !== null);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const callbacksRef = useRef({ onTranscript, onFinished });
  callbacksRef.current = { onTranscript, onFinished };

  const cancelListening = useCallback(() => {
    const recognizer = recognizerRef.current;
    if (!recognizer) return;
    recognizerRef.current = null; // A cancelled session must not submit what it heard.
    recognizer.abort();
    setIsListening(false);
  }, []);

  useEffect(() => cancelListening, [cancelListening]);

  const stopListening = useCallback(() => recognizerRef.current?.stop(), []);

  const startListening = useCallback(() => {
    const Recognizer = getRecognizerConstructor();
    if (!Recognizer || recognizerRef.current) return;

    const recognizer = new Recognizer();
    let transcript = '';
    recognizer.lang = SPEECH_LANGUAGE;
    recognizer.interimResults = true;
    recognizer.continuous = false;
    recognizer.maxAlternatives = 1;

    recognizer.onresult = (event) => {
      // Android resends earlier words, so the text is rebuilt rather than appended.
      transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      callbacksRef.current.onTranscript(transcript);
    };

    recognizer.onerror = (event) => {
      if (event.error !== 'aborted') {
        setSpeechError(ERROR_MESSAGES[event.error] ?? 'Suara gagal dikenali. Coba lagi.');
      }
    };

    recognizer.onend = () => {
      if (recognizerRef.current !== recognizer) return;
      recognizerRef.current = null;
      setIsListening(false);
      if (transcript) callbacksRef.current.onFinished(transcript);
    };

    setSpeechError(null);
    recognizerRef.current = recognizer;
    try {
      recognizer.start();
      setIsListening(true);
    } catch (error) {
      console.error('Failed starting speech recognition:', error);
      recognizerRef.current = null;
      setSpeechError('Mikrofon belum bisa dimulai. Coba lagi.');
    }
  }, []);

  return { isSupported, isListening, speechError, startListening, stopListening, cancelListening };
}
