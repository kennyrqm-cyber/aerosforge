export function speakController(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    throw new Error('Browser speech synthesis is unavailable.');
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.92;
  utterance.pitch = 0.9;
  window.speechSynthesis.speak(utterance);
}
