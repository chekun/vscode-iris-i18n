import * as fs from 'node:fs';
import * as path from 'node:path';

import { throttle } from 'lodash';
import * as vscode from 'vscode';

const workspaceStates = new Map<
    string,
    {
        activeEditor: vscode.TextEditor | undefined;
        decorationType: vscode.TextEditorDecorationType | undefined;
        inplaceAnnotationType: vscode.TextEditorDecorationType | undefined;
        translations: { [language: string]: { [key: string]: string } };
        displayLanguage: string;
        localePath: string;
        configJsonPath: string;
    }
>();

/**
 * Check .iris-i18n.json
 */
function isPluginActiveInWorkspace(workspaceFolder: vscode.WorkspaceFolder): boolean {
    const configJsonPath = path.join(workspaceFolder.uri.fsPath, '.iris-i18n.json');
    return fs.existsSync(configJsonPath);
}

/**
 * Read .iris-i18n.json and update localePath
 */
function readConfigFileForWorkspace(workspaceFolder: vscode.WorkspaceFolder): void {
    const configJsonPath = path.join(workspaceFolder.uri.fsPath, '.iris-i18n.json');
    try {
        const config = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
        const state = workspaceStates.get(workspaceFolder.uri.toString())!;
        state.localePath = path.join(workspaceFolder.uri.fsPath, config.locale_path);
        state.displayLanguage = config.display_language;
        updateTranslationsForWorkspace(workspaceFolder);
    } catch (error) {
        console.error('Error reading .iris-i18n.json:', error);
    }
}

/**
 * Watch changes for workspace locale files
 */
function watchConfigFileForWorkspace(workspaceFolder: vscode.WorkspaceFolder): void {
    const configJsonPath = path.join(workspaceFolder.uri.fsPath, '.iris-i18n.json');
    fs.watch(configJsonPath, (eventType: string, filename: string | null) => {
        if (eventType === 'change' && path.extname(filename!) === '.json') {
            readConfigFileForWorkspace(workspaceFolder);
        }
    });
}

/**
 * Update workspace translations
 */
function updateTranslationsForWorkspace(workspaceFolder: vscode.WorkspaceFolder): void {
    const state = workspaceStates.get(workspaceFolder.uri.toString())!;
    if (!state.localePath) {
        return;
    }
    state.translations = {};
    fs.readdirSync(state.localePath).forEach((languageFolder) => {
        const languagePath = path.join(state.localePath, languageFolder);
        if (fs.statSync(languagePath).isDirectory()) {
            state.translations[languageFolder] = {};
            fs.readdirSync(languagePath).forEach((file) => {
                if (path.extname(file) === '.json') {
                    const filePath = path.join(languagePath, file);
                    try {
                        const translationData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        Object.assign(state.translations[languageFolder], translationData);
                    } catch (error) {
                        console.error(`Error reading ${file}:`, error);
                    }
                }
            });
        }
    });
    updateDecorationsForWorkspace(workspaceFolder);
}

/**
 * Watch changes for workspace locale files
 */
function watchLocaleFilesForWorkspace(workspaceFolder: vscode.WorkspaceFolder): void {
    const state = workspaceStates.get(workspaceFolder.uri.toString())!;
    if (!state.localePath) {
        return;
    }
    fs.watch(
        state.localePath,
        { recursive: true },
        (eventType: string, filename: string | null) => {
            if (eventType === 'change' && path.extname(filename!) === '.json') {
                updateTranslationsForWorkspace(workspaceFolder);
            }
        },
    );
}

/**
 * Create DecorationType for each workspace
 */
function createDecorationTypeForWorkspace(workspaceFolder: vscode.WorkspaceFolder): void {
    const state = workspaceStates.get(workspaceFolder.uri.toString())!;
    state.decorationType = vscode.window.createTextEditorDecorationType({
        textDecoration: 'underline dashed',
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
    state.inplaceAnnotationType = vscode.window.createTextEditorDecorationType({
        textDecoration: 'none; display: none;',
    });
}

/**
 * Update Decorations for each workspace
 */
function updateDecorationsForWorkspace(workspaceFolder: vscode.WorkspaceFolder): void {
    const state = workspaceStates.get(workspaceFolder.uri.toString())!;
    if (!state.activeEditor || !state.decorationType || !state.inplaceAnnotationType) {
        return;
    }

    const text = state.activeEditor.document.getText();
    const regex = /ctx\.Tr\("(.+?)"\)/g;
    const decorationsArray: vscode.DecorationOptions[] = [];
    const inplaceAnnotations: vscode.DecorationOptions[] = [];
    let match: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(text)) !== null) {
        const startPos = state.activeEditor.document.positionAt(match.index + 8);
        const endPos = state.activeEditor.document.positionAt(match.index + match[0].length - 2);
        const range = new vscode.Range(startPos, endPos);
        const selection = state.activeEditor.selection;
        if (!selection.intersection(range)) {
            inplaceAnnotations.push({
                range,
                renderOptions: {
                    after: {
                        contentText: `${state.translations[state.displayLanguage]?.[match[1]] || match[1]}`,
                        color: '#d37070',
                        border: '0.5px solid #d37070; border-radius:2px',
                    },
                },
            });
        } else {
            const lines: string[] = [];
            let displayLanguage: string;
            for (displayLanguage in state.translations) {
                const translatedText = state.translations[displayLanguage]?.[match[1]] || match[1];
                lines.push(`${displayLanguage}: ${translatedText}`);
            }
            const md = new vscode.MarkdownString(
                `#### iris i18n \n<div style="line-height:20px;">${lines.join('</div><div style="line-height:20px;">')}</div>`,
            );
            md.supportHtml = true;
            md.isTrusted = true;
            const decoration: vscode.DecorationOptions = {
                range,
                hoverMessage: md,
            };
            decorationsArray.push(decoration);
        }
    }
    state.activeEditor.setDecorations(state.decorationType, decorationsArray);
    state.activeEditor.setDecorations(state.inplaceAnnotationType, inplaceAnnotations);
}

/**
 * Activate extension
 */
function activate(context: vscode.ExtensionContext): void {
    vscode.workspace.workspaceFolders?.forEach(initializeWorkspace);

    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        event.removed.forEach((workspaceFolder) => {
            const state = workspaceStates.get(workspaceFolder.uri.toString());
            state?.decorationType?.dispose();
            workspaceStates.delete(workspaceFolder.uri.toString());
        });

        event.added.forEach(initializeWorkspace);
    });

    function initializeWorkspace(workspaceFolder: vscode.WorkspaceFolder) {
        if (isPluginActiveInWorkspace(workspaceFolder)) {
            const state = {
                activeEditor: undefined as vscode.TextEditor | undefined,
                decorationType: undefined,
                inplaceAnnotationType: undefined,
                translations: {},
                displayLanguage: '',
                localePath: '',
                configJsonPath: path.join(workspaceFolder.uri.fsPath, '.iris-i18n.json'),
            };
            workspaceStates.set(workspaceFolder.uri.toString(), state);

            readConfigFileForWorkspace(workspaceFolder);
            createDecorationTypeForWorkspace(workspaceFolder);
            updateDecorationsForWorkspace(workspaceFolder);
            watchLocaleFilesForWorkspace(workspaceFolder);
            watchConfigFileForWorkspace(workspaceFolder);

            vscode.window.visibleTextEditors.forEach((editor) => {
                if (
                    editor &&
                    editor.document.uri.scheme === 'file' &&
                    editor.document.uri.fsPath.startsWith(workspaceFolder.uri.fsPath)
                ) {
                    state.activeEditor = editor;
                    updateDecorationsForWorkspace(workspaceFolder);
                }
            });

            const throttledUpdateDecorations = throttle(updateDecorationsForWorkspace, 100);

            context.subscriptions.push(
                vscode.window.onDidChangeActiveTextEditor((editor) => {
                    if (
                        editor &&
                        editor.document.uri.scheme === 'file' &&
                        editor.document.uri.fsPath.startsWith(workspaceFolder.uri.fsPath)
                    ) {
                        state.activeEditor = editor;
                        updateDecorationsForWorkspace(workspaceFolder);
                    }
                }),
                vscode.workspace.onDidChangeTextDocument((event) => {
                    if (state.activeEditor && event.document === state.activeEditor.document) {
                        updateDecorationsForWorkspace(workspaceFolder);
                    }
                }),
                vscode.window.onDidChangeTextEditorSelection((event) => {
                    if (state.activeEditor && event.textEditor === state.activeEditor) {
                        throttledUpdateDecorations(workspaceFolder);
                    }
                }),
            );
        }
    }
}

/**
 * Deactivate
 */
function deactivate() {}

export { activate, deactivate };
