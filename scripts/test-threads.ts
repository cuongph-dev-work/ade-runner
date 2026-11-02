import { openHubDatabase } from "../apps/hub/src/db/client.js";
import { ChatService } from "../apps/hub/src/chat/chat-service.js";
import { ThreadListResponseSchema } from "../packages/shared/src/schemas/chat.js";

const hubDb = openHubDatabase("/Users/cuongph/Workspace/ade-runner/.ade-data/ade.db");
const chatService = new ChatService(hubDb, { publish: () => {} });
try {
  const threads = chatService.listThreads("chn_01m6av38nkazwr5w8brkw0rvfh");
  console.log("Threads count:", threads.length);
  ThreadListResponseSchema.parse({ threads });
  console.log("Validation PASSED!");
} catch (e: any) {
  console.error("Error:", e.errors || e);
}
