import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Loading from "./components/Loading";

const Home = lazy(() => import("./pages/Home"));
const Players = lazy(() => import("./pages/Players"));
const PlayerDetail = lazy(() => import("./pages/PlayerDetail"));
const Compare = lazy(() => import("./pages/Compare"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Draft = lazy(() => import("./pages/Draft"));
const Historical = lazy(() => import("./pages/Historical"));

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<PlayerDetail />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/draft" element={<Draft />} />
          <Route path="/historical" element={<Historical />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
