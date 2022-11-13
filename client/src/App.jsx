import "./App.css";
import { Route, Routes } from "react-router-dom";
import Video from "./Video";

function App() {
  return (
    <Routes>
      <Route path="/:roomName" element={<Video />} />
    </Routes>
  );
}

export default App;
