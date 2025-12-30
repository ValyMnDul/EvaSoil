
export interface SensorData {
  moisture: number;
  temperature: number;
  timestamp: number;
  device_id: string;
}

export interface SensorReading extends SensorData {
  id: number;            
  created_at: string; 
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface SensorStats {
  avgMoisture: number; 
  avgTemperature: number;       
  minMoisture: number;       
  maxMoisture: number;     
  lastReading: SensorReading | null; 
  readingsCount: number; 
}