import { convertFunctionCallResponseToXml } from "../tools/schemas/function-call-converter"

/**
 * Processing state for a single tool call
 */
class ToolCallProcessingState {
	functionNameOutputted = false
	functionClosed = false
	lastArgumentsLength = 0
	lastXmlLength = 0
	// 用于流式括号栈追踪
	bracketStack: string[] = []
	inString = false
	escape = false
}
/**
 * Streaming tool call processor that converts JSON to XML in real-time
 */
export class StreamingToolCallProcessor {
	private accumulatedToolCalls: any[] = []
	private processingStates: Map<number, ToolCallProcessingState> = new Map()

	/**
	 * Process a new tool call chunk and return only the new XML content
	 */
	processChunk(chunk: any): string {
		let xmlOutput = ""

		// Accumulate tool call deltas
		for (const delta of chunk) {
			const index = delta.index || 0

			// Initialize tool call if not exists
			if (!this.accumulatedToolCalls[index]) {
				this.accumulatedToolCalls[index] = {
					id: delta.id || "",
					type: "function",
					function: {
						name: "",
						arguments: "",
					},
				}
				this.processingStates.set(index, new ToolCallProcessingState())
			}

			// Update tool call data
			if (delta.function?.name) {
				this.accumulatedToolCalls[index].function.name += delta.function.name
			}
			if (delta.function?.arguments) {
				this.accumulatedToolCalls[index].function.arguments += delta.function.arguments
			}

			// Process the new chunk and get incremental XML
			xmlOutput += this.processToolCallIncremental(index)
		}

		return xmlOutput
	}

	/**
	 * Process a single tool call incrementally and return only new XML content
	 */
	private processToolCallIncremental(index: number): string {
		const toolCall = this.accumulatedToolCalls[index]
		const state = this.processingStates.get(index)!
		let xmlOutput = ""

		// Handle function name output
		if (toolCall.function.name && !state.functionNameOutputted) {
			xmlOutput += `<${toolCall.function.name}>\n`
			state.functionNameOutputted = true
		}

		// Handle arguments - only process new content
		if (toolCall.function.arguments && state.functionNameOutputted && !state.functionClosed) {
			const currentArgsLength = toolCall.function.arguments.length

			this.updateBracketStack(toolCall.function.arguments, state, state.lastArgumentsLength, currentArgsLength)
			const jsonComplete = state.bracketStack.length === 0 && !state.inString && !state.escape

			if (currentArgsLength > state.lastArgumentsLength) {
				// Try to parse and generate XML for the new part
				const newXml = this.generateIncrementalXmlFromJson(
					jsonComplete,
					toolCall.function.arguments,
					state.lastArgumentsLength,
					state.lastXmlLength,
				)

				if (newXml) {
					xmlOutput += newXml
					state.lastXmlLength += newXml.length
					state.lastArgumentsLength = currentArgsLength
				}
			}

			// Check if we can close the function tag
			if (jsonComplete && !state.functionClosed) {
				// Make sure all content is processed and close the tag
				try {
					JSON.parse(toolCall.function.arguments) // Validate it's complete JSON
					xmlOutput += `</${toolCall.function.name}>\n\n`
					state.functionClosed = true
				} catch {
					// JSON is not complete yet, continue
				}
			}
		}

		return xmlOutput
	}

	/**
	 * Generate incremental XML from JSON arguments
	 * This is a simpler approach that focuses on streaming key-value pairs
	 */
	private generateIncrementalXmlFromJson(
		jsonComplete: boolean,
		fullArgs: string,
		fromPos: number,
		lastXmlLength: number,
	): string {
		// If we have complete JSON, generate full XML and return only the new part
		if (jsonComplete) {
			try {
				const parsed = JSON.parse(fullArgs)
				const fullXml = this.convertObjectToXml(parsed, 0)

				// Return only the new part
				if (fullXml.length > lastXmlLength) {
					return fullXml.slice(lastXmlLength)
				}
			} catch {
				// Fall through to partial processing
			}
		}

		// For partial JSON, try to extract complete key-value pairs
		return this.extractCompleteKeyValuePairs(fullArgs, fromPos)
	}

	/**
	 * Extract complete key-value pairs from partial JSON
	 */
	private extractCompleteKeyValuePairs(jsonStr: string, fromPos: number): string {
		let xml = ""

		// Simple regex-based approach to find complete key-value pairs
		const newPart = jsonStr.slice(fromPos)

		// Look for complete string key-value pairs: "key": "value"
		const stringPairRegex = /"([^"\\]*(\\.[^"\\]*)*)"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/g
		let match
		while ((match = stringPairRegex.exec(newPart)) !== null) {
			const key = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\")
			const value = match[3].replace(/\\"/g, '"').replace(/\\\\/g, "\\")
			xml += `<${key}>${value}</${key}>\n`
		}

		// Look for number/boolean/null values: "key": value
		const primitivePairRegex = /"([^"\\]*(\\.[^"\\]*)*)"\s*:\s*(true|false|null|\d+(?:\.\d+)?)/g
		while ((match = primitivePairRegex.exec(newPart)) !== null) {
			const key = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\")
			const value = match[3]
			xml += `<${key}>${value}</${key}>\n`
		}

		return xml
	}

	/**
	 * Convert a JavaScript object to XML format
	 */
	private convertObjectToXml(obj: any, indentLevel: number = 0): string {
		let xml = ""
		const indent = "  ".repeat(indentLevel)

		if (Array.isArray(obj)) {
			// For arrays, we don't add extra nesting here since the key is handled by the parent
			for (const item of obj) {
				if (typeof item === "object" && item !== null) {
					xml += this.convertObjectToXml(item, indentLevel)
				} else {
					xml += `${indent}${item}\n`
				}
			}
		} else if (typeof obj === "object" && obj !== null) {
			for (const [key, value] of Object.entries(obj)) {
				if (value === null || value === undefined) {
					xml += `${indent}<${key}></${key}>\n`
				} else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
					xml += `${indent}<${key}>${value}</${key}>\n`
				} else if (Array.isArray(value)) {
					if (value.length === 0) {
						xml += `${indent}<${key}></${key}>\n`
					} else {
						for (const item of value) {
							xml += `${indent}<${key}>`
							if (typeof item === "object" && item !== null) {
								xml += `\n${this.convertObjectToXml(item, indentLevel + 1)}${indent}`
							} else {
								xml += `${item}`
							}
							xml += `</${key}>\n`
						}
					}
				} else if (typeof value === "object") {
					xml += `${indent}<${key}>\n`
					xml += this.convertObjectToXml(value, indentLevel + 1)
					xml += `${indent}</${key}>\n`
				}
			}
		}

		return xml
	}

	/**
	 * Get the final XML content when streaming is complete
	 */
	finalize(): string {
		let finalXml = ""

		// Process any remaining incomplete tool calls
		for (let i = 0; i < this.accumulatedToolCalls.length; i++) {
			const state = this.processingStates.get(i)
			if (!state || state.functionClosed) {
				continue // Already processed
			}

			const tc = this.accumulatedToolCalls[i]
			if (!tc || !tc.function.name) continue

			// If function name wasn't outputted, output it now
			if (!state.functionNameOutputted) {
				finalXml += `<${tc.function.name}>\n`
			}

			// Try to finalize any remaining arguments
			if (tc.function.arguments) {
				try {
					const parsed = JSON.parse(tc.function.arguments)
					const argsXml = this.convertObjectToXml(parsed, 0)

					// Only add the part we haven't seen yet
					if (argsXml.length > state.lastXmlLength) {
						finalXml += argsXml.slice(state.lastXmlLength)
					}
				} catch {
					// If JSON is still invalid, try to extract what we can
					const remainingXml = this.extractCompleteKeyValuePairs(
						tc.function.arguments,
						state.lastArgumentsLength,
					)
					finalXml += remainingXml
				}
			}

			finalXml += `</${tc.function.name}>\n\n`
		}

		return finalXml
	}

	/**
	 * 增量维护括号栈和字符串状态
	 */
	private updateBracketStack(argStr: string, state: ToolCallProcessingState, from: number, to: number) {
		for (let i = from; i < to; i++) {
			const char = argStr[i]
			if (state.escape) {
				state.escape = false
				continue
			}
			if (char === "\\") {
				state.escape = true
				continue
			}
			if (char === '"') {
				state.inString = !state.inString
				continue
			}
			if (state.inString) continue
			if (char === "{" || char === "[") {
				state.bracketStack.push(char)
			} else if (char === "}") {
				if (state.bracketStack[state.bracketStack.length - 1] === "{") {
					state.bracketStack.pop()
				} else {
					state.bracketStack.push(char)
				}
			} else if (char === "]") {
				if (state.bracketStack[state.bracketStack.length - 1] === "[") {
					state.bracketStack.pop()
				} else {
					state.bracketStack.push(char)
				}
			}
		}
	}

	/**
	 * Reset the processor for new tool call sequence
	 */
	reset(): void {
		this.accumulatedToolCalls = []
		this.processingStates.clear()
	}
}

/**
 * Enhanced streaming tool call handler with real-time XML conversion
 */
export const handleOpenaiToolCallStreaming = (processor: StreamingToolCallProcessor, chunk: any): string => {
	return processor.processChunk(chunk)
}

/**
 * Legacy tool call handler (original implementation) - maintained for backward compatibility
 */
export const handleOpenaiToolCall = (accumulatedToolCalls: any[], chunk: any): string => {
	// For backward compatibility, use the legacy approach
	// Accumulate tool call deltas
	for (const toolCallDelta of chunk.toolCalls) {
		const index = toolCallDelta.index || 0
		if (!accumulatedToolCalls[index]) {
			accumulatedToolCalls[index] = {
				id: toolCallDelta.id || "",
				type: "function",
				function: {
					name: "",
					arguments: "",
				},
			}
		}

		if (toolCallDelta.function?.name) {
			accumulatedToolCalls[index].function.name += toolCallDelta.function.name
		}
		if (toolCallDelta.function?.arguments) {
			accumulatedToolCalls[index].function.arguments += toolCallDelta.function.arguments
		}
	}

	// Convert accumulated tool calls to XML format
	if (accumulatedToolCalls.length > 0) {
		const mockResponse = {
			choices: [
				{
					message: {
						tool_calls: accumulatedToolCalls.filter((tc) => tc && tc.function.name),
					},
				},
			],
		}
		const xmlContent = convertFunctionCallResponseToXml(mockResponse, "openai")
		return xmlContent || ""
	}
	return ""
}
