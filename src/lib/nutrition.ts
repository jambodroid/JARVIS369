import Anthropic from "@anthropic-ai/sdk";

export type NutritionEstimate = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const NUTRITION_SCHEMA = {
  type: "object",
  properties: {
    kcal: { type: "number" },
    protein: { type: "number" },
    carbs: { type: "number" },
    fat: { type: "number" },
  },
  required: ["kcal", "protein", "carbs", "fat"],
  additionalProperties: false,
};

export async function estimateNutrition(description: string): Promise<NutritionEstimate> {
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 512,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: NUTRITION_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Estimate the nutrition for this meal, for one typical serving: "${description}". Give your single best estimate, not a range.`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Nutrition estimate was declined");
  }

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No nutrition estimate returned");
  }

  return JSON.parse(block.text) as NutritionEstimate;
}
