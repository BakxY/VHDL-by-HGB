
// general imports
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// specific imports
import { EnabledSimulationTools, NO_SIMULATION_PROJECT, eSimulationTool } from './SimulationPackage';

export class SimulationWizard 
{
    // --------------------------------------------
    // Private members
    // --------------------------------------------

    // vs-code members
    private mContext : vscode.ExtensionContext;

    // specific members
    private mWorkSpacePath : string;

    // --------------------------------------------
    // Public methods
    // --------------------------------------------
    public constructor(context : vscode.ExtensionContext, workSpacePath : string)
    {
        this.mContext = context;
        this.mWorkSpacePath = workSpacePath;
    }

    public async SelectActiveProject(projects : string[]) : Promise<string | undefined>
    {
        const relativeProjects : string[] = projects.map((projectPath) => {return path.relative(this.mWorkSpacePath, projectPath);});

        let selectedProject = await vscode.window.showQuickPick(relativeProjects);   

        if(!selectedProject) 
        {
            vscode.window.showErrorMessage("No Simulation-Project was set!");
            return undefined;
        }

        //always store absolute path -> executing script is easier
        if(!path.isAbsolute(selectedProject))
        {
            selectedProject = path.resolve(this.mWorkSpacePath, selectedProject);
        }

        return selectedProject;
    }

    public async SelectSimulationTool() : Promise<eSimulationTool | undefined>
    {
        // quick pick menu with available tools
        let selectedTool = await vscode.window.showQuickPick([...EnabledSimulationTools, NO_SIMULATION_PROJECT]);

        if (!selectedTool)
        {
            vscode.window.showErrorMessage("Selected Simulation-Tool is not available!");
            return undefined;
        }

        return selectedTool as eSimulationTool;
    }

    // --------------------------------------------
    // Private methods
    // --------------------------------------------


}