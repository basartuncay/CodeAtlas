export interface CouplingMetrics {
  module_id: string;
  fan_in: number;
  fan_out: number;
  instability: number;
}
