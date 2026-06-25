export interface RequestContextValues {
  readonly requestId: string;
}

export type ServerAppBindings = {
  Variables: RequestContextValues;
};
