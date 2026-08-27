const ADMIN_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  admin_auth_not_configured: 'O login administrativo ainda não foi configurado.',
  invalid_credentials: 'E-mail ou senha inválidos.',
  unauthorized: 'Sua sessão terminou. Entre novamente para continuar.',
  forbidden: 'Seu perfil não tem permissão para executar esta ação.',
  record_not_found: 'O registro não foi encontrado. Atualize a tela e tente novamente.',
  read_only_resource: 'Esta informação é somente leitura.',
  resource_not_found: 'A informação solicitada não foi encontrada.',
  invalid_payload: 'Revise os dados informados e tente novamente.',
  invalid_sale: 'Revise os itens e a forma de pagamento da venda.',
  invalid_sale_item: 'Revise os itens selecionados para a venda.',
  produto_id_required: 'Selecione um produto para continuar.',
  produto_indisponivel: 'Este produto não está disponível.',
  estoque_insuficiente: 'Não há estoque suficiente para esta venda.',
  status_invalid: 'Selecione um status válido.',
  empty_update: 'Informe ao menos uma alteração.',
  championship_registration_not_found: 'A inscrição não foi encontrada. Atualize a tela e tente novamente.',
  championship_registration_not_created: 'Não foi possível criar a inscrição.',
  championship_registrations_unavailable: 'As inscrições não estão disponíveis neste momento.',
  championship_registration_update_failed: 'Não foi possível atualizar a inscrição.',
  cloudflare_d1_not_configured: 'A base administrativa não está disponível neste ambiente.',
  local_api_invalid_response: 'A fonte de dados retornou uma resposta inválida.',
  local_api_unreachable: 'Não foi possível conectar à fonte de dados local.',
  local_api_timeout: 'A fonte de dados local demorou para responder. Tente novamente.',
  laptime_fleet_unavailable: 'Não foi possível atualizar a frota de karts.',
  laptime_fleet_invalid_response: 'A frota retornou uma resposta inválida.',
  laptime_live_unreachable: 'Não foi possível consultar a cronometragem ao vivo.',
  qualifying_session_changed: 'A sessão mudou durante a operação. Atualize e tente novamente.',
  telao_layout_persistence_failed: 'Não foi possível persistir o layout do telão.',
  local_api_not_configured: 'A fonte de dados local não está configurada.',
  laptime_bridge_not_configured: 'A conexão com o LapTime não está configurada.',
  laptime_bridge_unreachable: 'Não foi possível conectar ao LapTime.',
  laptime_bridge_timeout: 'O LapTime demorou para responder. Tente atualizar em alguns segundos.',
  laptime_remote_timeout: 'O LapTime demorou para responder. Tente novamente em alguns segundos.',
  calxpro_bridge_unreachable: 'Não foi possível consultar o histórico do CalXPro.',
  calxpro_bridge_not_configured: 'A conexão com o histórico do CalXPro não está configurada.',
  calxpro_bridge_timeout: 'O histórico do CalXPro demorou para responder. Tente novamente.',
  viplex_remote_timeout: 'A controladora TB50 não respondeu a tempo. Confirme o bridge local e tente novamente.',
  viplex_remote_not_configured: 'A conexão com a controladora TB50 não está configurada.',
  viplex_remote_failed: 'Não foi possível consultar a controladora TB50.',
  viplex_remote_http_502: 'A controladora TB50 recusou a conexão.',
  tb50_remote_timeout: 'A controladora TB50 demorou para responder. Tente novamente.',
  equalizacao_database_not_configured: 'A base de equalização não está disponível neste ambiente.',
  equalizacao_request_failed: 'Não foi possível concluir a operação de equalização.',
  R2_storage_not_configured: 'O armazenamento de mídia não está configurado.',
  'R2 storage not configured': 'O armazenamento de mídia não está configurado.',
  'Upload failed': 'Não foi possível enviar o arquivo.',
  'No file provided': 'Selecione um arquivo para enviar.',
  'File too large (max 50MB)': 'O arquivo é maior que o limite de 50 MB.',
  'Resposta inválida': 'O servidor retornou uma resposta inválida.',
};

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: 'Revise os dados informados e tente novamente.',
  401: 'Sua sessão terminou. Entre novamente para continuar.',
  403: 'Seu perfil não tem permissão para executar esta ação.',
  404: 'A informação solicitada não foi encontrada.',
  408: 'A operação demorou demais. Tente novamente.',
  409: 'A informação mudou enquanto você trabalhava. Atualize e tente novamente.',
  422: 'Não foi possível validar os dados informados.',
  429: 'Muitas tentativas em sequência. Aguarde um momento e tente novamente.',
  500: 'O servidor encontrou um problema. Tente novamente.',
  502: 'Um serviço integrado não respondeu corretamente. Tente novamente.',
  503: 'Este serviço está temporariamente indisponível.',
};

function statusFromMessage(value: string): number | null {
  const match = value.match(/^HTTP\s+(\d{3})$/i);
  return match ? Number(match[1]) : null;
}

export function humanizeAdminError(value: unknown, fallback = 'Não foi possível concluir a operação.') {
  const raw = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
  const message = raw.trim();
  if (!message) return fallback;
  if (ADMIN_ERROR_MESSAGES[message]) return ADMIN_ERROR_MESSAGES[message];

  const status = statusFromMessage(message);
  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  const remoteStatus = message.match(/^viplex_remote_http_(\d{3})$/i);
  if (remoteStatus) return STATUS_MESSAGES[Number(remoteStatus[1])] || 'A controladora TB50 não respondeu corretamente.';
  if (/^invalid_(?:field|filter):/i.test(message)) return 'Revise os filtros e dados informados.';
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Não foi possível conectar ao serviço. Verifique a conexão e tente novamente.';
  }
  if (/d1_error|sqlite_error|sqlstate|database|(?:^|\s)(?:ec?onnrefused|etimedout|enotfound)(?:\s|$)|stack trace|\bat\s+\w+\s*\(|node_modules|internal server error|unexpected token|unexpected end of json|^typeerror\b|^syntaxerror\b/i.test(message)) {
    return fallback;
  }
  if (/^error:\s*/i.test(message)) return message.replace(/^error:\s*/i, '');
  return message;
}

export function humanizeAdminResponseError(status: number, value?: unknown) {
  return humanizeAdminError(value, STATUS_MESSAGES[status] || 'Não foi possível concluir a operação.');
}
