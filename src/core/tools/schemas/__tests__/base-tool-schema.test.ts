import { describe, it, expect } from "vitest"
import { generateFunctionCallSchema, generateAnthropicToolSchema } from "../base-tool-schema"
import { applyDiffSchema } from "../apply-diff-schema"

describe("base-tool-schema", () => {
	it("generateFunctionCallSchema should output correct function call schema for applyDiffSchema", () => {
		const fnSchema = generateFunctionCallSchema(applyDiffSchema)
		expect(fnSchema).toHaveProperty("type", "function")
		expect(fnSchema.function).toHaveProperty("name", "apply_diff")
		expect(fnSchema.function.parameters).toHaveProperty("type", "object")
		expect(fnSchema.function.parameters.properties).toHaveProperty("file")
		expect(fnSchema.function.parameters.required).toContain("file")
		// Check nested property
		expect(
			fnSchema.function.parameters.properties.file.items.properties.diff.items.properties.search_str.type,
		).toBe("string")
	})

	it("generateAnthropicToolSchema should output correct Anthropic tool schema for applyDiffSchema", () => {
		const anthropicSchema = generateAnthropicToolSchema(applyDiffSchema)
		expect(anthropicSchema).toHaveProperty("name", "apply_diff")
		expect(anthropicSchema).toHaveProperty("description")
		expect(anthropicSchema.input_schema).toHaveProperty("type", "object")
		expect(anthropicSchema.input_schema.properties).toHaveProperty("file")
		expect(anthropicSchema.input_schema.properties.file.type).toBe("array")
		expect(anthropicSchema.input_schema.properties.file.items.type).toBe("object")
	})
})
