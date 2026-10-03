// server-health ships no typings; this declares the subset of its API used here.
declare module 'server-health' {
  export type ConnectionCheck = () => boolean | Promise<boolean>;

  export function addConnectionCheck(name: string, check: ConnectionCheck): void;
  export function resetConnectionCheck(): void;
  export function exposeHealthEndpoint(
    server: unknown,
    endpoint?: string,
    framework?: 'express',
  ): void;
}
