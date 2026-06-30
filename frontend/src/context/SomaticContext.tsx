import React, { createContext, useContext, useState } from 'react';

interface SomaticContextType {
  theta: number;
  pulseTrigger: boolean;
  isPaused: boolean;
  setTheta: (t: number) => void;
  dispatchGlobalPulse: () => void;
  setPaused: (p: boolean) => void;
}

const SomaticContext = createContext<SomaticContextType | undefined>(undefined);

export const SomaticProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theta, setTheta] = useState<number>(0.82); // Bound: [-1.0, 1.0]
  const [pulseTrigger, setPulseTrigger] = useState<boolean>(false);
  const [isPaused, setPaused] = useState<boolean>(false);

  const dispatchGlobalPulse = () => {
    setPulseTrigger(true);
    // Automatically reset trigger state after the CSS/Shader animation cycle concludes
    setTimeout(() => setPulseTrigger(false), 500);
  };

  return (
    <SomaticContext.Provider value={{ theta, pulseTrigger, isPaused, setTheta, dispatchGlobalPulse, setPaused }}>
      {children}
    </SomaticContext.Provider>
  );
};

export const useSomaticContext = () => {
  const context = useContext(SomaticContext);
  if (!context) throw new Error("useSomaticContext must be used within a SomaticProvider");
  return context;
};
