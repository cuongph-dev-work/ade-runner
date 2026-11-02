import type { WsServerEvent } from "@ade/shared";

export type WsEventListener = (frame: WsServerEvent) => void;

export class InMemoryEventBus {
  private readonly listeners = new Set<WsEventListener>();

  subscribe(listener: WsEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(frame: WsServerEvent): void {
    for (const listener of this.listeners) {
      listener(frame);
    }
  }
}
