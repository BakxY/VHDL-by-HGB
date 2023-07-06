//specific imports
import { ACTIVE_SIMULATION_PROJECT, SimulationToolMap, TSimulationProject, eSimulationTool } from './SimulationPackage'; 
import { VUnit } from './VUnit/VUnit';
import { HDLRegression } from './HDLRegression/HDLRegression';
import { SimulationWizard } from './SimulationWizard';

//general imports
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IVhdlFinder } from '../../FileTools/VhdlFinder/VhdlFinder';
import { SimpleVhdlFinder } from '../../FileTools/VhdlFinder/SimpleVhdlFinder';


export class SimulationManager {

    // --------------------------------------------
    // Private members
    // --------------------------------------------

    //vscode-members
    private mContext : vscode.ExtensionContext;
    private mOutputChannel : vscode.OutputChannel;

    //general
    private mWorkSpacePath : string = "";
    private mWizard : SimulationWizard;

    //SimulationTools
    private mVUnit : VUnit;
    private mHDLRegression : HDLRegression;

    //SimulationProjects
    private mSimulationProjects : Map<eSimulationTool,string[]>;

    // --------------------------------------------
    // Public methods
    // --------------------------------------------
    constructor(context : vscode.ExtensionContext)
    {
        //init vs-code members
        this.mContext = context;
        this.mOutputChannel = vscode.window.createOutputChannel('VHDLbyHGB.Simulation');

        //init specific members
        this.mVUnit = new VUnit(this.mOutputChannel);
        this.mHDLRegression = new HDLRegression(this.mOutputChannel);

        this.mSimulationProjects = new Map<eSimulationTool, string[]>();
        this.mWizard = new SimulationWizard(this.mContext);

        //get workspace path
        const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
        let wsRoot: string | undefined = undefined;
        if (workspaceFolder) {
            this.mWorkSpacePath = workspaceFolder.uri.fsPath;
        }

        this.HandleFileEvents();
        this.RegisterCommands();
    }

    public async Initialize() : Promise<void>
    {
        this.Update();
    }

    public async SetActiveProject() : Promise<boolean>
    {
        // quick pick menu with available tools (including no tool)
        const toolOptions = [...Object.values(eSimulationTool), 'None'];
        let selectedTool = await vscode.window.showQuickPick(toolOptions);

        if(!selectedTool)
        {
            vscode.window.showErrorMessage("No Simulation-Project was set!");
            return false;
        }

        if (selectedTool === 'None') {
            //no active project
            this.mContext.workspaceState.update(ACTIVE_SIMULATION_PROJECT, "");
            vscode.window.showInformationMessage("No active Simulation-Project!");
        }
        else
        {    
           const IsChosen = await this.ChooseSimulationProject(selectedTool as eSimulationTool);
           if(!IsChosen) { return false; }
        }

        vscode.commands.executeCommand("VHDLbyHGB.ProjectManager.Setup");
        return true;
    }

    public GetVhdlFinder() : IVhdlFinder
    {
        //default Finder
        let vhdlFinder : IVhdlFinder = new SimpleVhdlFinder();

        const activeSimulationProject : TSimulationProject | undefined = this.mContext.workspaceState.get(ACTIVE_SIMULATION_PROJECT);

        if (!activeSimulationProject)
        {
            return vhdlFinder;
        }

        if(!fs.existsSync(activeSimulationProject.file))
        {
            return vhdlFinder;
        }

        const simulationFactory = SimulationToolMap.get(activeSimulationProject.tool);

        if(!simulationFactory)
        {
            return vhdlFinder;
        }

        vhdlFinder = simulationFactory.CreateVhdlFinder(activeSimulationProject.file, this.mOutputChannel);

        return vhdlFinder;
    }

    // --------------------------------------------
    // Private methods
    // --------------------------------------------
    private async Update() : Promise<void> 
    {
        const vunitProjects = await this.mVUnit.FindScripts((vscode.workspace.workspaceFolders || [])[0], true);
        this.mSimulationProjects.set(eSimulationTool.VUnit, vunitProjects);

        const hdlregressionProjects = await this.mHDLRegression.FindScripts((vscode.workspace.workspaceFolders || [])[0], true);
        this.mSimulationProjects.set(eSimulationTool.HDLRegression, hdlregressionProjects);

        //if active SimulationProject does not exist anymore -> VhdlFinder must be changed
        const activeSimulationProject : TSimulationProject | undefined = this.mContext.workspaceState.get(ACTIVE_SIMULATION_PROJECT);
        if (activeSimulationProject)
        {
            let isValidSimulationProject : boolean = false;

            for(const [tool,projects] of this.mSimulationProjects)
            {
                if(projects.includes(activeSimulationProject.file)) { isValidSimulationProject = true; }
            }

            if (!isValidSimulationProject)
            {
                vscode.commands.executeCommand("VHDLbyHGB.ProjectManager.Setup");
            }
        }
    }

    private async ChooseSimulationProject(simulationTool : eSimulationTool) : Promise<boolean>
    {
        let selectedProject : string | undefined;

        const toolProjects = this.mSimulationProjects.get(simulationTool);
        if(toolProjects)
        {
            selectedProject = await vscode.window.showQuickPick(toolProjects);
        }

        if(!selectedProject) 
        {
            vscode.window.showErrorMessage("No Simulation-Project was set!");
            return false;
        }

        //always store absolute path -> executing script is easier
        if(!path.isAbsolute(selectedProject))
        {
            selectedProject = path.resolve(this.mWorkSpacePath, selectedProject);
        }

        const simulationProject : TSimulationProject = {
            tool: simulationTool,
            file: selectedProject
        };

        this.mContext.workspaceState.update(ACTIVE_SIMULATION_PROJECT, simulationProject);
        vscode.window.showInformationMessage(`${simulationTool}-Project: ${path.relative(this.mWorkSpacePath, selectedProject)} -> Active!`);

        return true;
    }

    private async HandleFileEvents() : Promise<void>
    {
        vscode.workspace.onDidCreateFiles((event) => 
        {
            const containsSimulationProject : boolean = event.files.some((file) => {
                const filePath = file.fsPath.toLowerCase();
                return this.IsSimulationProject(filePath);
            });
            if(containsSimulationProject)
            {
                this.Update();
            }
        });

        vscode.workspace.onDidDeleteFiles((event) => 
        {
            const containsSimulationProject : boolean = event.files.some((file) => {
                const filePath = file.fsPath.toLowerCase();
                return this.IsSimulationProject(filePath);
            });
            if(containsSimulationProject)
            {
                this.Update();
            }
        });

        vscode.workspace.onDidRenameFiles((event) => 
        {
            const containsSimulationProject : boolean = event.files.some((file) => {
                const newFilePath = file.newUri.fsPath.toLowerCase();
                const oldFilePath = file.oldUri.fsPath.toLowerCase();
                return this.IsSimulationProject(newFilePath) || this.IsSimulationProject(oldFilePath);
            });
            if(containsSimulationProject)
            {
                this.Update();
            }
        });
    }

    private IsSimulationProject(filePath : string) : boolean
    {
        return  filePath.endsWith(vscode.workspace.getConfiguration().get("vhdl-by-hgb.vunitScriptName") as string) ||
                filePath.endsWith(vscode.workspace.getConfiguration().get("vhdl-by-hgb.hdlregressionScriptName") as string);
    }

    private RegisterCommands(): void {

        let disposable: vscode.Disposable;

        disposable = vscode.commands.registerCommand("VHDLbyHGB.SimulationManager.SetActiveProject", () => { this.SetActiveProject(); });
        this.mContext.subscriptions.push(disposable);
    }

    
}


