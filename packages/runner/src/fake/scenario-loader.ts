import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { FakeScenarioYamlSchema, type FakeScenarioYaml } from "@ade/shared";

export function loadScenarioFromFile(scenarioPath: string): FakeScenarioYaml {
  const raw = readFileSync(scenarioPath, "utf8");
  const parsed = parseYaml(raw);
  return FakeScenarioYamlSchema.parse(parsed);
}
