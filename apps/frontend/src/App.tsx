import { Navigate, Route, Routes } from "react-router-dom";
import { DailySummaryPage } from "./pages/DailySummaryPage";

export default function App() {
  return (
    <Routes>
      <Route path="/daily-summary" element={<DailySummaryPage />} />
      <Route path="/" element={<Navigate replace to="/daily-summary" />} />
      <Route path="*" element={<Navigate replace to="/daily-summary" />} />
    </Routes>
  );
}