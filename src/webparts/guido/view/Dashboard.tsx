import * as React from 'react';
import { useState } from "react";
import {Model} from "../model/Model";

export interface IDashboardProps {
    model: Model;
}

export default function Dashboard(props: IDashboardProps) {

    const [addingProcessVia, setAddingProcessVia] = useState(null); // null, "json" or "bpmn"

    const handleChange = (file: File) => {
        let reader = new FileReader();
        reader.onload = e => {
            let content = reader.result.toString();
            if (addingProcessVia === 'json') {
                props.model.importFromJSON(JSON.parse(content));
            }
            if (addingProcessVia === 'bpmn') {
                props.model.importFromBPMN(content, file.name);
            }
            setAddingProcessVia(null);
        }
        reader.readAsText(file);
    }

    return (
        <>
            <b>Processes</b>:<br/>
            {props.model.processes.map((proc, idx) => <li key={'proc_' + idx}>{proc.name}</li>)}
            <br/>
            Add a new one via <a href='#' onClick={() => setAddingProcessVia('json')}>JSON</a> or <a href='#' onClick={() => setAddingProcessVia('bpmn')}>BPMN</a>
            <br/><br/>
            {addingProcessVia &&
                <input type="file" onChange={e => handleChange(e.target.files[0])}/>
            }
        </>
    );
}
