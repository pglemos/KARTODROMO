const MOBILE_API_HOST = 'reservas.kartodromodebetim.com.br';

export function mobileApiEndpoint(destination: string | undefined, path: string, allowLocalSimulation = false): URL | null {
  if (!destination) return null;

  try {
    const endpoint = new URL(destination);
    const loopback = ['127.0.0.1', 'localhost', '::1'].includes(endpoint.hostname);
    const localSimulation = allowLocalSimulation && loopback && ['http:', 'https:'].includes(endpoint.protocol);
    const trustedProduction = endpoint.protocol === 'https:' && endpoint.hostname === MOBILE_API_HOST && endpoint.port === '';

    if (
      (!localSimulation && !trustedProduction) ||
      endpoint.pathname !== path ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    ) return null;

    return endpoint;
  } catch {
    return null;
  }
}
