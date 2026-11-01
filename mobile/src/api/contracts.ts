export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface RegistrationInput {
  name: string;
  cpf: string;
  email: string;
  phone: string;
  password: string;
  privacyAccepted: true;
}

export interface MessageResponse {
  mensagem: string;
}

export interface SuccessResponse {
  ok: true;
}
