import { combineReducers, configureStore } from "@reduxjs/toolkit";
import ProjectReducer from './ProjectSlice'
import GlobalModalReducer from './GlobalModalSlice'

const rootReducer = combineReducers({
  Project: ProjectReducer,
  GlobalModal: GlobalModalReducer
});


export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
