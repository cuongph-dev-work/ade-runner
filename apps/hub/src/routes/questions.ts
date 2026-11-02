import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type Database from "better-sqlite3";
import {
  ReplyQuestionInputSchema,
  type EventType,
  type ActorType,
  type QuestionCardPayload,
} from "@ade/shared";

export const registerQuestionRoutes: FastifyPluginAsync<{
  sqlite: Database.Database;
  appendEvent: (evt: {
    type: EventType;
    projectId: string | null;
    threadId: string | null;
    runId: string | null;
    actorType: ActorType;
    actorId: string;
    payload: Record<string, unknown>;
  }) => void;
}> = async (app: FastifyInstance, opts) => {
  app.get<{ Params: { threadId: string; questionId: string } }>(
    "/api/threads/:threadId/questions/:questionId",
    async (req, reply) => {
      const { threadId, questionId } = req.params;
      const row = opts.sqlite
        .prepare(
          `SELECT card_json FROM messages
           WHERE thread_id = ? AND (id = ? OR card_json LIKE ?)`
        )
        .get(threadId, questionId, `%"question_id":"${questionId}"%`) as
        | { card_json: string }
        | undefined;

      if (!row?.card_json) {
        return reply.status(404).send({ code: "ERR_NOT_FOUND", message: "Question not found" });
      }

      return reply.status(200).send(JSON.parse(row.card_json));
    }
  );

  app.post<{ Params: { threadId: string; questionId: string } }>(
    "/api/threads/:threadId/questions/:questionId/reply",
    async (req, reply) => {
      const { threadId, questionId } = req.params;
      const parsed = ReplyQuestionInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(422).send({
          code: "ERR_VALIDATION",
          message: "Dữ liệu trả lời không hợp lệ",
          details: parsed.error.format(),
        });
      }

      const row = opts.sqlite
        .prepare(
          `SELECT id, run_id, card_json FROM messages
           WHERE thread_id = ? AND (id = ? OR card_json LIKE ?)`
        )
        .get(threadId, questionId, `%"question_id":"${questionId}"%`) as
        | { id: string; run_id: string | null; card_json: string }
        | undefined;

      if (!row?.card_json) {
        return reply.status(404).send({ code: "ERR_NOT_FOUND", message: "Question not found" });
      }

      const card = JSON.parse(row.card_json) as QuestionCardPayload;
      if (card.status !== "pending") {
        return reply.status(409).send({
          code: "ERR_ALREADY_RESOLVED",
          message: `Câu hỏi đã ở trạng thái ${card.status}`,
        });
      }

      const now = new Date().toISOString();
      const answerText = parsed.data.answer ?? (parsed.data.answers?.[0]?.text ?? "");
      const optionId = parsed.data.optionId ?? (parsed.data.answers?.[0]?.selected_option_ids?.[0] ?? null);

      card.status = "answered";
      card.answer = answerText;
      card.selected_option_id = optionId;
      card.answers = (parsed.data.answers as QuestionCardPayload["answers"]) ?? [];
      card.answered_by = "usr_current";
      card.answered_at = now;

      opts.sqlite
        .prepare("UPDATE messages SET card_json = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(card), now, row.id);

      const thread = opts.sqlite
        .prepare("SELECT project_id, state FROM threads WHERE id = ?")
        .get(threadId) as { project_id: string; state: string } | undefined;

      if (row.run_id) {
        opts.sqlite
          .prepare("UPDATE runs SET status = 'running' WHERE id = ? AND status = 'waiting_human'")
          .run(row.run_id);
      }

      opts.appendEvent({
        type: "question.answered",
        projectId: thread?.project_id ?? null,
        threadId,
        runId: row.run_id,
        actorType: "human",
        actorId: "usr_current",
        payload: {
          question_id: questionId,
          run_id: row.run_id,
          answer: answerText,
          option_id: optionId,
          answers: card.answers,
          answered_by: "usr_current",
          card_message_id: row.id,
        },
      });

      return reply.status(200).send({
        question_id: questionId,
        status: "answered",
        answer: answerText,
        option_id: optionId,
        answers: card.answers,
        thread_state: thread?.state ?? "open",
      });
    }
  );
};
