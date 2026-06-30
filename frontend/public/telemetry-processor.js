class TelemetryProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'theta', defaultValue: 0.82, minValue: -1, maxValue: 1 },
      { name: 'wick', defaultValue: 1, minValue: 0, maxValue: 1 } // 0: frozen, 1: live
    ];
  }
  
  constructor() {
    super();
    this.phase = 0;
    this.phaseHarmonic2 = 0;
    this.phaseHarmonic3 = 0;
    this.phaseDissonant = 0;
    this.currentFreq = 440;
  }
  
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const thetaParam = parameters.theta;
    const wickParam = parameters.wick;
    
    for (let i = 0; i < output[0].length; i++) {
      // Normalize theta from [-1, 1] to [0, 1] for frequency mapping
      const rawTheta = thetaParam.length > 1 ? thetaParam[i] : thetaParam[0];
      const theta = Math.max(0, Math.min(1, (rawTheta + 1) / 2));
      const wick = wickParam.length > 1 ? wickParam[i] : wickParam[0];
      
      // Base Tone: 110Hz to 880Hz
      const targetFreq = 110 + theta * (880 - 110);
      // Smooth frequency transitions (approx 10ms ramp at typical sample rates)
      this.currentFreq = this.currentFreq + 0.005 * (targetFreq - this.currentFreq);
      
      const sampleRate = globalThis.sampleRate || 48000;
      const phaseInc = (2 * Math.PI * this.currentFreq) / sampleRate;
      this.phase += phaseInc;
      
      // Keep phase within 2 * PI to prevent float precision issues over long times
      if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
      
      let sample = Math.sin(this.phase); // base tone
      
      // Harmonics added when theta > 0.7 (resonant health)
      if (rawTheta > 0.7) {
        this.phaseHarmonic2 += phaseInc * 2;
        this.phaseHarmonic3 += phaseInc * 3;
        if (this.phaseHarmonic2 > 2 * Math.PI) this.phaseHarmonic2 -= 2 * Math.PI;
        if (this.phaseHarmonic3 > 2 * Math.PI) this.phaseHarmonic3 -= 2 * Math.PI;
        
        sample += 0.3 * Math.sin(this.phaseHarmonic2);
        sample += 0.2 * Math.sin(this.phaseHarmonic3);
      }
      
      // Dissonance detuned secondary oscillator when theta < 0.3
      if (rawTheta < 0.3) {
        this.phaseDissonant += phaseInc * 1.02; // Beating frequency
        if (this.phaseDissonant > 2 * Math.PI) this.phaseDissonant -= 2 * Math.PI;
        
        sample += 0.5 * Math.sin(this.phaseDissonant);
      }
      
      // Amplitude mapping (FROZEN = -60dB approx 0.001, LIVE = 0dB approx 1.0)
      const targetAmp = wick === 1 ? 1.0 : 0.001; 
      
      // Attenuate to avoid clipping and allow headroom
      const finalSample = sample * targetAmp * 0.15;
      
      output[0][i] = finalSample;
      if (output[1]) {
        output[1][i] = finalSample;
      }
    }
    
    return true;
  }
}

registerProcessor('telemetry-processor', TelemetryProcessor);
