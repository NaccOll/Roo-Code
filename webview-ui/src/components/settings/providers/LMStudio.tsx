import { useCallback, useState, useMemo, useEffect } from "react"
import { useEvent } from "react-use"
import { Trans } from "react-i18next"
import { Checkbox } from "vscrui"
import { VSCodeLink, VSCodeRadio, VSCodeRadioGroup, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { ExtensionMessage } from "@roo/ExtensionMessage"
import { useRouterModels } from "@src/components/ui/hooks/useRouterModels"
import { vscode } from "@src/utils/vscode"

import { inputEventTransform } from "../transforms"
import { ModelRecord } from "@roo/api"

type LMStudioProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const LMStudio = ({ apiConfiguration, setApiConfigurationField }: LMStudioProps) => {
	const { t } = useAppTranslation()

	const [lmStudioModels, setLmStudioModels] = useState<ModelRecord>({})
	const routerModels = useRouterModels()

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	const onMessage = useCallback((event: MessageEvent) => {
		const message: ExtensionMessage = event.data

		switch (message.type) {
			case "lmStudioModels":
				{
					const newModels = message.lmStudioModels ?? {}
					setLmStudioModels(newModels)
				}
				break
		}
	}, [])

	useEvent("message", onMessage)

	// Refresh models on mount
	useEffect(() => {
		// Request fresh models - the handler now flushes cache automatically
		vscode.postMessage({ type: "requestLmStudioModels" })
	}, [])

	// Check if the selected model exists in the fetched models
	const modelNotAvailable = useMemo(() => {
		const selectedModel = apiConfiguration?.lmStudioModelId
		if (!selectedModel) return false

		// Check if model exists in local LM Studio models
		if (Object.keys(lmStudioModels).length > 0 && selectedModel in lmStudioModels) {
			return false // Model is available locally
		}

		// If we have router models data for LM Studio
		if (routerModels.data?.lmstudio) {
			const availableModels = Object.keys(routerModels.data.lmstudio)
			// Show warning if model is not in the list (regardless of how many models there are)
			return !availableModels.includes(selectedModel)
		}

		// If neither source has loaded yet, don't show warning
		return false
	}, [apiConfiguration?.lmStudioModelId, routerModels.data, lmStudioModels])

	// Check if the draft model exists
	const draftModelNotAvailable = useMemo(() => {
		const draftModel = apiConfiguration?.lmStudioDraftModelId
		if (!draftModel) return false

		// Check if model exists in local LM Studio models
		if (Object.keys(lmStudioModels).length > 0 && draftModel in lmStudioModels) {
			return false // Model is available locally
		}

		// If we have router models data for LM Studio
		if (routerModels.data?.lmstudio) {
			const availableModels = Object.keys(routerModels.data.lmstudio)
			// Show warning if model is not in the list (regardless of how many models there are)
			return !availableModels.includes(draftModel)
		}

		// If neither source has loaded yet, don't show warning
		return false
	}, [apiConfiguration?.lmStudioDraftModelId, routerModels.data, lmStudioModels])

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.lmStudioBaseUrl || ""}
				type="url"
				onInput={handleInputChange("lmStudioBaseUrl")}
				placeholder={t("settings:defaults.lmStudioUrl")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.lmStudio.baseUrl")}</label>
			</VSCodeTextField>
			<VSCodeTextField
				value={apiConfiguration?.lmStudioModelId || ""}
				onInput={handleInputChange("lmStudioModelId")}
				placeholder={t("settings:placeholders.modelId.lmStudio")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.lmStudio.modelId")}</label>
			</VSCodeTextField>
			{modelNotAvailable && (
				<div className="flex flex-col gap-2 text-vscode-errorForeground text-sm">
					<div className="flex flex-row items-center gap-1">
						<div className="codicon codicon-close" />
						<div>
							{t("settings:validation.modelAvailability", { modelId: apiConfiguration?.lmStudioModelId })}
						</div>
					</div>
				</div>
			)}
			{Object.keys(lmStudioModels).length > 0 && (
				<VSCodeRadioGroup
					value={
						(apiConfiguration?.lmStudioModelId || "") in lmStudioModels
							? apiConfiguration?.lmStudioModelId
							: ""
					}
					onChange={handleInputChange("lmStudioModelId")}>
					{Object.keys(lmStudioModels).map((model) => (
						<VSCodeRadio key={model} value={model} checked={apiConfiguration?.lmStudioModelId === model}>
							{model}
						</VSCodeRadio>
					))}
				</VSCodeRadioGroup>
			)}
			<Checkbox
				checked={apiConfiguration?.lmStudioSpeculativeDecodingEnabled === true}
				onChange={(checked) => {
					setApiConfigurationField("lmStudioSpeculativeDecodingEnabled", checked)
				}}>
				{t("settings:providers.lmStudio.speculativeDecoding")}
			</Checkbox>
			{apiConfiguration?.lmStudioSpeculativeDecodingEnabled && (
				<>
					<div>
						<VSCodeTextField
							value={apiConfiguration?.lmStudioDraftModelId || ""}
							onInput={handleInputChange("lmStudioDraftModelId")}
							placeholder={t("settings:placeholders.modelId.lmStudioDraft")}
							className="w-full">
							<label className="block font-medium mb-1">
								{t("settings:providers.lmStudio.draftModelId")}
							</label>
						</VSCodeTextField>
						<div className="text-sm text-vscode-descriptionForeground">
							{t("settings:providers.lmStudio.draftModelDesc")}
						</div>
						{draftModelNotAvailable && (
							<div className="flex flex-col gap-2 text-vscode-errorForeground text-sm mt-2">
								<div className="flex flex-row items-center gap-1">
									<div className="codicon codicon-close" />
									<div>
										{t("settings:validation.modelAvailability", {
											modelId: apiConfiguration?.lmStudioDraftModelId,
										})}
									</div>
								</div>
							</div>
						)}
					</div>
					{Object.keys(lmStudioModels).length > 0 && (
						<>
							<div className="font-medium">{t("settings:providers.lmStudio.selectDraftModel")}</div>
							<VSCodeRadioGroup
								value={
									(apiConfiguration?.lmStudioDraftModelId || "") in lmStudioModels
										? apiConfiguration?.lmStudioDraftModelId
										: ""
								}
								onChange={handleInputChange("lmStudioDraftModelId")}>
								{Object.keys(lmStudioModels).map((model) => (
									<VSCodeRadio key={`draft-${model}`} value={model}>
										{model}
									</VSCodeRadio>
								))}
							</VSCodeRadioGroup>
							{Object.keys(lmStudioModels).length === 0 && (
								<div
									className="text-sm rounded-xs p-2"
									style={{
										backgroundColor: "var(--vscode-inputValidation-infoBackground)",
										border: "1px solid var(--vscode-inputValidation-infoBorder)",
										color: "var(--vscode-inputValidation-infoForeground)",
									}}>
									{t("settings:providers.lmStudio.noModelsFound")}
								</div>
							)}
						</>
					)}
				</>
			)}
			<div className="text-sm text-vscode-descriptionForeground">
				<Trans
					i18nKey="settings:providers.lmStudio.description"
					components={{
						a: <VSCodeLink href="https://lmstudio.ai/docs" />,
						b: <VSCodeLink href="https://lmstudio.ai/docs/basics/server" />,
						span: (
							<span className="text-vscode-errorForeground ml-1">
								<span className="font-medium">Note:</span>
							</span>
						),
					}}
				/>
			</div>
		</>
	)
}
