import * as stylex from '@stylexjs/stylex';
import React, { useCallback, useState } from 'react';
import { client } from './api/client';

const styles = stylex.create({
	page: {
		padding: 20,
		boxSizing: 'border-box',
		fontFamily: '"Space Grotesk", system-ui, sans-serif',
		backgroundColor: '#092326',
		color: '#e6f1f2'
	},

	header: {
		display: 'flex',
		alignItems: 'center',
		gap: 16,
		marginBottom: 14
	},

	title: {
		fontSize: 18,
		fontWeight: 700,
		margin: 0,
		letterSpacing: 0.4,
		color: '#f2f21b',
		fontFamily: '"Space Grotesk", system-ui, sans-serif'
	},

	button: {
		padding: '8px 14px',
		borderRadius: 10,
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: 'rgba(242,242,27,0.6)',
		backgroundColor: 'rgba(242,242,27,0.08)',
		color: '#f2f21b',
		cursor: 'pointer',
		fontWeight: 600,
		transitionProperty: 'background-color, box-shadow',
		transitionDuration: '150ms',
		boxShadow: '0 0 0 rgba(242,242,27,0)',
		':hover': {
			backgroundColor: 'rgba(242,242,27,0.18)',
			boxShadow: '0 0 0 3px rgba(242,242,27,0.15)'
		},
		':active': {
			backgroundColor: 'rgba(242,242,27,0.25)'
		}
	},

	// ★ 追加: Settings セクション
	settings: {
		display: 'grid',
		gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
		alignItems: 'start',
		gap: 16,
		padding: 14,
		marginBottom: 16,
		borderRadius: 14,
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: 'rgba(169,214,218,0.20)',
		backgroundColor: 'rgba(255,255,255,0.04)'
	},

	settingsColumn: {
		display: 'flex',
		flexDirection: 'column',
		gap: 10,
		minWidth: 0
	},

	settingsTitle: {
		fontSize: 11,
		letterSpacing: 0.6,
		textTransform: 'uppercase',
		opacity: 0.8,
		color: '#a9d6da',
		marginBottom: 2
	},

	fieldLabel: {
		fontSize: 12,
		opacity: 0.8,
		color: '#cde6e8'
	},

	select: {
		width: '100%',
		borderRadius: 12,
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: 'rgba(169,214,218,0.25)',
		padding: '10px 12px',
		backgroundColor: 'rgba(0,0,0,0.18)',
		color: '#e6f1f2',
		outline: 'none',
		boxSizing: 'border-box',
		':focus': {
			borderColor: '#f2f21b',
			boxShadow: '0 0 0 2px rgba(242,242,27,0.25)'
		}
	},
	dateInput: {
		width: '100%',
		borderRadius: 12,
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: 'rgba(169,214,218,0.25)',
		padding: '10px 12px',
		backgroundColor: 'rgba(0,0,0,0.18)',
		color: '#e6f1f2',
		outline: 'none',
		boxSizing: 'border-box',
		':focus': {
			borderColor: '#f2f21b',
			boxShadow: '0 0 0 2px rgba(242,242,27,0.25)'
		}
	},

	helper: {
		fontSize: 11,
		opacity: 0.65,
		color: '#a9d6da'
	},

	container: {
		display: 'flex',
		gap: 16,
		height: 'calc(100vh - 20px - 20px - 24px - 14px - 16px - 64px)' // 雑に余白分引く
	},

	pane: {
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		gap: 8,
		minWidth: 0
	},

	label: {
		fontSize: 11,
		letterSpacing: 0.6,
		textTransform: 'uppercase',
		opacity: 0.7,
		color: '#a9d6da'
	},

	textarea: {
		flex: 1,
		width: '100%',
		resize: 'none',
		borderRadius: 12,
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: 'rgba(169,214,218,0.25)',
		padding: 14,
		backgroundColor: 'rgba(255,255,255,0.04)',
		color: '#e6f1f2',
		fontFamily:
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
		fontSize: 13,
		lineHeight: 1.6,
		boxSizing: 'border-box',
		outline: 'none',
		':focus': {
			borderColor: '#f2f21b',
			boxShadow: '0 0 0 2px rgba(242,242,27,0.25)'
		}
	},
	checkboxGroup: {
		display: 'flex',
		flexDirection: 'column',
		gap: 8,
		marginTop: 4
	},

	checkboxLabel: {
		display: 'flex',
		alignItems: 'center',
		gap: 10,
		cursor: 'pointer',
		fontSize: 13,
		color: '#e6f1f2',
		userSelect: 'none'
	},

	checkboxInput: {
		width: 16,
		height: 16,
		accentColor: '#f2f21b', // ★ ここが効く
		cursor: 'pointer'
	},

	checkboxHint: {
		fontSize: 11,
		opacity: 0.65,
		color: '#a9d6da'
	},

	output: {
		flex: 1,
		width: '100%',
		borderRadius: 12,
		borderWidth: 1,
		borderStyle: 'solid',
		borderColor: 'rgba(169,214,218,0.25)',
		padding: 14,
		overflow: 'auto',
		backgroundColor: 'rgba(0,0,0,0.25)',
		color: '#e6f1f2',
		fontFamily:
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
		fontSize: 13,
		lineHeight: 1.6,
		boxSizing: 'border-box',
		whiteSpace: 'pre-wrap'
	}
});

const DEFAULT_TEMPLATE = `# 日報 {{date}}

## やったこと
- {{dummy.todo1}}
- {{dummy.todo2}}

## 明日やること
- {{dummy.next1}}
`;

type ToolKey = 'github' | 'google_calendar';

const ToolOptions: { label: string; value: ToolKey }[] = [
	{ label: 'GitHub', value: 'github' },
	{ label: 'Google Calendar', value: 'google_calendar' }
];

type ModelKey = 'google/gemini-2.5-flash-lite';

const getLocalDateString = () => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
};

export default function App() {
	const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
	const [result, setResult] = useState<string | null>(null);
	const today = getLocalDateString();

	// ★ 追加: 設定 state
	const [tools, setTools] = useState<ToolKey[]>(['github', 'google_calendar']);
	const [model, setModel] =
		useState<ModelKey>('google/gemini-2.5-flash-lite');
	const [date, setDate] = useState(today);

	const onGenerate = useCallback(async () => {
		const res = await client.api.generate.$post({
			json: { date, template, tools, model }
		});

		if (!res.ok) {
			setResult(`error: ${res.status} ${res.statusText}`);
			return;
		}

		const data = await res.json();
		setResult(data.output);
	}, [date, template, tools, model]);

	return (
		<div {...stylex.props(styles.page)}>
			<div {...stylex.props(styles.header)}>
				<h1 {...stylex.props(styles.title)}>nippo-gen</h1>
				<button {...stylex.props(styles.button)} onClick={onGenerate}>
					生成
				</button>
			</div>

			<section {...stylex.props(styles.settings)}>
				<div {...stylex.props(styles.settingsColumn)}>
					<div {...stylex.props(styles.settingsTitle)}>Settings</div>

					<div>
						<div {...stylex.props(styles.fieldLabel)}>日付</div>
						<input
							type="date"
							{...stylex.props(styles.dateInput)}
							value={date}
							max={today}
							onChange={(e) => setDate(e.target.value)}
						/>
					</div>
				</div>

				<div {...stylex.props(styles.settingsColumn)}>
					<div {...stylex.props(styles.settingsTitle)}>&nbsp;</div>
					<div>
						<div {...stylex.props(styles.fieldLabel)}>対象ツール</div>
						<div {...stylex.props(styles.checkboxHint)}>
							使用するデータソースを選択してください
						</div>

						<div {...stylex.props(styles.checkboxGroup)}>
							{ToolOptions.map((option) => {
								return (
									<React.Fragment key={option.value}>
										<label {...stylex.props(styles.checkboxLabel)}>
											<input
												type="checkbox"
												{...stylex.props(styles.checkboxInput)}
												checked={tools.includes(option.value)}
												onChange={(e) => {
													setTools((prev) =>
														e.target.checked
															? [...prev, option.value]
															: prev.filter((t) => t !== option.value)
													);
												}}
											/>
											{option.label}
										</label>
									</React.Fragment>
								);
							})}
						</div>
					</div>
				</div>

				<div {...stylex.props(styles.settingsColumn)}>
					<div {...stylex.props(styles.settingsTitle)}>&nbsp;</div>
					<div>
						<div {...stylex.props(styles.fieldLabel)}>LLMモデル</div>
						<select
							{...stylex.props(styles.select)}
							value={model}
							onChange={(e) => setModel(e.target.value as ModelKey)}
						>
							<option value="google/gemini-2.5-flash-lite">
								Google Gemini 2.5 Flash-Lite
							</option>
						</select>
					</div>
				</div>
			</section>

			<div {...stylex.props(styles.container)}>
				<div {...stylex.props(styles.pane)}>
					<div {...stylex.props(styles.label)}>Template</div>
					<textarea
						{...stylex.props(styles.textarea)}
						value={template}
						onChange={(e) => setTemplate(e.target.value)}
					/>
				</div>

				<div {...stylex.props(styles.pane)}>
					<div {...stylex.props(styles.label)}>Output</div>
					<div {...stylex.props(styles.output)}>
						{result ?? '（生成結果が表示されます）'}
					</div>
				</div>
			</div>
		</div>
	);
}
