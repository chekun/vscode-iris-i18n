import * as fs from 'node:fs';
import * as path from 'node:path';

import * as vscode from 'vscode';

let activeEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
let decorationType: vscode.TextEditorDecorationType | undefined;
let translations: { [language: string]: { [key: string]: string } } = {};
let displayLanguage: string = ''; // @todo display translated text at the same position
let localePath: string = '';
let configJsonPath: string = '';

/**
 * Check .iris-i18n.json existence
 */
function isPluginActive(): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return false;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    configJsonPath = path.join(rootPath, '.iris-i18n.json');
    return fs.existsSync(configJsonPath);
}

/**
 * Read .iris-i18n.json and update localePath
 */
function readConfigFile(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }
    const configFilePath = configJsonPath;
    try {
        const config: { locale_path: string; display_language: string } = JSON.parse(
            fs.readFileSync(configFilePath, 'utf8'),
        );
        localePath = path.join(workspaceFolders[0].uri.fsPath, config.locale_path);
        displayLanguage = config.display_language;
        updateTranslations();
    } catch (error) {
        console.error('Error reading .iris-i18n.json:', error);
    }
}

/**
 * Update translations
 */
function updateTranslations(): void {
    if (!localePath) {
        return;
    }
    translations = {};
    fs.readdirSync(localePath).forEach((file: string) => {
        if (path.extname(file) === '.json') {
            const language = path.basename(file, '.json');
            const filePath = path.join(localePath, file);
            try {
                const translationData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                translations[language] = translationData;
            } catch (error) {
                console.error(`Error reading ${file}:`, error);
            }
        }
    });
    updateDecorations();
}

/**
 * Watch localePath
 */
function watchLocaleFiles(): void {
    if (!localePath) {
        return;
    }
    fs.watch(localePath, (eventType: string, filename: string | null) => {
        if (eventType === 'change' && path.extname(filename!) === '.json') {
            updateTranslations();
        }
    });
}

/**
 * CreateDecorationType
 */
function createDecorationType(): void {
    decorationType = vscode.window.createTextEditorDecorationType({
        textDecoration: 'underline dashed',
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
}

/**
 * UpdateDecorations
 */
function updateDecorations(): void {
    if (!activeEditor || !decorationType) {
        return;
    }

    const text = activeEditor.document.getText();
    const regex = /ctx\.Tr\("(.+?)"\)/g;
    const decorationsArray: vscode.DecorationOptions[] = [];
    let match: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(text)) !== null) {
        const startPos = activeEditor.document.positionAt(match.index + 8);
        const endPos = activeEditor.document.positionAt(match.index + match[0].length - 2);
        const lines: string[] = [];
        for (displayLanguage in translations) {
            const translatedText = translations[displayLanguage]?.[match[1]] || match[1];
            lines.push(`${displayLanguage}: ${translatedText}`);
        }
        const md = new vscode.MarkdownString(
            `#### iris-i18n \n<div style="line-height:20px;">${lines.join('</div><div style="line-height:20px;">')}</div>`,
        );
        md.supportHtml = true;
        md.isTrusted = true;
        const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(startPos, endPos),
            hoverMessage: md,
        };
        decorationsArray.push(decoration);
    }
    activeEditor.setDecorations(decorationType, decorationsArray);
}

/**
 * Activate
 */
function activate(context: vscode.ExtensionContext): void {
    if (!isPluginActive()) {
        return;
    }

    readConfigFile();
    createDecorationType();
    updateDecorations();
    watchLocaleFiles();

    vscode.window.onDidChangeActiveTextEditor(
        (editor) => {
            activeEditor = editor;
            if (editor && editor.document.languageId === 'go') {
                updateDecorations();
            }
        },
        null,
        context.subscriptions,
    );

    vscode.workspace.onDidChangeTextDocument(
        (event) => {
            if (
                activeEditor &&
                event.document === activeEditor.document &&
                activeEditor.document.languageId === 'go'
            ) {
                updateDecorations();
            }
        },
        null,
        context.subscriptions,
    );

    vscode.workspace.onDidChangeWorkspaceFolders(
        () => {
            if (isPluginActive()) {
                readConfigFile();
                createDecorationType();
                updateDecorations();
                watchLocaleFiles();
            } else {
                // clean up
                activeEditor = undefined;
                decorationType?.dispose();
                translations = {};
                displayLanguage = '';
                localePath = '';
            }
        },
        null,
        context.subscriptions,
    );
}

/**
 * Deactivate
 */
function deactivate() {}

export { activate, deactivate };
