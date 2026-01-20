
import { TenantKBRM, TenantENV } from '../types';

const ENV_CONFIG_KEY = 'kashio_env_config_v2';

export interface PersistedEnvConfig {
  tenantKBRM: TenantKBRM;
  tenantENV: TenantENV;
  serviceKey?: string;
  authUsername?: string;
  authPassword?: string;
  userAuthKey?: string;
}

export function saveEnvConfig(config: PersistedEnvConfig) {
  localStorage.setItem(ENV_CONFIG_KEY, JSON.stringify(config));
}

export function loadEnvConfig(): PersistedEnvConfig | null {
  const stored = localStorage.getItem(ENV_CONFIG_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearEnvConfig() {
  localStorage.removeItem(ENV_CONFIG_KEY);
}
