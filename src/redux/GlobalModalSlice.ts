import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Project } from "@/api/Projects/query";

type initialStateType = {
    ProjectDelete: string | null
    /** The project currently being edited, or null when the dialog is closed. */
    ProjectEdit: Project | null
}

const initialState:initialStateType = {
    ProjectDelete: null,
    ProjectEdit: null,
}

const GlobalModalSlice = createSlice({
    name:"GlobalModal",
    initialState,
    reducers:{
        setProjectDelete: (state, payload:PayloadAction<string | null>)=>{
            state.ProjectDelete = payload.payload
            return state;
        },
        setProjectEdit: (state, payload:PayloadAction<Project | null>)=>{
            state.ProjectEdit = payload.payload
            return state;
        }
    }
})

export const {setProjectDelete, setProjectEdit} = GlobalModalSlice.actions;
export default GlobalModalSlice.reducer;
