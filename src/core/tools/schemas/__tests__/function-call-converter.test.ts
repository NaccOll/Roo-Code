import { describe, it, expect } from "vitest"
import { convertFunctionCallResponseToXml, hasFunctionCalls, extractTextFromResponse } from "../function-call-converter"

describe("FunctionCallConverter", () => {
	describe("hasFunctionCalls", () => {
		it("should detect OpenAI function calls", () => {
			const response = {
				choices: [
					{
						message: {
							tool_calls: [
								{
									id: "call_123",
									function: {
										name: "apply_diff",
										arguments: '{"path": "test.js", "diff": "some diff"}',
									},
								},
							],
						},
					},
				],
			}

			expect(hasFunctionCalls(response)).toBe(true)
		})

		it("should detect Anthropic tool use", () => {
			const response = {
				content: [
					{ type: "text", text: "I'll help you with that." },
					{
						type: "tool_use",
						id: "tool_123",
						name: "apply_diff",
						input: { path: "test.js", diff: "some diff" },
					},
				],
			}

			expect(hasFunctionCalls(response)).toBe(true)
		})

		it("should detect VS Code LM tool calls", () => {
			const response = {
				toolCalls: [
					{
						id: "call_123",
						name: "apply_diff",
						parameters: { path: "test.js", diff: "some diff" },
					},
				],
			}

			expect(hasFunctionCalls(response)).toBe(true)
		})

		it("should return false for responses without function calls", () => {
			const response = {
				choices: [
					{
						message: {
							content: "Just a text response",
						},
					},
				],
			}

			expect(hasFunctionCalls(response)).toBe(false)
		})
	})

	describe("extractTextFromResponse", () => {
		it("should extract text from OpenAI response", () => {
			const response = {
				choices: [
					{
						message: {
							content: "This is the text content",
						},
					},
				],
			}

			expect(extractTextFromResponse(response)).toBe("This is the text content")
		})

		it("should extract text from Anthropic response", () => {
			const response = {
				content: [
					{ type: "text", text: "First part " },
					{ type: "text", text: "second part" },
					{ type: "tool_use", name: "some_tool" },
				],
			}

			expect(extractTextFromResponse(response)).toBe("First part second part")
		})
	})

	describe("convertFunctionCallResponseToXml", () => {
		it("should convert OpenAI function call to XML", () => {
			const response = {
				choices: [
					{
						message: {
							tool_calls: [
								{
									id: "call_123",
									function: {
										name: "apply_diff",
										arguments: JSON.stringify({
											args: {
												file: [
													{
														path: "test.js",
														diff: [
															{
																search_str: "old content",
																replace_str: "new content",
																start_line: "1",
															},
														],
													},
												],
											},
										}),
									},
								},
							],
						},
					},
				],
			}

			const xml = convertFunctionCallResponseToXml(response, "openai")

			expect(xml).toContain("<apply_diff>")
			expect(xml).toContain("</apply_diff>")
			expect(xml).toContain("<args>")
			expect(xml).toContain('"path":"test.js"')
			expect(xml).toContain("<<<<<<< SEARCH")
			expect(xml).toContain("old content")
			expect(xml).toContain("new content")
			expect(xml).toContain(">>>>>>> REPLACE")
		})

		it("should convert Anthropic tool use to XML", () => {
			const response = {
				content: [
					{
						type: "tool_use",
						id: "tool_123",
						name: "apply_diff",
						input: {
							args: {
								file: [
									{
										path: "test.js",
										diff: [
											{
												search_str: "old content",
												replace_str: "new content",
												start_line: "1",
											},
										],
									},
								],
							},
						},
					},
				],
			}

			const xml = convertFunctionCallResponseToXml(response, "anthropic")

			expect(xml).toContain("<apply_diff>")
			expect(xml).toContain("</apply_diff>")
			expect(xml).toContain("<args>")
			expect(xml).toContain('"path":"test.js"')
			expect(xml).toContain("<<<<<<< SEARCH")
			expect(xml).toContain("old content")
			expect(xml).toContain("new content")
			expect(xml).toContain(">>>>>>> REPLACE")
		})

		it("should return null for responses without function calls", () => {
			const response = {
				choices: [
					{
						message: {
							content: "Just text",
						},
					},
				],
			}

			const xml = convertFunctionCallResponseToXml(response, "openai")
			expect(xml).toBeNull()
		})
	})
})
