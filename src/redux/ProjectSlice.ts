import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type initialStateType = {
    projects:any[]
    personaDialog: boolean
    /** Persona the dialog opened on: its evidence starts expanded and its row
     *  highlighted. Null when the dialog was opened generally. */
    personaDialogFocus: string | null
}

const initialState:initialStateType = {
    projects:[],
    personaDialog: false,
    personaDialogFocus: null
}

const ProjectSlice = createSlice({
    name:"ProjectSlice",
    initialState,
    reducers:{
        setProjects: (state, action:PayloadAction<any[]>)=>{
            state.projects = action.payload
        },
        setPersonaDialog:(state, action:PayloadAction<boolean>)=>{
            state.personaDialog = action.payload
            state.personaDialogFocus = null
        },
        /** Open the persona dialog on one persona (see personaDialogFocus). */
        openPersonaDialogFor:(state, action:PayloadAction<string>)=>{
            state.personaDialog = true
            state.personaDialogFocus = action.payload
        }
    }
});

export const {setProjects, setPersonaDialog, openPersonaDialogFor} = ProjectSlice.actions;
export default ProjectSlice.reducer;