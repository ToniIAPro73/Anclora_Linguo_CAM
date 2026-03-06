class PCMWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = options?.processorOptions || {};
    this.chunkSize = processorOptions.chunkSize || 320;
    this.vadThreshold = processorOptions.vadThreshold || 0.01;
    this.minSpeechMs = processorOptions.minSpeechMs || 220;
    this.minSilenceMs = processorOptions.minSilenceMs || 420;
    this.maxSegmentMs = processorOptions.maxSegmentMs || 2400;
    this.hangoverMs = processorOptions.hangoverMs || 120;
    this.buffer = new Float32Array(this.chunkSize);
    this.bufferIndex = 0;
    this.active = false;
    this.inSpeech = false;
    this.segmentSpeechMs = 0;
    this.segmentSilenceMs = 0;
    this.segmentDurationMs = 0;
    this.hangoverRemainingMs = 0;

    this.port.onmessage = (event) => {
      if (event.data?.type === "state") {
        this.active = !!event.data.active;
      }
      if (event.data?.type === "config") {
        if (typeof event.data.chunkSize === "number") {
          const nextChunkSize = Math.max(160, Math.min(960, Math.round(event.data.chunkSize)));
          if (nextChunkSize !== this.chunkSize) {
            this.chunkSize = nextChunkSize;
            this.buffer = new Float32Array(this.chunkSize);
            this.bufferIndex = 0;
          }
        }
        if (typeof event.data.vadThreshold === "number") {
          this.vadThreshold = event.data.vadThreshold;
        }
        if (typeof event.data.minSpeechMs === "number") {
          this.minSpeechMs = Math.max(20, event.data.minSpeechMs);
        }
        if (typeof event.data.minSilenceMs === "number") {
          this.minSilenceMs = Math.max(60, event.data.minSilenceMs);
        }
        if (typeof event.data.maxSegmentMs === "number") {
          this.maxSegmentMs = Math.max(500, event.data.maxSegmentMs);
        }
        if (typeof event.data.hangoverMs === "number") {
          this.hangoverMs = Math.max(0, event.data.hangoverMs);
        }
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.bufferIndex++] = channel[i];
      if (this.bufferIndex >= this.chunkSize) {
        if (this.active) this.handleChunk(this.buffer);
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  handleChunk(buffer) {
    const chunkDurationMs = Math.round((buffer.length / sampleRate) * 1000);
    const isSpeech = this.passesVad(buffer);
    const shouldEmitSilenceTail = this.inSpeech && this.hangoverRemainingMs > 0;

    if (isSpeech) {
      if (!this.inSpeech) {
        this.inSpeech = true;
        this.segmentSpeechMs = 0;
        this.segmentSilenceMs = 0;
        this.segmentDurationMs = 0;
        this.hangoverRemainingMs = this.hangoverMs;
      }
      this.segmentSpeechMs += chunkDurationMs;
      this.segmentSilenceMs = 0;
      this.hangoverRemainingMs = this.hangoverMs;
    } else if (this.inSpeech) {
      this.segmentSilenceMs += chunkDurationMs;
      this.hangoverRemainingMs = Math.max(0, this.hangoverRemainingMs - chunkDurationMs);
    }

    if (isSpeech || shouldEmitSilenceTail) {
      this.emitAudioChunk(buffer);
      if (this.inSpeech) {
        this.segmentDurationMs += chunkDurationMs;
      }
    }

    if (!this.inSpeech) return;

    if (
      this.segmentSpeechMs >= this.minSpeechMs &&
      this.segmentSilenceMs >= this.minSilenceMs
    ) {
      this.emitSegmentEnd("silence");
      return;
    }

    if (this.segmentDurationMs >= this.maxSegmentMs) {
      this.emitSegmentEnd("max_segment");
    }
  }

  emitAudioChunk(floatBuffer) {
    const int16 = new Int16Array(this.chunkSize);
    for (let j = 0; j < this.chunkSize; j++) {
      const sample = Math.max(-1, Math.min(1, floatBuffer[j]));
      int16[j] = sample * 32767;
    }
    this.port.postMessage(
      { type: "audio", payload: int16.buffer },
      [int16.buffer],
    );
  }

  emitSegmentEnd(reason) {
    this.port.postMessage({ type: "segment_end", reason });
    this.inSpeech = false;
    this.segmentSpeechMs = 0;
    this.segmentSilenceMs = 0;
    this.segmentDurationMs = 0;
    this.hangoverRemainingMs = 0;
  }

  passesVad(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / buffer.length);
    return rms >= this.vadThreshold;
  }
}

registerProcessor("pcm-worklet", PCMWorkletProcessor);
