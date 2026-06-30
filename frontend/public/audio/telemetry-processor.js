class TelemetryProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.baseFreq = (options.processorOptions && options.processorOptions.baseFreq) || 220;
    this.theta = 1.0;
    this.amplitude = 0.0;
    this.phase = 0;
    
    this.port.onmessage = (e) => {
      this.theta = e.data.theta ?? this.theta;
      this.amplitude = e.data.amplitude ?? this.amplitude;
    };
  }
  
  process(inputs, outputs) {
    const output = outputs[0][0];
    if (!output) return true;
    const freq = this.baseFreq * this.theta;
    
    for (let i = 0; i < output.length; i++) {
      this.phase += (freq * 2 * Math.PI) / sampleRate;
      output[i] = Math.sin(this.phase) * this.amplitude;
    }
    
    return true; // keep alive
  }
}

registerProcessor('telemetry-processor', TelemetryProcessor);

class RoomAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.rooms = new Map(); // roomId -> { baseFreq, activeAgents, taskStatus, consensusLevel, pan }
    this.globalTheta = 1.0;
    this.globalWickState = 'LIVE';
    this.globalPhase = 0;

    this.port.onmessage = (e) => {
      if (e.data.type === 'roomUpdate') {
        this.rooms.set(e.data.roomId, e.data.params);
      } else if (e.data.type === 'globalTelemetry') {
        this.globalTheta = e.data.theta;
        this.globalWickState = e.data.wickState;
      }
    };
  }

  static get parameterDescriptors() {
    return [
      { name: 'masterGain', defaultValue: 0.3, minValue: 0, maxValue: 1 }
    ];
  }

  process(inputs, outputs, parameters) {
    const outputL = outputs[0][0];
    const outputR = outputs[0][1];
    if (!outputL || !outputR) return true;
    
    const masterGain = parameters.masterGain ? (parameters.masterGain[0] !== undefined ? parameters.masterGain[0] : 0.3) : 0.3;
    
    // Clear buffers
    outputL.fill(0);
    outputR.fill(0);
    
    // Global system drone (always present, low amplitude)
    const globalFreq = 220 * this.globalTheta; // A3 base
    const globalAmp = (this.globalWickState && this.globalWickState.toUpperCase() === 'LIVE') ? 0.05 : 0.01;
    
    for (let i = 0; i < outputL.length; i++) {
      const sample = Math.sin(this.globalPhase) * globalAmp * masterGain;
      outputL[i] += sample;
      outputR[i] += sample;
      this.globalPhase += (globalFreq * 2 * Math.PI) / sampleRate;
      if (this.globalPhase > 2 * Math.PI) {
        this.globalPhase -= 2 * Math.PI;
      }
    }
    
    // Per-room tones
    for (const [roomId, params] of this.rooms) {
      const { baseFreq, activeAgents, taskStatus, consensusLevel, pan } = params;
      
      // Frequency: base + (agents * 10Hz per agent)
      const freq = baseFreq + (activeAgents * 10);
      
      // Amplitude: higher for active tasks, lower for completed
      const amp = taskStatus === 'completed' ? 0.05 : 
                  taskStatus === 'stalled' ? 0.2 : 0.1;
      
      // Dissonance: 1.0 - consensusLevel = beating frequency
      const dissonance = (1.0 - consensusLevel) * 5; // 0-5Hz beating
      
      // Track phase across process loops to avoid pops/crackles
      if (params.phase === undefined) {
        params.phase = 0;
      }
      
      // Generate tone with dissonance/beating
      for (let i = 0; i < outputL.length; i++) {
        const sample1 = Math.sin(params.phase);
        const sample2 = Math.sin(params.phase * (1 + dissonance / freq));
        const sample = ((sample1 + sample2) / 2) * amp * masterGain;
        
        // Pan to stereo field
        outputL[i] += sample * (1 - pan);
        outputR[i] += sample * pan;
        
        // Update phase
        params.phase += (freq * 2 * Math.PI) / sampleRate;
        if (params.phase > 2 * Math.PI) {
          params.phase -= 2 * Math.PI;
        }
      }
    }
    
    return true;
  }
}

registerProcessor('room-audio-processor', RoomAudioProcessor);
