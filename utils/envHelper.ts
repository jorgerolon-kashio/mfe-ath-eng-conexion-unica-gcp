
import { Environment, EnvironmentConfig } from '../types';
import { getBffUrl } from '../config/environments';

export function buildEnvironmentConfig(environment: Environment): EnvironmentConfig {
  // Usar variable de entorno si está disponible, sino usar el environment pasado
  const bffUrl = getBffUrl();
  
  return {
    name: environment,
    environment,
    bff_url: bffUrl
  };
}
