import { RouterProvider } from "react-router";
import Router from "./routes";
import TopProgressBar from "./components/global/TopProgressBar";

function App() {
  return (
    <>
      <TopProgressBar />
      <RouterProvider router={Router} />
    </>
  );
}

export default App;
