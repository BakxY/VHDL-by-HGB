//specific imports
import { ISimulationFactory } from "./SimulationFactory";
import { IVhdlFinder } from "../../../FileTools/VhdlFinder/VhdlFinder";

//general imports
import * as vscode from 'vscode';
import { HDLRegressionVhdlFinder } from "../../../FileTools/VhdlFinder/HDLRegressionVhdlFinder";

export class HDLRegressionFactory implements ISimulationFactory
{

    // --------------------------------------------
    // Private members
    // --------------------------------------------
    private static mInstance : HDLRegressionFactory;

    private constructor() {}

    // --------------------------------------------
    // Public methods
    // --------------------------------------------
    public static getInstance(): HDLRegressionFactory
    {
        if (!HDLRegressionFactory.mInstance) {
            HDLRegressionFactory.mInstance = new HDLRegressionFactory();
        }

        return HDLRegressionFactory.mInstance;
    }

    public CreateVhdlFinder(scriptPath : string, outputChannel : vscode.OutputChannel) : IVhdlFinder
    {
        return new HDLRegressionVhdlFinder(scriptPath, outputChannel);
    }
}