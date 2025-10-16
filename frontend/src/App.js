import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Mining from "@/pages/Mining";
import TapGame from "@/pages/TapGame";
import Referrals from "@/pages/Referrals";
import Marketplace from "@/pages/Marketplace";
import Orders from "@/pages/Orders";
import VIPMembership from "@/pages/VIPMembership";
import KYCVerification from "@/pages/KYCVerification";
import Wallet from "@/pages/Wallet";
import Leaderboard from "@/pages/Leaderboard";
import AdminDashboard from "@/pages/AdminDashboard";
import OutletPanel from "@/pages/OutletPanel";
import Setup from "@/pages/Setup";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("paras_user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("paras_user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("paras_user");
    toast.success("Logged out successfully");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Home />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/mining" element={user ? <Mining user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/game" element={user ? <TapGame user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/referrals" element={user ? <Referrals user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/marketplace" element={user ? <Marketplace user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/orders" element={user ? <Orders user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/vip" element={user ? <VIPMembership user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/kyc" element={user ? <KYCVerification user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/wallet" element={user ? <Wallet user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/leaderboard" element={user ? <Leaderboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
          <Route path="/admin" element={user && user.role === "admin" ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
          <Route path="/outlet" element={user && user.role === "outlet" ? <OutletPanel user={user} onLogout={handleLogout} /> : <Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;
