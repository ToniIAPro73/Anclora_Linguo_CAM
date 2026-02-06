class PCMWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = options?.processorOptions || {};
    this.chunkSize = processorOptions.chunkSize || 320;
    this.vadThreshold = processorOptions.vadThreshold || 0.01;
    this.buffer = new Float32Array(this.chunkSize);
    this.bufferIndex = 0;
    this.active = false;
    this.port.onmessage = (event) => {
      if (event.data?.type === "state") {
        this.active = !!event.data.active;
      }
      if (event.data?.type === "config") {
        if (typeof event.data.vadThreshold === "number") {
          this.vadThreshold = event.data.vadThreshold;
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
        if (this.active && this.passesVad(this.buffer)) {
          const int16 = new Int16Array(this.chunkSize);
          for (let j = 0; j < this.chunkSize; j++) {
            const sample = Math.max(-1, Math.min(1, this.buffer[j]));
            int16[j] = sample * 32767;
          }
          this.port.postMessage(
            { type: "audio", payload: int16.buffer },
            [int16.buffer],
          );
        }
        this.bufferIndex = 0;
      }
    }

    return true;
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
