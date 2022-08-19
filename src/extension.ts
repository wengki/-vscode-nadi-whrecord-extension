
import * as vscode from 'vscode';
import IntegratorFactory from './lib/integrator-factory';
export function activate(context: vscode.ExtensionContext) {

	const integratorFactory = new IntegratorFactory(context).create();
	integratorFactory.integrate(context);
}
export function deactivate() {}
