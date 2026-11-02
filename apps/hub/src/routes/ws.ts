import type { FastifyInstance } from "fastify";
import { ERROR_CODES, WsClientEventSchema, type WsServerEvent } from "@ade/shared";
import type { InMemoryEventBus } from "../events/event-bus.js";

export async function registerWsRoutes(
  app: FastifyInstance,
  eventBus: InMemoryEventBus
): Promise<void> {
  app.get("/ws", { websocket: true }, (socket) => {
    const sendFrame = (frame: WsServerEvent): void => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(frame));
      }
    };

    sendFrame({
      type: "ws.connected",
      data: {
        mode: "solo",
        serverTime: new Date().toISOString()
      }
    });

    const unsubscribe = eventBus.subscribe((frame) => {
      sendFrame(frame);
    });

    socket.on("message", (rawBuf) => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(String(rawBuf));
      } catch {
        sendFrame({
          type: "ws.error",
          data: {
            code: "ERR_VALIDATION",
            message: ERROR_CODES.ERR_VALIDATION.defaultMessage
          }
        });
        return;
      }

      const checked = WsClientEventSchema.safeParse(parsedJson);
      if (!checked.success) {
        sendFrame({
          type: "ws.error",
          data: {
            code: "ERR_VALIDATION",
            message: ERROR_CODES.ERR_VALIDATION.defaultMessage
          }
        });
        return;
      }

      if (checked.data.type === "ping") {
        sendFrame({
          type: "ws.pong",
          data: { ts: new Date().toISOString() }
        });
      }
    });

    socket.on("close", () => {
      unsubscribe();
    });
  });
}
