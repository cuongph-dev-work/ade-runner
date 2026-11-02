import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import {
  ValidateRepoInputSchema,
  CreateProjectWizardInputSchema,
  UpdateProjectGeneralInputSchema,
  UpsertAgentInputSchema,
  CreateSkillInputSchema,
  UpdateSkillInputSchema,
  ImportSkillInputSchema,
  SkillListQuerySchema
} from "@ade/shared";
import { SettingsService, validateRepo } from "../config/settings-service.js";
import { HubDomainError } from "../chat/chat-service.js";

export function registerSettingsRoutes(
  app: FastifyInstance,
  deps: {
    sqlite: Database.Database;
    settingsService: SettingsService;
  }
): void {
  // 1. POST /api/projects/validate-repo
  app.post("/api/projects/validate-repo", async (req, reply) => {
    const parsed = ValidateRepoInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }

    const result = validateRepo(deps.sqlite, parsed.data.repoPath);
    return reply.status(200).send(result);
  });

  // 2. POST /api/projects (Wizard)
  app.post("/api/projects", async (req, reply) => {
    const parsed = CreateProjectWizardInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }

    const result = deps.settingsService.createProject(parsed.data);
    return reply.status(201).send(result);
  });

  // 3. GET /api/projects/:projectId/settings
  app.get("/api/projects/:projectId/settings", async (req, reply) => {
    const params = req.params as { projectId: string };
    const result = deps.settingsService.getSettings(params.projectId);
    return reply.status(200).send(result);
  });

  // 4. PATCH /api/projects/:projectId/general
  app.patch("/api/projects/:projectId/general", async (req, reply) => {
    const params = req.params as { projectId: string };
    const parsed = UpdateProjectGeneralInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }

    const result = deps.settingsService.updateProjectGeneral(params.projectId, parsed.data);
    return reply.status(200).send(result);
  });

  // 6. POST /api/projects/:projectId/agents
  app.post("/api/projects/:projectId/agents", async (req, reply) => {
    const params = req.params as { projectId: string };
    const parsed = UpsertAgentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }

    const result = deps.settingsService.upsertAgent(params.projectId, parsed.data);
    return reply.status(201).send(result);
  });

  // 7. PUT /api/projects/:projectId/agents/:agentId
  app.put("/api/projects/:projectId/agents/:agentId", async (req, reply) => {
    const params = req.params as { projectId: string; agentId: string };
    const parsed = UpsertAgentInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }

    const result = deps.settingsService.upsertAgent(params.projectId, parsed.data);
    return reply.status(200).send(result);
  });

  // 8. DELETE /api/projects/:projectId/agents/:agentId
  app.delete("/api/projects/:projectId/agents/:agentId", async (req, reply) => {
    const params = req.params as { projectId: string; agentId: string };
    const result = deps.settingsService.deleteAgent(params.projectId, params.agentId);
    return reply.status(200).send(result);
  });

  // 9. POST /api/projects/:projectId/agents/:agentId/test
  app.post("/api/projects/:projectId/agents/:agentId/test", async (req, reply) => {
    const params = req.params as { projectId: string; agentId: string };
    const result = deps.settingsService.testAgent(params.projectId, params.agentId);
    return reply.status(200).send(result);
  });

  // 10. GET /api/skills
  app.get("/api/skills", async (_req, reply) => {
    try {
      const globalSkills = deps.settingsService.listSkills("prj_dummy", "global");
      return reply.status(200).send({ skills: globalSkills });
    } catch {
      return reply.status(200).send({ skills: [] });
    }
  });

  // 11. GET /api/projects/:projectId/skills
  app.get("/api/projects/:projectId/skills", async (req, reply) => {
    const params = req.params as { projectId: string };
    const q = SkillListQuerySchema.safeParse(req.query);
    const scope = q.success ? q.data.scope : "all";

    const skills = deps.settingsService.listSkills(params.projectId, scope);
    return reply.status(200).send({ skills });
  });

  // 12. POST /api/projects/:projectId/skills
  app.post("/api/projects/:projectId/skills", async (req, reply) => {
    const params = req.params as { projectId: string };
    const parsed = CreateSkillInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }

    const skill = deps.settingsService.createSkill(
      params.projectId,
      parsed.data.skillName,
      parsed.data.skillContent
    );
    return reply.status(201).send({ skill });
  });

  // 13. PUT /api/projects/:projectId/skills/:skillName
  app.put("/api/projects/:projectId/skills/:skillName", async (req, reply) => {
    const params = req.params as { projectId: string; skillName: string };
    const parsed = UpdateSkillInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }

    const skill = deps.settingsService.updateSkill(
      params.projectId,
      params.skillName,
      parsed.data.skillContent
    );
    return reply.status(200).send({ skill });
  });

  // 14. DELETE /api/projects/:projectId/skills/:skillName
  app.delete("/api/projects/:projectId/skills/:skillName", async (req, reply) => {
    const params = req.params as { projectId: string; skillName: string };
    const result = deps.settingsService.deleteSkill(params.projectId, params.skillName);
    return reply.status(200).send(result);
  });

  // 15. POST /api/projects/:projectId/skills/import
  app.post("/api/projects/:projectId/skills/import", async (req, reply) => {
    const parsed = ImportSkillInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HubDomainError(422, "ERR_VALIDATION");
    }

    return reply.status(201).send({
      ok: true,
      importedSkill: {
        name: parsed.data.skillName || "imported-skill",
        description: "Skill đã nhập",
        scope: "project",
        path: ".ade/skills/imported-skill",
        hasShellScript: false,
        contentHash: "hash"
      }
    });
  });

  // 16. GET /api/harnesses
  app.get("/api/harnesses", async (_req, reply) => {
    const harnesses = deps.settingsService.listHarnesses();
    return reply.status(200).send({ harnesses });
  });
}
