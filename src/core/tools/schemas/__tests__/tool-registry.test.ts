import { describe, it, expect } from "vitest"
import { getToolRegistry } from "../tool-registry"
import { generateFunctionCallSchema, generateAnthropicToolSchema } from "../base-tool-schema"

describe("ToolRegistry", () => {
	it("should register apply_diff tool by default", () => {
		const registry = getToolRegistry()
		expect(registry.isToolSupported("apply_diff")).toBe(true)
		expect(registry.getToolNames()).toContain("apply_diff")
	})

	it("should generate OpenAI function call schema for apply_diff", () => {
		const registry = getToolRegistry()
		const schemas = registry.generateFunctionCallSchemas(["apply_diff"])

		expect(schemas).toHaveLength(1)
		expect(schemas[0]).toHaveProperty("type", "function")
		expect(schemas[0].function).toHaveProperty("name", "apply_diff")
		expect(schemas[0].function).toHaveProperty("description")
		expect(schemas[0].function.parameters).toHaveProperty("type", "object")
		expect(schemas[0].function.parameters.properties).toHaveProperty("path")
		expect(schemas[0].function.parameters.properties).toHaveProperty("diff")
		expect(schemas[0].function.parameters.required).toContain("path")
		expect(schemas[0].function.parameters.required).toContain("diff")
	})

	it("should generate Anthropic tool schema for apply_diff", () => {
		const registry = getToolRegistry()
		const schemas = registry.generateAnthropicToolSchemas(["apply_diff"])

		expect(schemas).toHaveLength(1)
		expect(schemas[0]).toHaveProperty("name", "apply_diff")
		expect(schemas[0]).toHaveProperty("description")
		expect(schemas[0]).toHaveProperty("input_schema")
		expect(schemas[0].input_schema).toHaveProperty("type", "object")
		expect(schemas[0].input_schema.properties).toHaveProperty("path")
		expect(schemas[0].input_schema.properties).toHaveProperty("diff")
		expect(schemas[0].input_schema.required).toContain("path")
		expect(schemas[0].input_schema.required).toContain("diff")
	})

	it("should filter supported tools correctly", () => {
		const registry = getToolRegistry()
		const allTools = ["apply_diff", "read_file", "write_to_file", "unsupported_tool"]

		const supported = registry.getSupportedTools(allTools)
		const unsupported = registry.getUnsupportedTools(allTools)

		expect(supported).toContain("apply_diff")
		expect(supported).not.toContain("read_file")
		expect(supported).not.toContain("write_to_file")
		expect(supported).not.toContain("unsupported_tool")

		expect(unsupported).toContain("read_file")
		expect(unsupported).toContain("write_to_file")
		expect(unsupported).toContain("unsupported_tool")
		expect(unsupported).not.toContain("apply_diff")
	})
})
