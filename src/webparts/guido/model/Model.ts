import * as config from './config.json';
import { Process } from "./Process";
import { Case } from "./Case";
import BpmnModdle from 'bpmn-moddle';
import { sp } from "@pnp/sp";
import "@pnp/sp/webs/index";
import "@pnp/sp/lists/web";
import "@pnp/sp/fields/list";
import "@pnp/sp/items/list";
import Utils from "./Utils";
import "@pnp/sp/files/web";
import "@pnp/sp/folders/web";
import "@pnp/sp/files/folder";
import { SharingLinkKind } from "@pnp/sp/sharing";
import { CaseFile, CaseFolder } from "./CaseFolder";
import { SettingsObject } from "./SettingsObject";
import { Specifications } from "./Specifications";
import { SPUser } from "@microsoft/sp-page-context";
import "@pnp/sp/sputilities";
import { IEmailProperties } from "@pnp/sp/sputilities";

const SETTINGS_LIST_NAME: string = 'guido-settings';
const SETTINGS_JSON_FIELD_NAME: string = 'settingsJSON';
const PROCESSES_LIST_NAME: string = 'guido-processes';
const PROCESS_JSON_FIELD_NAME: string = 'processJSON';
const CASES_LIST_NAME: string = 'guido-cases';
const CASE_JSON_FIELD_NAME: string = 'caseJSON';
const DOCS_DIR: string = '/sites/Guido/Freigegebene%20Dokumente';
const CASE_FILES_DIR: string = DOCS_DIR + '/case-files';

export class Model {

    /*
     One "process" consists of multiple "modules" that have "fields".
     Modules are connected in an ordered succession with parallel as well as serial sections. TODO
     Fields might have dependencies on other fields (in previous modules) and can be automatically filled. TODO
     An instantiated process we call "case" containing instantiated modules we call "tasks".
     */

    public lists: any = {};
    public specifications: Specifications = null;

    constructor(public context: any) {
        this.specifications = new Specifications(config.specifications);
        this.ensureCaseFilesFolderStructureInStorage();
    }

    public getCurrentUser = () : SPUser => {
        return this.context.pageContext.user;
    }

    private ensureCaseFilesFolderStructureInStorage = () => {
        if (Utils.isDevEnv()) {
            return;
        }
        sp.web.getFolderByServerRelativeUrl(CASE_FILES_DIR).get().catch(e => {
            sp.web.folders.add(CASE_FILES_DIR).then(() => {
                console.log("Created directory: " + CASE_FILES_DIR);
            });
        });
    }

    public initLists = async(settingsObj: SettingsObject, done) => {
        if (Utils.isDevEnv()) {
            done();
            return;
        }
        let settingsListEnsure = await sp.web.lists.ensure(SETTINGS_LIST_NAME);
        let procsListEnsure = await sp.web.lists.ensure(PROCESSES_LIST_NAME);
        let casesListEnsure = await sp.web.lists.ensure(CASES_LIST_NAME);
        this.lists = {
            settings: settingsListEnsure.list,
            procs: procsListEnsure.list,
            cases: casesListEnsure.list
        };
        if (procsListEnsure.created) { // list was just created
            console.log("Created list: " + PROCESSES_LIST_NAME);
            // it has to be addMultilineText, not just addText, otherwise limited to 255 characters
            await procsListEnsure.list.fields.addMultilineText(PROCESS_JSON_FIELD_NAME);
            Promise.all(config.processes.map(procConf => this.importFromJSON(procConf, null))).then(() => {});
        }
        if (casesListEnsure.created) {
            console.log("Created list: " + CASES_LIST_NAME);
            await casesListEnsure.list.fields.addMultilineText(CASE_JSON_FIELD_NAME);
        }
        if (settingsListEnsure.created) {
            console.log("Created list: " + SETTINGS_LIST_NAME);
            await settingsListEnsure.list.fields.addMultilineText(SETTINGS_JSON_FIELD_NAME);
            // do this after initializing processes to be able to set the first one as default process
            await settingsListEnsure.list.items.add({
                Title: 'settings',
                [SETTINGS_JSON_FIELD_NAME]: JSON.stringify(settingsObj.getJSONconfig())
            });
        }
        done();
    }

    // SETTINGS

    public initSettings(settingsObj: SettingsObject, fallbackDefaultProcessID: string): Promise<void> {
        return new Promise<void>(resolve => {
            if (Utils.isDevEnv()) {
                settingsObj.defaultProcessId = fallbackDefaultProcessID;
                resolve();
                return;
            }
            sp.web.lists.getByTitle(SETTINGS_LIST_NAME).items.get().then((items: any[]) => {
                // we expect just one item to be there
                settingsObj.setListItemID(items[0].ID);
                let json = Utils.parseHtmlJson(items[0][SETTINGS_JSON_FIELD_NAME]);
                if (!json.defaultProcessId) {
                    json.defaultProcessId = fallbackDefaultProcessID;
                }
                settingsObj.setFromJSON(json);
                resolve();
            });
        });
    }

    public updateSettingsInStorage = (settingsObj: SettingsObject): Promise<void> => {
        return new Promise<void>(resolve => {
            if (Utils.isDevEnv()) {
                resolve();
                return;
            }
            this.lists.settings.items.getById(settingsObj.listItemID).update({
                [SETTINGS_JSON_FIELD_NAME]: JSON.stringify(settingsObj.getJSONconfig())
            }).then(() => {
                resolve();
            });
        });
    }

    // PROCESSES

    public getInitialProcesses(done) {
        if (Utils.isDevEnv()) {
            // import processes defined in config.json
            Promise.all(config.processes.map(conf => this.importFromJSON(conf, null))).then(procs => {
                done(procs);
            });
        } else {
            // import processes from sharepoint list
            sp.web.lists.getByTitle(PROCESSES_LIST_NAME).items.get().then((items: any[]) => {
                Promise.all(items.map(item =>
                    this.importFromJSON(Utils.parseHtmlJson(item[PROCESS_JSON_FIELD_NAME]), item.ID)
                )).then(procs => {
                    done(procs);
                });
            });
        }
    }

    public writeProcessToStorage = (proc: Process, resolve) => {
        if (Utils.isDevEnv()) {
            resolve(proc);
        } else {
            this.lists.procs.items.add({
                Title: proc.id,
                [PROCESS_JSON_FIELD_NAME]: JSON.stringify(proc.getJSONconfig())
            }).then(item => {
               proc.setListItemID(item.data.ID);
               resolve(proc);
            });
        }
    }

    public importFromJSON(conf: any, listID: number): Promise<Process> {
        return new Promise<Process>(resolve => {
            let process: Process = new Process(conf.id, conf.name, conf.description);
            process.setModules(conf.modules);
            if (listID) {
                process.setListItemID(listID);
                resolve(process);
            } else {
                this.writeProcessToStorage(process, resolve);
            }
        });
    }

    public importFromBPMN(xmlStr: string, fileName: string): Promise<Process> {
        const moddle = new BpmnModdle();
        return moddle.fromXML(xmlStr).then(parsed => {
            return new Promise<Process>(resolve => {
                let processEl = parsed.rootElement.rootElements[1]; // [0] is bpmn:Collaboration, [1] is bpmn:Process
                let lanesEl = processEl.laneSets[0].lanes;
                let elements = {};
                let startEvent;
                let lanes = {};
                lanesEl.map(laneEl => {
                    lanes[laneEl.id] = laneEl;
                    laneEl.flowNodeRef.map(el => {
                        el.inLane = laneEl.id;
                        elements[el.id] = el;
                        if (el['$type'] === 'bpmn:StartEvent') {
                            startEvent = el;
                        }
                    });
                });

                let orderedTasks = [];
                let currentElement = startEvent;
                while (currentElement['$type'] !== 'bpmn:EndEvent') {
                    let sequenceFlow = currentElement.outgoing[0]; // = "edge" = "arrow"
                    currentElement = elements[sequenceFlow.targetRef.id];
                    if (currentElement['$type'] !== 'bpmn:EndEvent') { // solve this nicer TODO
                        orderedTasks.push(currentElement);
                        // TODO
                        console.log(lanes[currentElement.inLane].name + ' is responsible for ' + currentElement.name);
                    }
                }
                // orderedTasks.pop(); // remove EndEvent

                let process: Process = new Process(fileName, fileName.split('.')[0], '');
                process.setModules(orderedTasks.map(task => this.getModuleIdByModuleName(task.name)));
                this.writeProcessToStorage(process, resolve);
            });
        });
    }

    public getModuleIdByModuleName = moduleName => {
        // needs the module names to match exactly, that can break easily TODO
        return Object.keys(config.modules).filter(mId => config.modules[mId].name === moduleName)[0];
    };

    public deleteProcessFromStorage = async(proc: Process) => {
        if (Utils.isDevEnv()) {
            // ?
        } else {
            await this.lists.procs.items.getById(proc.listID).delete();
        }
    }

    // CASES

    public newCaseFromProcess(proc: Process, existingCaseFolderNameViaEmail: string = null): Promise<Case> {
        return new Promise<Case>(resolve => {
            let caseObj: Case = new Case(this.specifications);
            caseObj.initNewCase(proc);

            const doWriteToStorage = () => {
                this.writeCaseToStorage(caseObj, resolve);
            };

            if (existingCaseFolderNameViaEmail) {
                let existingCaseFolderPath = CASE_FILES_DIR + '/' + existingCaseFolderNameViaEmail;
                sp.web.getFolderByServerRelativeUrl(existingCaseFolderPath).getShareLink(SharingLinkKind.OrganizationEdit).then(result => {
                    let caseFolder = new CaseFolder(existingCaseFolderPath,  result.sharingLinkInfo.Url);
                    caseObj.setCaseFolder(caseFolder);
                    sp.web.getFolderByServerRelativeUrl(existingCaseFolderPath).files.get().then(files => {
                        files.map(f => {
                            caseFolder.addCaseFile(new CaseFile(
                                f.ServerRelativeUrl,
                                f.Name,
                                f.Name.split('.')[1]
                            ));
                        });
                        // extract these params dynamically instead of hardwired? TODO
                        // caseObj.setStep(1);
                        caseObj.setValue('data-upload', 'uploader', caseObj.caseFolder.getJSONconfig());
                        doWriteToStorage();
                    });
                });
            } else {
                doWriteToStorage();
            }
        });
    }

    public writeCaseToStorage = (caseObj: Case, resolve) => {
        if (Utils.isDevEnv()) {
            resolve(caseObj);
        } else {
            this.lists.cases.items.add({
                Title: caseObj.id,
                [CASE_JSON_FIELD_NAME]: JSON.stringify(caseObj.getJSONconfig())
            }).then(item => {
                caseObj.setListItemID(item.data.ID);
                resolve(caseObj);
            });
        }
    }

    public updateCaseInStorage = (caseObj: Case) => {
        if (Utils.isDevEnv()) {
            // ?
        } else {
            this.lists.cases.items.getById(caseObj.listItemID).update({
                // Title: caseObj.id,
                [CASE_JSON_FIELD_NAME]: JSON.stringify(caseObj.getJSONconfig())
            });
        }
    }

    public getInitialCases(procs: Process[], done) {
        this.loadCasesFromStorage(procs, (cases: Case[]) => {
            done(cases);
        });
    }

    private loadCasesFromStorage = (procs, done) => {
        if (Utils.isDevEnv()) {
            done([]);
        } else {
            // import cases from sharepoint list
            sp.web.lists.getByTitle(CASES_LIST_NAME).items.get().then((items: any[]) => {
                let promises = [];
                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    let itemID = item.ID;
                    let caseConf = Utils.parseHtmlJson(item[CASE_JSON_FIELD_NAME]);
                    let proc = procs.filter(p => p.id === caseConf.processId)[0];
                    promises.push(this.importCaseFromListItem(caseConf, itemID, proc));
                }
                Promise.all(promises).then(cases => done(cases));
            });
        }
    }

    public importCaseFromListItem(caseConf: any, listID: number, proc: Process): Promise<Case> {
        return new Promise<Case>(resolve => {
            let caseObj: Case = new Case(this.specifications);
            caseObj.initExistingCase(caseConf, proc);
            caseObj.setListItemID(listID);
            resolve(caseObj);
        });
    }

    public deleteCaseFromStorage = async(caseObj: Case) => {
        if (Utils.isDevEnv()) {
            // ?
        } else {
            await this.lists.cases.items.getById(caseObj.listItemID).delete();
        }
    }

    public uploadFilesToCase(caseObj: Case, fileList: FileList): Promise<void> {
        return new Promise<void>(resolve => {
            if (Utils.isDevEnv()) {
                resolve();
                return;
            }

            let uploadFiles = () => {
                let promises = [];
                for (let i = 0; i < fileList.length; i++) {
                    let file = fileList[i];
                    // for large (?) files, upload in chunks instead: https://pnp.github.io/pnpjs/sp/files/#adding-files
                    promises.push(sp.web.getFolderByServerRelativeUrl(caseObj.caseFolder.folderPath).files.add(file.name, file, true));
                }
                Promise.all(promises).then(uploadedFiles => {
                    uploadedFiles.map(f => {
                        caseObj.caseFolder.addCaseFile(new CaseFile(
                            f.data.ServerRelativeUrl,
                            f.data.Name,
                            f.data.Name.split('.')[1] // make this more robust
                        ));
                    });
                    uploadedFiles.map(f => console.log("Uploaded file: " + f.data.Name + ' to ' + caseObj.caseFolder.folderPath));
                    resolve();
                });
            };

            if (caseObj.caseFolder) {
                // folder exists already, can happen though that it's only referenced in the case but got actually deleted
                // to make it robust, there should be a safeguard against that
                uploadFiles();
            } else { // has to be created first
                let newFolderPath = CASE_FILES_DIR + '/' + caseObj.id;
                sp.web.folders.add(newFolderPath).then(() => {
                    console.log("Created folder: " + newFolderPath);
                    sp.web.getFolderByServerRelativeUrl(newFolderPath).getShareLink(SharingLinkKind.OrganizationEdit).then(result => {
                        caseObj.setCaseFolder(new CaseFolder(newFolderPath, result.sharingLinkInfo.Url));
                        uploadFiles();
                    });
                });
            }
        });
    }

    // EMAIL

    public sendEmail(email: string, subject: string, body: string) {
        // https://pnp.github.io/pnpjs/sp/sp-utilities-utility/#usage
        sp.utility.sendEmail({
            To: [email],
            Subject: subject,
            Body: body
        }).then(() => {
            console.log("Email sent to " + email);
        });
    }
}
