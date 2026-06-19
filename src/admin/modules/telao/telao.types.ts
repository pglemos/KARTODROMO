export type TelaoDisplayMode = 'live' | 'final-real' | 'final';

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
  updated_at: string;
};

export type TelaoStateUpdate = Partial<
  Pick<TelaoState, 'layout' | 'page_offset' | 'display_mode'>
>;
