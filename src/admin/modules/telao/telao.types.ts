export type TelaoDisplayMode = 'live' | 'final-real' | 'final' | 'campeonato';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type TelaoState = {
  id: number;
  layout: JsonValue;
  page_offset: number;
  display_mode: TelaoDisplayMode;
  campeonato_id: string | null;
  updated_at: string;
};

export type TelaoStateUpdate = Partial<
  Pick<TelaoState, 'layout' | 'page_offset' | 'display_mode' | 'campeonato_id'>
>;
